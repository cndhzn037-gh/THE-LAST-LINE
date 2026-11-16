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
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }
function parkZombies() {
  for (const u of ctx.W.units) if (isZ(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
}
function humans() { return ctx.W.units.filter(u => !u.dead && ctx.isHuman(u) && !ctx.isZombieSide(u)); }
function fresh(seed) {
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
  ctx.LAST_ZOMBIE_COUNT = 24;
  ctx.buildScenario(seed, 24);
  ctx.W.over = false; ctx.W.result = ""; ctx.W.waves = null;
  ctx.W.paused = false;
}
const CFG = ctx.CFG;
const GARR = CFG.garrison;

console.log("=== 一、下达坚守指令：姿态生效、控制权交回 AI ===");
fresh(11);
parkZombies();
const h = humans().find(u => u.kind === "rifle");
console.log("  选中 " + h.kind + " #" + h.id + "，恐惧半径 " + ctx.fearRadiusOf(h).toFixed(0) + "px");
ctx.cueAdd(h, "garrison", { x: 2000, y: 1200, r: 160 });
ctx.rebuildGrids();
tick(1 / 60);
console.log("  指令落地后：cue=" + (h.cue ? h.cue.act : "null") + "，gar=" + JSON.stringify(h.gar));
chk(!!h.gar, "坚守姿态被设置到单位身上");
chk(!h.cue, "指令被立即消化，控制权回到常规 AI（不会再像待命那样钉死）");
chk(Math.abs(h.gar.r - 160) < 0.01, "坚守半径按指定值设定（" + h.gar.r + "px）");
const f0 = CFG.fearR, f1 = ctx.fearRadiusOf(h);
console.log("  恐惧半径 " + f0 + " → " + f1.toFixed(0) + "px（×" + GARR.fearMul + "）");
chk(f1 < f0 * 0.5, "恐惧半径被压得很小");
chk(h.state !== "cue", "不处于剧本走位状态，火力照常输出");

console.log("\n=== 二、被推到圈外会自己顶回来 ===");
parkZombies();
/* 这一项只看"回位拉力"，所以把地形清空，免得撞在墙上干扰判断 */
ctx.W.obstacles = []; ctx.W.doors = [];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
ctx.analyzeTerrain(true);
h.x = 2000 + 320; h.y = 1200; h.vx = 0; h.vy = 0;
ctx.rebuildGrids();
const d0 = Math.hypot(h.x - h.gar.x, h.y - h.gar.y);
const traj = [d0];
for (let i = 0; i < 4; i++) { tick(2); traj.push(Math.hypot(h.x - h.gar.x, h.y - h.gar.y)); }
const d1 = traj[traj.length - 1];
console.log("  距圈心 " + traj.map(v => v.toFixed(0)).join(" → ") + "px（半径 " + h.gar.r + "px）");
chk(d1 < d0 - 60, "确实朝圈心方向回来了");
chk(d1 <= h.gar.r + 25, "回到了坚守范围之内");

console.log("\n=== 三、丧尸逼近时不逃跑（恐惧半径只用来躲接触感染） ===");
fresh(11);
parkZombies();
const a1 = humans().find(u => u.kind === "rifle");
const a2 = humans().filter(u => u.kind === "rifle" && u !== a1)[0];
for (const u of [a1, a2]) { u.x = 2100; u.y = 1300; u.vx = 0; u.vy = 0; }
a2.x = 2160;
ctx.cueAdd(a1, "garrison", { x: 2100, y: 1300, r: 200 });
parkZombies();
/* 一只丧尸放在两人正上方 100px：这个距离在普通步枪兵恐惧圈内、在坚守单位圈外 */
const z1 = ctx.addUnit("zombie", 2100, 1200);
z1.hp = 99999;
ctx.rebuildGrids();
for (let i = 0; i < 3; i++) ctx.stepSim(1 / 60);
console.log("  丧尸距两人 100px：普通兵 state=" + a2.state + "，坚守兵 state=" + a1.state);
console.log("  两者恐惧半径：普通 " + ctx.fearRadiusOf(a2).toFixed(0) + "px / 坚守 " + ctx.fearRadiusOf(a1).toFixed(0) + "px");
chk(a2.state === "flee", "普通步枪兵在恐惧圈内会撤退");
chk(a1.state !== "flee", "坚守单位没有因为 100px 外的丧尸而撤退");

console.log("\n=== 四、尸潮压力大时不放大恐惧半径 ===");
fresh(11);
parkZombies();
const b1 = humans().find(u => u.kind === "rifle");
b1.x = 2100; b1.y = 1300; b1.vx = 0; b1.vy = 0;
ctx.cueAdd(b1, "garrison", { x: 2100, y: 1300, r: 200 });
parkZombies();
/* 在感知圈里塞一群丧尸（但都在恐惧圈外），看坚守单位的恐惧半径会不会被放大 */
const crowd = [];
for (let i = 0; i < 14; i++) {
  const zz = ctx.addUnit("zombie", 2100 + (i - 7) * 26, 1300 - 150 - (i % 3) * 10);
  zz.hp = 99999; crowd.push(zz);
}
ctx.rebuildGrids();
tick(1 / 60);
const s = b1 && ctx._sense;
console.log("  感知圈内丧尸 " + s.far + " 只，坚守兵当前 fearR=" + ctx.fearRadiusOf(b1).toFixed(0) + "px，state=" + b1.state);
chk(b1.state !== "flee", "一群丧尸压在外围也没让它转身逃");

console.log("\n=== 五、解除坚守后一切复原 ===");
ctx.cueClear(b1);
ctx.rebuildGrids();
tick(1 / 60);
console.log("  解除后：gar=" + b1.gar + "，恐惧半径 " + ctx.fearRadiusOf(b1).toFixed(0) + "px");
chk(!b1.gar, "坚守姿态被清掉");
chk(Math.abs(ctx.fearRadiusOf(b1) - CFG.fearR) < 0.01, "恐惧半径回到常规值 " + CFG.fearR + "px");

console.log("\n=== 六、坚守单位照常开火 ===");
fresh(13);
parkZombies();
const g1 = humans().find(u => u.kind === "mg") || humans().find(u => u.kind === "rifle");
g1.x = 2100; g1.y = 1300; g1.vx = 0; g1.vy = 0;
ctx.cueAdd(g1, "garrison", { x: 2100, y: 1300, r: 200 });
parkZombies();
const zt = ctx.addUnit("zombie", 2100, 1120);
zt.hp = 99999;
ctx.rebuildGrids();
const k0 = ctx.W.kills;
tick(3);
parkZombies();
console.log("  3 秒内弹匣 " + g1.mag + "/" + g1.magSize + "，累计击杀 " + ctx.W.kills + "（开局 " + k0 + "）");
chk(g1.mag < g1.magSize || ctx.W.kills > k0, "坚守期间仍然在开火（没有因为指令而停手）");

console.log("\n=== 七、没子弹时先保命 ===");
fresh(11);
parkZombies();
const g2 = humans().find(u => u.kind === "rifle");
g2.x = 2100; g2.y = 1300; g2.vx = 0; g2.vy = 0;
ctx.cueAdd(g2, "garrison", { x: 2100, y: 1300, r: 200 });
parkZombies();
ctx.rebuildGrids();
for (let i = 0; i < 2; i++) ctx.stepSim(1 / 60);   /* 跑两帧，让指令被消化成坚守姿态 */
console.log("  坚守姿态：" + JSON.stringify(g2.gar));
const fNormal = ctx.fearRadiusOf(g2);
g2.mag = 0; g2.reloading = true; g2.reloadT = 2;
const fDry = ctx.fearRadiusOf(g2);
console.log("  有弹 " + fNormal.toFixed(0) + "px → 空弹 " + fDry.toFixed(0) + "px（普通兵 " + CFG.fearR + "px）");
chk(fDry > fNormal * 2, "空弹时恐惧半径恢复到常规水平");
chk(Math.abs(fDry - CFG.fearR) < 0.01, "恢复到的正是普通单位的恐惧半径");
g2.mag = g2.magSize; g2.reloading = false; g2.reloadT = 0;
chk(Math.abs(ctx.fearRadiusOf(g2) - fNormal) < 0.01, "补好弹又回到坚守姿态");

/* 行为验证：空弹 + 丧尸贴近 → 应该像普通兵一样撤 */
g2.mag = 0; g2.reloading = true; g2.reloadT = 3;
g2.lastFireT = ctx.W.t;          /* 装作刚打完，避免"十秒不开火自动补弹"把弹匣补回来 */
const z2 = ctx.addUnit("zombie", 2100, 1200);
z2.hp = 99999;
ctx.rebuildGrids();
for (let i = 0; i < 3; i++) ctx.stepSim(1 / 60);
console.log("  空弹时丧尸在 100px 外：state=" + g2.state + "，恐惧半径 " + ctx.fearRadiusOf(g2).toFixed(0) + "px");
chk(g2.state === "flee", "空弹的坚守单位会像普通兵一样后退保命");
chk(Math.abs(ctx.fearRadiusOf(g2) - CFG.fearR) < 0.01, "空弹期间恐惧半径没有缩回 4 成");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
