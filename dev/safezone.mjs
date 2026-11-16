import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });
const W = () => ctx.W;
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function tick(n) { for (let i = 0; i < n; i++) ctx.stepSim(1 / 60); }
function clearScene() {
  ctx.buildScenario(999, 2);
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
}
const BOX = { x: 1200, y: 800, w: 420, h: 420 };

console.log("=== 一、无敌区判定 ===");
clearScene();
ctx.EDIT.level = { safeZones: [BOX] };
ctx.EDIT.levelTouched = true;
chk(ctx.inSafeZone(1400, 1000) === true, "区内坐标判为真");
chk(ctx.inSafeZone(1100, 1000) === false, "区外坐标判为假");
chk(ctx.inSafeZone(1210, 1210) === true, "边界内侧判为真");
chk(ctx.inSafeZone(1190, 1000) === false, "边界外侧判为假");

console.log("\n=== 二、区内的单位不会被丧尸索敌 ===");
clearScene();
const inside = ctx.addUnit("civilian", 1400, 1000);   /* 在无敌区里，而且离丧尸更近 */
const outside = ctx.addUnit("civilian", 2100, 1000);  /* 在区外，更远 */
const z = ctx.addUnit("zombie", 1750, 1000);
z.hp = 99999;
ctx.rebuildGrids();
const dIn = Math.hypot(z.x - inside.x, z.y - inside.y);
const dOut = Math.hypot(z.x - outside.x, z.y - outside.y);
console.log("  丧尸到区内平民 " + dIn.toFixed(0) + "px，到区外平民 " + dOut.toFixed(0) + "px");
chk(inside.safe === 1, "区内平民被标记为无敌");
chk(outside.safe === 0, "区外平民没有这个标记");
chk(ctx.nearestHuman(z) === outside, "丧尸跳过了更近的区内目标，去锁区外的");

console.log("\n=== 三、撤掉无敌区后立刻恢复被索敌 ===");
ctx.EDIT.level.safeZones = [];
ctx.rebuildGrids();
console.log("  清空无敌区后：inside.safe=" + inside.safe + "，最近目标=" + (ctx.nearestHuman(z) === inside ? "区内那个" : "区外那个"));
chk(inside.safe === 0, "标记随之清除");
chk(ctx.nearestHuman(z) === inside, "恢复锁定最近的目标");

console.log("\n=== 四、区内的同类不参与集群识别 ===");
clearScene();
ctx.EDIT.level.safeZones = [BOX];
/* 三只丧尸：两只在区外一前一后，一只在区内 —— 区内的不该被当作队列参考 */
const zA = ctx.addUnit("zombie", 2600, 1000);
const zB = ctx.addUnit("zombie", 2700, 1000);
const zSelf = ctx.addUnit("zombie", 2800, 1000);
const zIn = ctx.addUnit("zombie", 2810, 1000);        /* 紧挨着，但在区内的话会被排除 */
ctx.EDIT.level.safeZones = [{ x: 2780, y: 900, w: 300, h: 200 }];
[zA, zB, zSelf, zIn].forEach(u => { u.hp = 99999; });
zA.vx = 100; zA.vy = 0;
zB.vx = 100; zB.vy = 0;
zIn.vx = -100; zIn.vy = 0;                            /* 方向相反，若被采纳会把队形带歪 */
ctx.rebuildGrids();
console.log("  区内丧尸 safe=" + zIn.safe + "，区外两只 safe=" + zA.safe + "/" + zB.safe);
const okHerd = ctx.herdSample(zSelf);
console.log("  自身(" + zSelf.x + ") 采样结果=" + okHerd + "  采样方向=(" + ctx._hx.toFixed(2) + "," + ctx._hy.toFixed(2) + ")");
chk(zIn.safe === 1, "区内那只被标记");
chk(!okHerd || ctx._hx > 0, "队列方向只跟区外那两只（朝 +x），没有被区内反向的那只带歪");

console.log("\n=== 五、编辑器能增删无敌区 ===");
clearScene();
ctx.EDIT.level = null; ctx.EDIT.levelTouched = false;
ctx.editAddSafeZone(1000, 700, 1500, 1200);
const L = ctx.EDIT.level;
chk(L.safeZones && L.safeZones.length === 1, "拖一下就新增了一个无敌区");
console.log("  尺寸 " + L.safeZones[0].w + "×" + L.safeZones[0].h + " @ (" + L.safeZones[0].x + "," + L.safeZones[0].y + ")");
chk(L.safeZones[0].x === 1000 && Math.abs(L.safeZones[0].w - 500) <= 8 && Math.abs(L.safeZones[0].h - 500) <= 8,
  "尺寸与位置正确（矩形会吸附到 8px 网格，所以是 " + L.safeZones[0].w + "×" + L.safeZones[0].h + "）");
/* 框选范围要盖住那个区的中心才能删掉它 */
const cx0 = L.safeZones[0].x + L.safeZones[0].w / 2, cy0 = L.safeZones[0].y + L.safeZones[0].h / 2;
const removed = ctx.editEraseLevel(cx0 - 30, cy0 - 30, cx0 + 30, cy0 + 30);
console.log("  框选删除返回 " + removed);
chk(removed >= 1 && L.safeZones.length === 0, "橡皮擦能把它删掉");
clearScene();
ctx.EDIT.level = null; ctx.EDIT.levelTouched = false;

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
