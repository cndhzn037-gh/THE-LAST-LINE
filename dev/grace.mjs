import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl(id) { return { id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl(id)), createElement: () => makeEl("x"), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });
const W = () => ctx.W;
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function clearScene() {
  ctx.buildScenario(999, 2);
  W().over = false;
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
}

console.log("=== 一、破盾瞬间的无敌帧 ===");
console.log("  设定无敌时长 " + CFG.shield.graceT + "s");
clearScene();
const shd = ctx.addUnit("shield", 1500, 1000);
const z1 = ctx.addUnit("zombie", 1500, 1020);
z1.hp = 999999;
ctx.rebuildGrids();
/* 一直贴着它，把护盾耐久耗尽 */
let brokeAt = -1, infectAt = -1;
for (let i = 0; i < 60 * 12; i++) {
  z1.x = shd.x; z1.y = shd.y + 18; z1.vx = 0; z1.vy = 0;
  ctx.stepSim(1 / 60);
  if (shd.shieldBroken && brokeAt < 0) brokeAt = i / 60;
  if (shd.infectLocked && infectAt < 0) infectAt = i / 60;
}
console.log("  护盾在第 " + (brokeAt < 0 ? "未" : brokeAt.toFixed(2) + "s") + " 破裂，" +
  "首次感染发生在第 " + (infectAt < 0 ? "未感染" : infectAt.toFixed(2) + "s"));
chk(brokeAt >= 0, "护盾确实被打碎了");
chk(infectAt < 0 || infectAt >= brokeAt + CFG.shield.graceT - 0.05,
  "破盾后至少 " + CFG.shield.graceT + "s 之内不会被感染（实际间隔 " +
  (infectAt < 0 ? "-" : (infectAt - brokeAt).toFixed(2) + "s") + "）");

console.log("\n=== 二、无敌帧结束后照常会感染 ===");
chk(infectAt >= 0, "无敌期过去之后仍然会中招（" + (infectAt < 0 ? "未感染" : infectAt.toFixed(2) + "s") + "）");

console.log("\n=== 三、无敌帧不影响别的盾兵 ===");
clearScene();
const s1 = ctx.addUnit("shield", 1400, 1000);
const s2 = ctx.addUnit("shield", 1600, 1000);
const z2 = ctx.addUnit("zombie", 1600, 1020);
z2.hp = 999999;
ctx.rebuildGrids();
s1.graceT = 0.5;                 /* 只有 s1 处在无敌里 */
for (let i = 0; i < 30; i++) { z2.x = s2.x; z2.y = s2.y + 18; z2.vx = 0; z2.vy = 0; ctx.stepSim(1 / 60); }
console.log("  s1（无敌中）感染=" + s1.infectLocked + "，s2（正常）护盾=" + s2.shieldHp.toFixed(1) + "s");
chk(s1.infectLocked === false, "无敌中的盾兵没有被感染");
chk(s2.shieldHp < CFG.shield.hp, "另一名盾兵照常在挨打，无敌帧不会连带保护别人");

console.log("\n=== 四、无敌结束后还能继续被咬 ===");
clearScene();
const s3 = ctx.addUnit("shield", 1500, 1000);
s3.shieldHp = 0.01;              /* 快破了 */
const z3 = ctx.addUnit("zombie", 1500, 1020);
z3.hp = 999999;
ctx.rebuildGrids();
let broke3 = -1;
for (let i = 0; i < 60 * 20; i++) {
  z3.x = s3.x; z3.y = s3.y + 18; z3.vx = 0; z3.vy = 0;
  ctx.stepSim(1 / 60);
  if (s3.shieldBroken && broke3 < 0) broke3 = i / 60;
}
console.log("  破盾 " + (broke3 < 0 ? "未发生" : broke3.toFixed(2) + "s") + "，最终感染=" + s3.infectLocked);
chk(broke3 >= 0 && s3.infectLocked === true, "无敌期一过还是会被咬到");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
