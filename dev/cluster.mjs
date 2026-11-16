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

ctx.buildScenario(undefined, 80);
const W = () => ctx.W;
function snap(tag) {
  const w = W();
  const hs = w.units.filter(u => ctx.isHuman(u));
  const civs = hs.filter(u => u.kind === "civilian");
  const armed = hs.filter(u => ctx.isArmed(u));
  const states = {};
  hs.forEach(u => { states[u.state] = (states[u.state] || 0) + 1; });
  const paired = civs.filter(c => c.guardOf && !c.guardOf.dead);
  const ds = paired.map(c => Math.hypot(c.x - c.guardOf.x, c.y - c.guardOf.y));
  const avgD = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 0;
  const maxD = ds.length ? Math.max(...ds) : 0;
  const cx = hs.reduce((s, u) => s + u.x, 0) / hs.length;
  const cy = hs.reduce((s, u) => s + u.y, 0) / hs.length;
  const spread = Math.sqrt(hs.reduce((s, u) => s + (u.x - cx) ** 2 + (u.y - cy) ** 2, 0) / hs.length);
  const zs = w.units.filter(u => ctx.isZombie(u));
  console.log(tag.padEnd(7) + " 人=" + hs.length + " 尸=" + zs.length +
    " 抱团=" + paired.length + "/" + civs.length +
    " 护卫距离 均" + avgD.toFixed(0) + " 最大" + maxD.toFixed(0) +
    " 集群离散=" + spread.toFixed(0) +
    " 击杀=" + w.kills + "  状态:" + JSON.stringify(states));
}
console.log("=== 集群行为观察（默认岗位，无自定义坚守点位）===");
snap("t=0");
for (let s = 1; s <= 14; s++) {
  for (let i = 0; i < 300; i++) ctx.stepSim(1 / 60);
  if (s % 2 === 0) snap("t=" + (s * 5) + "s");
}

console.log("\n=== 给全部人类设置坚守点位，测试夺回行为 ===");
ctx.buildScenario(undefined, 120);
for (const u of W().units) {
  if (ctx.isHuman(u)) u.defend = { x: Math.round(u.x), y: Math.round(u.y) };
}
for (let i = 0; i < 60 * 40; i++) ctx.stepSim(1 / 60);
const hs2 = W().units.filter(u => ctx.isHuman(u));
let offPost = 0, retaking = 0, maxOff = 0;
for (const u of hs2) {
  if (!u.defend) continue;
  const d = Math.hypot(u.x - u.defend.x, u.y - u.defend.y);
  if (d > 60) offPost++;
  if (u.retaking) retaking++;
  if (d > maxOff) maxOff = d;
}
console.log("40 秒后：离点位>60px 的士兵=" + offPost + "/" + hs2.length + "  正在夺回=" + retaking + "  最远偏离=" + maxOff.toFixed(0) + "px");
console.log("（重新开一局并立即统计基线：所有士兵就在点位上）");

console.log("\n=== 隔墙不开火验证 ===");
function wallTest(label, withWall) {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0; ctx.W.flashes.length = 0;
  if (withWall) ctx.W.obstacles.push(ctx.makeObstacle(2150, 1000, 20, 400, "wall"));
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
  const z = ctx.addUnit("zombie", 2300, 1200);
  const r = ctx.addUnit("rifle", 2100, 1200);
  r.defend = { x: 2100, y: 1200 };
  let shots = 0, firstShotAt = -1;
  const origFire = ctx.fireBullet;
  ctx.fireBullet = function () { shots++; return origFire.apply(this, arguments); };
  for (let i = 0; i < 300; i++) { ctx.stepSim(1 / 60); if (shots > 0 && firstShotAt < 0) firstShotAt = i; }
  ctx.fireBullet = origFire;
  console.log("  " + label + "：5 秒内开火 " + shots + " 次" + (firstShotAt >= 0 ? "（首次 " + (firstShotAt / 60).toFixed(2) + "s）" : "") + "  丧尸hp=" + z.hp + " dead=" + z.dead + "  士兵状态=" + r.state);
}
wallTest("无墙遮挡（应在远射圈内开火）", false);
wallTest("实体墙完全遮挡", true);
