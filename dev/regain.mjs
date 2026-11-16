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

function clean() {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0;
  ctx.W.bullets.length = 0; ctx.W.flashes.length = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
}
console.log("=== 坚守点位：被恐惧冲散后能否夺回 ===");
clean();
const home = { x: 2000, y: 1200 };
const r = ctx.addUnit("rifle", 2000, 1200);
r.defend = { x: home.x, y: home.y };
r.post = null;
const z = ctx.addUnit("zombie", 2060, 1240);   // 约 72px，处于恐惧半径内
const d0 = () => Math.hypot(r.x - home.x, r.y - home.y);
console.log("  初始离点位 " + d0().toFixed(0) + "px，丧尸距 " + Math.hypot(r.x - z.x, r.y - z.y).toFixed(0) + "px（恐惧半径 " + ctx.CFG.fearR + "）");
let maxAway = 0;
for (let i = 0; i < 60 * 3; i++) { ctx.stepSim(1 / 60); maxAway = Math.max(maxAway, d0()); }
console.log("  被丧尸逼退 3 秒：最远冲到 " + maxAway.toFixed(0) + "px，状态=" + r.state);
z.dead = true;
let regained = -1;
for (let i = 0; i < 60 * 12; i++) {
  ctx.stepSim(1 / 60);
  if (d0() < 20 && regained < 0) { regained = i / 60; break; }
}
console.log("  移除丧尸后：" + (regained >= 0 ? ("在 " + regained.toFixed(2) + "s 夺回点位 ✓") : ("12 秒内未回到点位 ✗ 当前偏离 " + d0().toFixed(0) + "px")));

console.log("\n=== 夺回途中恐惧半径缩小 ===");
clean();
const r2 = ctx.addUnit("rifle", 1800, 1200);
r2.defend = { x: 2200, y: 1200 };   // 离点位 400px，处于 retake 状态
const z2 = ctx.addUnit("zombie", 1860, 1200);   // 距士兵 60px：常规会触发恐惧（90），缩窄后（45）不会
let fled = 0, advanced = 0;
for (let i = 0; i < 60 * 2; i++) {
  const px = r2.x;
  ctx.stepSim(1 / 60);
  if (r2.state === "flee") fled++;
  if (r2.x > px + 0.05) advanced++;
  z2.x = r2.x + 60; z2.y = r2.y;   // 让丧尸始终贴着士兵，维持 60px 距离
}
console.log("  士兵状态出现 flee 的帧数=" + fled + "（缩窄恐惧半径后应为 0）");
console.log("  士兵朝点位方向前进的帧数=" + advanced + "/120");
console.log("  战果：x 从 1800 推进到 " + r2.x.toFixed(0) + "（目标 2200），当前状态=" + r2.state);

console.log("\n=== 完整对局中的集群紧凑度 ===");
ctx.buildScenario(undefined, 90);
for (let s = 1; s <= 10; s++) {
  for (let i = 0; i < 300; i++) ctx.stepSim(1 / 60);
  const hs = ctx.W.units.filter(u => ctx.isHuman(u));
  const civs = hs.filter(u => u.kind === "civilian");
  const armed = hs.filter(u => ctx.isArmed(u));
  const ds = civs.filter(c => c.guardOf && !c.guardOf.dead).map(c => Math.hypot(c.x - c.guardOf.x, c.y - c.guardOf.y));
  const st = {};
  hs.forEach(u => { st[u.state] = (st[u.state] || 0) + 1; });
  console.log("  t=" + (s * 5) + "s 人=" + hs.length + " 尸=" + ctx.countUnits().z +
    " 抱团=" + ds.length + "/" + civs.length +
    " 护卫距离均" + (ds.length ? (ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(0) : "-") +
    "  状态 " + JSON.stringify(st));
}
