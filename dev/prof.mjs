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

/* ---------- 计时包装 ---------- */
const now = () => performance.now();
const stats = {};                 /* name -> { total, count, max } */
const astarCalls = [];            /* 最慢的若干次寻路 */
let curStep = null;               /* 当前步内各段耗时 */
const steps = [];                 /* 每步总耗时与分段 */

function wrap(name) {
  const orig = ctx[name];
  if (typeof orig !== "function") { console.log("  (跳过 " + name + "，不存在)"); return; }
  ctx[name] = function () {
    const t0 = now();
    const r = orig.apply(this, arguments);
    const ms = now() - t0;
    let s = stats[name];
    if (!s) s = stats[name] = { total: 0, count: 0, max: 0 };
    s.total += ms; s.count++;
    if (ms > s.max) s.max = ms;
    if (curStep) curStep[name] = (curStep[name] || 0) + ms;
    return r;
  };
}
const NAMES = ["rebuildGrids", "aiZombie", "aiZombieChase", "aiZombieSleep", "aiHuman",
  "integrate", "collideObstacles", "separateUnits", "stepBullets", "stepInfection", "cleanup",
  "astar", "repathTo", "moveDirTo", "senseZombies", "herdSample", "mateDirSample", "assignRoutes",
  "smoothPath", "NAV.nearestFree", "followPath"];
NAMES.forEach(wrap);
/* NAV.los 是对象方法，单独包一层 */
const origLos = ctx.NAV.los;
let losMs = 0, losN = 0;
ctx.NAV.los = function () {
  const t0 = now();
  const r = origLos.apply(this, arguments);
  const ms = now() - t0;
  losMs += ms; losN++;
  if (curStep) curStep["NAV.los"] = (curStep["NAV.los"] || 0) + ms;
  return r;
};

const origStep = ctx.stepSim;
ctx.stepSim = function (dt) {
  curStep = {};
  const t0 = now();
  origStep.call(this, dt);
  const ms = now() - t0;
  curStep.__total = ms;
  steps.push(curStep);
  curStep = null;
};
/* 单独记 astar 的每一次调用，用于定位尖峰 */
const origAstar = ctx.astar;
ctx.astar = function () {
  const t0 = now();
  const r = origAstar.apply(this, arguments);
  const ms = now() - t0;
  if (ms > 2) astarCalls.push({ ms: ms, step: steps.length });
  return r;
};

/* ---------- 跑起来 ---------- */
const W = () => ctx.W;
ctx.buildScenario(999, 140);
console.log("场景：人类 " + ctx.W.units.filter(u => ctx.isHuman(u)).length +
  " · 丧尸 " + ctx.W.units.filter(u => ctx.isZombie(u)).length);

const STEPS = 1800;
const T0 = now();
for (let i = 0; i < STEPS; i++) ctx.stepSim(1 / 60);
const wall = now() - T0;
console.log("跑 " + STEPS + " 步（30 秒游戏时间）总耗时 " + (wall / 1000).toFixed(2) + "s");

/* ---------- 1. 分段累计 ---------- */
console.log("\n=== 一、各段累计耗时（按总量排序）===");
console.log("  段名                 总耗时ms   占比   调用次数      平均ms      单次最大ms");
const rows = Object.keys(stats).map(k => ({ k: k, s: stats[k] })).sort((a, b) => b.s.total - a.s.total);
for (const r of rows) {
  const s = r.s;
  console.log("  " + r.k.padEnd(18) + String(s.total.toFixed(1)).padStart(9) +
    String((s.total / wall * 100).toFixed(1) + "%").padStart(7) +
    String(s.count).padStart(11) + String((s.total / s.count).toFixed(3)).padStart(11) +
    String(s.max.toFixed(1)).padStart(13));
}
console.log("  " + "NAV.los".padEnd(18) + String(losMs.toFixed(1)).padStart(9) +
  String((losMs / wall * 100).toFixed(1) + "%").padStart(7) + String(losN).padStart(11) +
  String((losMs / losN).toFixed(4)).padStart(11));
console.log("  —— 寻路内部拆解：astar 总计 " + stats.astar.total.toFixed(0) + "ms，其中 smoothPath " +
  stats.smoothPath.total.toFixed(0) + "ms（" + (stats.smoothPath.total / stats.astar.total * 100).toFixed(0) +
  "%），NAV.los " + losMs.toFixed(0) + "ms。" + stats.smoothPath.count + " 次平滑、每次 " + (stats.smoothPath.total / stats.smoothPath.count).toFixed(3) + "ms");
const sum = rows.reduce((a, r) => a + r.s.total, 0);
console.log("  （各段合计 " + sum.toFixed(0) + "ms，其中 stepSim 自身开销 " + (wall - stats.integrate.total > 0 ? "" : "") + "由总时长减去各段得到）");

/* ---------- 2. 最慢的步 ---------- */
console.log("\n=== 二、最慢的 10 步 ===");
const sorted = steps.map((s, i) => ({ i: i, s: s })).sort((a, b) => b.s.__total - a.s.__total);
const avg = steps.reduce((a, s) => a + s.__total, 0) / steps.length;
console.log("  平均每步 " + avg.toFixed(2) + "ms；最慢一步 " + sorted[0].s.__total.toFixed(1) + "ms");
for (const e of sorted.slice(0, 10)) {
  const parts = Object.keys(e.s).filter(k => k !== "__total" && e.s[k] > 1)
    .sort((a, b) => e.s[b] - e.s[a]).slice(0, 5)
    .map(k => k + "=" + e.s[k].toFixed(1)).join("  ");
  console.log("  第 " + String(e.i).padStart(4) + " 步  " + String(e.s.__total.toFixed(1)).padStart(8) + "ms   " + parts);
}

/* ---------- 3. 步内分布的直方图 ---------- */
console.log("\n=== 三、单步耗时分布 ===");
const buckets = [1, 2, 4, 8, 16, 32, 64, 128, 1e9];
let prev = 0;
for (const b of buckets) {
  const n = steps.filter(s => s.__total > prev && s.__total <= b).length;
  if (n) console.log("  " + (prev + "~" + (b > 1e8 ? "∞" : b) + "ms").padEnd(14) + String(n).padStart(5) + " 步  " + (n / steps.length * 100).toFixed(1) + "%");
  prev = b;
}
const over16 = steps.filter(s => s.__total > 16.6).length;
console.log("  超过 16.6ms（掉帧）的步数: " + over16 + " / " + steps.length + " = " + (over16 / steps.length * 100).toFixed(1) + "%");

/* ---------- 4. 寻路尖峰 ---------- */
console.log("\n=== 四、寻路（astar）分析 ===");
const a = stats.astar;
console.log("  调用 " + a.count + " 次，总计 " + a.total.toFixed(0) + "ms，平均 " + (a.total / a.count).toFixed(2) + "ms，单次最大 " + a.max.toFixed(1) + "ms");
console.log("  超过 2ms 的调用: " + astarCalls.length + " 次");
const byStep = {};
for (const c of astarCalls) byStep[c.step] = (byStep[c.step] || 0) + 1;
const hot = Object.keys(byStep).map(k => ({ st: +k, n: byStep[k] })).sort((x, y) => y.n - x.n).slice(0, 8);
console.log("  同一帧内寻路最密集的几步:");
for (const h of hot) console.log("    第 " + String(h.st).padStart(4) + " 步: " + h.n + " 次重规划");
console.log("  最慢的 8 次单次寻路:");
for (const c of astarCalls.sort((x, y) => y.ms - x.ms).slice(0, 8)) {
  console.log("    第 " + String(c.step).padStart(4) + " 步  " + c.ms.toFixed(1) + "ms");
}

/* ---------- 5. 单位数量与耗时的关系 ---------- */
console.log("\n=== 五、规模测试（不同丧尸数量下每步耗时）===");
for (const n of [40, 80, 140, 220, 320]) {
  ctx.buildScenario(999, n);
  for (let i = 0; i < 120; i++) ctx.stepSim(1 / 60);      /* 预热 */
  const T = now();
  const K = 300;
  for (let i = 0; i < K; i++) ctx.stepSim(1 / 60);
  const per = (now() - T) / K;
  console.log("  丧尸 " + String(n).padStart(4) + " 只（场上单位 " + String(ctx.W.units.length).padStart(4) + "）→ 每步 " + per.toFixed(2) + "ms" +
    (per > 16.6 ? "  ← 超过 60 帧预算" : ""));
}
