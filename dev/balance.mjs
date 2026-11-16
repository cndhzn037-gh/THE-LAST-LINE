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

console.log("=== 速度与恐惧半径 ===");
const U = ctx.CFG.unit;
console.log("  丧尸 vmax=" + U.zombie.vmax + "（原 145）  平民 vmax=" + U.civilian.vmax + "  步枪兵 vmax=" + U.rifle.vmax + "  机枪兵 vmax=" + U.mg.vmax);
console.log("  → 平民比丧尸快 " + (U.civilian.vmax - U.zombie.vmax) + "px/s，可以慢慢拉开；武装单位快 " + (U.rifle.vmax - U.zombie.vmax) + "px/s");
console.log("  恐惧半径：武装 " + ctx.CFG.fearR + "（原 90）  平民 " + ctx.CFG.fearRCivilian + "（原 180）");
console.log("  猛扑速度上限 = " + (U.zombie.vmax * ctx.CFG.pounce.vmaxMul).toFixed(0) + "px/s，持续 " + ctx.CFG.pounce.dur + "s，冷却 " + ctx.CFG.pounce.cd + "s");

console.log("\n=== 尸变期间能否继续开火 ===");
ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0;
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
function fireWhileInfected(stage) {
  ctx.W.units.length = 0; ctx.W.bullets.length = 0; ctx.W.flashes.length = 0;
  ctx.rebuildGrids();
  const z = ctx.addUnit("zombie", 2400, 1200);
  const r = ctx.addUnit("rifle", 2000, 1200);
  if (stage === "incub") { r.infectLocked = true; r.incubT = 1.0; r.fadeT = 0; }
  else if (stage === "fade") { r.infectLocked = true; r.incubT = 2.5; r.fadeT = 1.2; }
  let shots = 0;
  const orig = ctx.fireBullet;
  ctx.fireBullet = function () { shots++; return orig.apply(this, arguments); };
  for (let i = 0; i < 60 * 4; i++) { ctx.stepSim(1 / 60); r.x = 2000; r.y = 1200; r.vx = 0; r.vy = 0; }
  ctx.fireBullet = orig;
  return shots;
}
console.log("  健康状态：4 秒内开火 " + fireWhileInfected("none") + " 次");
console.log("  无症状期：4 秒内开火 " + fireWhileInfected("incub") + " 次（应 > 0）");
console.log("  变色期间：4 秒内开火 " + fireWhileInfected("fade") + " 次（应 > 0）");

console.log("\n=== 完整对局：人类能否撑住 / 能不能退走 ===");
function match(n, seconds) {
  ctx.buildScenario(undefined, n);
  let minCiv = 1e9, retreatFrames = 0, totalFrames = 0;
  for (let i = 0; i < 60 * seconds && !ctx.W.over; i++) {
    ctx.stepSim(1 / 60);
    const hs = ctx.W.units.filter(u => ctx.isHuman(u));
    totalFrames++;
    if (hs.some(u => u.state === "flee")) retreatFrames++;
    const c = ctx.countUnits();
    if (c.civ < minCiv) minCiv = c.civ;
  }
  const c = ctx.countUnits();
  console.log("  " + String(n).padStart(3) + " 只丧尸 · " + seconds + "s：人类=" + c.h + "（平民 " + c.civ + "）丧尸=" + c.z +
    " 击杀=" + ctx.W.kills + " 感染=" + ctx.W.infected +
    " 逃跑帧占比=" + (retreatFrames / Math.max(1, totalFrames) * 100).toFixed(0) + "%" +
    " 结果=" + (ctx.W.over ? ctx.W.result : "进行中"));
}
match(80, 90);
match(160, 90);
