import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [] }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });

console.log("=== 精确验证：墙后是否开火（把士兵钉死在原地）===");
function wallTest(label, withWall, pin) {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0; ctx.W.flashes.length = 0;
  if (withWall) ctx.W.obstacles.push(ctx.makeObstacle(2150, 1000, 20, 400, "wall"));
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
  const z = ctx.addUnit("zombie", 2300, 1200);
  const r = ctx.addUnit("rifle", 2100, 1200);
  let shots = 0, illegal = 0;
  const origFire = ctx.fireBullet;
  ctx.fireBullet = function (from, target) {
    shots++;
    if (ctx.segBlockedByWall(from.x, from.y, target.x, target.y)) illegal++;
    return origFire.apply(this, arguments);
  };
  for (let i = 0; i < 300; i++) {
    if (pin) { r.x = 2100; r.y = 1200; r.vx = 0; r.vy = 0; }
    ctx.stepSim(1 / 60);
    if (pin) { r.x = 2100; r.y = 1200; r.vx = 0; r.vy = 0; }
  }
  ctx.fireBullet = origFire;
  console.log("  " + label.padEnd(28) + " 开火" + String(shots).padStart(3) + " 次，其中视线被实体墙阻断的违规开火=" + illegal);
}
wallTest("无墙遮挡（钉死原地）", false, true);
wallTest("实体墙遮挡（钉死原地）", true, true);
wallTest("实体墙遮挡（允许移动绕行）", true, false);

console.log("\n=== 速射模式只应在恐惧半径（90px）内触发 ===");
function fireModeTest(dist) {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
  const z = ctx.addUnit("zombie", 2000 + dist, 1200);
  const r = ctx.addUnit("rifle", 2000, 1200);
  let near = 0, far = 0;
  const origFire = ctx.fireBullet;
  ctx.fireBullet = function (from, target, spread) { if (spread > 0) near++; else far++; return origFire.apply(this, arguments); };
  for (let i = 0; i < 240; i++) { ctx.stepSim(1 / 60); r.x = 2000; r.y = 1200; r.vx = 0; r.vy = 0; }
  ctx.fireBullet = origFire;
  console.log("  距离 " + String(dist).padStart(3) + "px：速射(有散射)=" + near + "  精确点射(无散射)=" + far + "   [恐惧半径=" + ctx.CFG.fearR + " 远射圈=" + ctx.CFG.far.r + "]");
}
fireModeTest(60);
fireModeTest(150);
fireModeTest(300);

console.log("\n=== 射击惩罚：开火时移速上限 ===");
ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0;
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const z2 = ctx.addUnit("zombie", 2200, 1200);
const r2 = ctx.addUnit("rifle", 2000, 1200);
let maxSpdFiring = 0, maxSpdIdle = 0;
for (let i = 0; i < 300; i++) {
  ctx.stepSim(1 / 60);
  const sp = Math.hypot(r2.vx, r2.vy);
  if (r2.fireHold > 0) maxSpdFiring = Math.max(maxSpdFiring, sp); else maxSpdIdle = Math.max(maxSpdIdle, sp);
}
console.log("  开火期间最高速度=" + maxSpdFiring.toFixed(0) + "  非开火期间最高速度=" + maxSpdIdle.toFixed(0) +
  "  基础vmax=" + ctx.CFG.unit.rifle.vmax + "  预期开火上限=" + (ctx.CFG.unit.rifle.vmax * ctx.CFG.fireSlowMul).toFixed(0));
console.log("\n=== 制动：人类到位后能否迅速停下 ===");
console.log("  制动加速度=" + ctx.CFG.humanBrake + "（丧尸无制动，保持需求定义的持续加速）");
