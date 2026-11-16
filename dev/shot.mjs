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

console.log("--- 隔离测试：空旷场地，1 步枪兵 vs 1 丧尸 ---");
function clearAll() {
  ctx.W.units.length = 0;
  ctx.W.obstacles.length = 0;
  ctx.W.doors.length = 0;
  ctx.W.bullets.length = 0;
  ctx.W.flashes.length = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
}
function run(dist, label, mg) {
  clearAll();
  const z = ctx.addUnit("zombie", 2000, 1200);
  const r = ctx.addUnit(mg ? "mg" : "rifle", 2000 + dist, 1200);
  let firstShot = -1;
  for (let i = 0; i < 180; i++) {
    const before = ctx.W.bullets.length;
    ctx.stepSim(1 / 60);
    if (firstShot < 0 && (ctx.W.flashes.length || ctx.W.bullets.length)) firstShot = i;
    if (z.dead) { console.log(label + ": 丧尸在 " + (i / 60).toFixed(2) + "s 被击杀，首发射击帧=" + firstShot + " 累计击杀=" + ctx.W.kills); return; }
  }
  console.log(label + ": 3 秒内未击杀  丧尸hp=" + z.hp + " 存活子弹=" + ctx.W.bullets.length + " 首发射击帧=" + firstShot + " 击杀=" + ctx.W.kills);
}
run(150, "步枪兵 速射圈内(150px)");
run(300, "步枪兵 仅远射圈(300px)");
run(150, "机枪兵(150px)", true);

console.log("--- 隔离测试：子弹几何学 ---");
clearAll();
const z2 = ctx.addUnit("zombie", 2000, 1200);
const src = ctx.W.units[1] = null;
const shooter = { x: 2000 - 300, y: 1200, r: 8, kind: "rifle" };
const b = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dmg: 1, ang: 0 };
const ang = 0;
const ox = shooter.x + Math.cos(ang) * (shooter.r + 3), oy = shooter.y;
const speed = ctx.CFG.bullet.speed, dt = 1 / 60;
const ex = ox + Math.cos(ang) * speed * dt, ey = oy;
console.log("子弹一帧从 (" + ox.toFixed(0) + "," + oy.toFixed(0) + ") 到 (" + ex.toFixed(0) + "," + ey.toFixed(0) + ")，跨度 " + (ex - ox).toFixed(0) + "px");
console.log("segCircleT 命中参数 = " + ctx.segCircleT(ox, oy, ex, ey, z2.x, z2.y, z2.r));
ctx.W.bullets.length = 0;
ctx.rebuildGrids();
const found = ctx.firstZombieOnSegment(ox, oy, ex, ey);
console.log("firstZombieOnSegment 结果 = " + (found ? ("命中 id=" + found.id) : "null"));
console.log("segBlockedByWall(空场景) = " + ctx.segBlockedByWall(ox, oy, ex, ey));
console.log("墙体阻挡测试: " + ctx.segBlockedByWall(0, 0, 1000, 0) + " (无墙应为 false)");
ctx.W.obstacles.push(ctx.makeObstacle(400, -50, 40, 100, "wall"));
console.log("插入一堵墙后 segBlockedByWall = " + ctx.segBlockedByWall(0, 0, 1000, 0) + " (应为 true)");
console.log("矮墙不应挡子弹: " + ctx.segBlockedByWall(0, 0, 1000, 0, 0) + " / 换成 low: ");
ctx.W.obstacles[0].kind = "low";
console.log("  low 墙 segBlockedByWall = " + ctx.segBlockedByWall(0, 0, 1000, 0) + " (应为 false)");
