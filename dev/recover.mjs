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
function clearScene(mode) {
  ctx.buildScenario(999, 2);
  W().over = false;
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
  if (mode === "chaos") { CFG.game.recoverT = CFG.chaos.recoverT; CFG.game.recoverAcc = CFG.chaos.recoverAcc; CFG.game.knockMul = CFG.chaos.knockMul; }
  else { CFG.game.recoverT = 0; CFG.game.recoverAcc = 1; CFG.game.knockMul = 1; }
}
/* 打一发子弹，然后看丧尸多久把方向掰回来 */
function measure(mode) {
  clearScene(mode);
  const gun = ctx.addUnit("rifle", 1000, 1000);
  const z = ctx.addUnit("zombie", 1300, 1000);
  z.hp = 999999;
  ctx.rebuildGrids();
  W().t = 5;
  gun.mag = 999;
  ctx.damageZombie(z, 1, gun);
  const v0 = z.vx;
  let backAt = -1;
  for (let i = 0; i < 60 * 3; i++) {
    ctx.stepSim(1 / 60);
    /* 枪在左边、丧尸在右边：击退把它往 +x 推，回正就是速度转回 -x 朝目标 */
    if (backAt < 0 && z.vx <= 0) backAt = i / 60;
  }
  return { v0: v0, backAt: backAt, recoverT: CFG.game.recoverT };
}

console.log("=== 一、混沌模式：更快回正 ===");
const a = measure("chaos");
console.log("  混沌模式：击退初速 " + a.v0.toFixed(0) + "px/s，" +
  (a.backAt < 0 ? "3 秒内没回正" : a.backAt.toFixed(2) + "s 回到朝目标的方向") +
  "，回正窗口 " + a.recoverT + "s，加速度 ×" + CFG.chaos.recoverAcc);
chk(a.v0 > 0, "确实被往后推了（+" + a.v0.toFixed(0) + "px/s）");
chk(a.backAt >= 0, "最终回到了朝目标的方向");

console.log("\n=== 二、防线模式作为对照 ===");
const b = measure("defense");
console.log("  防线模式：击退初速 " + b.v0.toFixed(0) + "px/s，" +
  (b.backAt < 0 ? "3 秒内没回正" : b.backAt.toFixed(2) + "s 回到朝目标的方向"));
chk(b.recoverT === 0, "防线模式没有回正加成");
chk(a.backAt < b.backAt, "混沌模式回正更快（" + a.backAt.toFixed(2) + "s vs " + b.backAt.toFixed(2) + "s）");

console.log("\n=== 三、只是更快回正，不是完全抵消 ===");
clearScene("chaos");
const gun2 = ctx.addUnit("rifle", 1000, 1000);
const z2 = ctx.addUnit("zombie", 1300, 1000);
z2.hp = 999999;
ctx.rebuildGrids();
W().t = 5;
ctx.damageZombie(z2, 1, gun2);
const knock = z2.vx;
console.log("  击退初速 " + knock.toFixed(0) + "px/s（基础 " + CFG.hitStagger.knock + " × 倍率 " + CFG.game.knockMul + "）");
chk(z2.recoverT > 0, "进入回正状态（" + z2.recoverT.toFixed(2) + "s）");
chk(knock > CFG.hitStagger.knock, "击退确实翻倍了，回正没有把它抹平");
/* 回正期间加速度被放大，但速度上限没变 */
const lim = z2.vmaxCur + z2.vmaxBoost;
console.log("  速度上限仍是 " + lim.toFixed(0) + "px/s（回正只加加速度，不放开上限）");
chk(lim <= z2.vmaxCur + CFG.hitStagger.knock * CFG.game.knockMul + 1, "上限没有被回正机制放大");

console.log("\n=== 四、回正计时会走完 ===");
for (let i = 0; i < 60; i++) ctx.stepSim(1 / 60);
console.log("  1 秒后 recoverT=" + Math.max(0, z2.recoverT).toFixed(2));
chk(z2.recoverT <= 0, "回正窗口结束后恢复常态");

console.log("\n=== 五、其它模式不受影响 ===");
clearScene("defense");
const gun3 = ctx.addUnit("rifle", 1000, 1000);
const z3 = ctx.addUnit("zombie", 1300, 1000);
z3.hp = 999999;
ctx.rebuildGrids();
W().t = 5;
ctx.damageZombie(z3, 1, gun3);
console.log("  防线模式中弹后 recoverT=" + z3.recoverT);
chk(z3.recoverT === 0, "防线模式不会进入回正状态");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);