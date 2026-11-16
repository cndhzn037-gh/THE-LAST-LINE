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
const pre = parseInt(process.argv[3] || "900", 10);
const times = [];
for (let i = 0; i < pre; i++) {
  const s0 = process.hrtime.bigint();
  ctx.stepSim(1 / 60);
  times.push(Number(process.hrtime.bigint() - s0) / 1e6);
}
times.sort((a, b) => b - a);
console.log("预热 " + pre + " 步：最慢 5 步 = " + times.slice(0, 5).map(t => t.toFixed(1)).join(", ") + "ms");
console.log("  中位数 = " + times[Math.floor(pre / 2)].toFixed(2) + "ms  均值 = " + (times.reduce((a, b) => a + b, 0) / pre).toFixed(2) + "ms");
const W = ctx.W;
console.log("状态: 丧尸=" + ctx.countUnits().z + " 人类=" + ctx.countUnits().h + " 子弹=" + W.bullets.length + " 特效=" + W.flashes.length + " 障碍=" + W.obstacles.length);

function bench(name, fn, n) {
  for (let i = 0; i < 5; i++) fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log("  " + name.padEnd(24) + (ms / n).toFixed(3) + "ms/次");
}
bench("stepSim 整体", () => ctx.stepSim(1 / 60), 240);
bench("rebuildGrids", () => ctx.rebuildGrids(), 300);
bench("aiZombie 全部", () => { const u = ctx.W.units; for (let i = 0; i < u.length; i++) if (ctx.isZombie(u[i])) ctx.aiZombie(u[i], 1 / 60); }, 200);
bench("aiHuman 全部", () => { const u = ctx.W.units; for (let i = 0; i < u.length; i++) if (ctx.isHuman(u[i])) ctx.aiHuman(u[i], 1 / 60); }, 200);
bench("integrate", () => ctx.integrate(1 / 60), 300);
bench("collideObstacles", () => { const u = ctx.W.units; for (let i = 0; i < u.length; i++) ctx.collideObstacles(u[i]); }, 200);
bench("separateUnits", () => ctx.separateUnits(), 200);
bench("stepBullets", () => ctx.stepBullets(1 / 60), 300);
bench("stepInfection", () => ctx.stepInfection(1 / 60), 200);
bench("rebalanceGuards", () => ctx.rebalanceGuards(), 300);
bench("countUnits", () => ctx.countUnits(), 1000);
const armed = W.units.filter(u => ctx.isArmed(u));
bench("updateCover x" + armed.length, () => { for (let i = 0; i < armed.length; i++) { armed[i].coverT = 0; ctx.updateCover(armed[i], 1 / 60); } }, 100);
bench("segBlockedByWall", () => ctx.segBlockedByWall(1000, 1000, 2400, 1000), 2000);
bench("moveDirTo", () => { const hs = ctx.W.units.filter(u => ctx.isHuman(u)); for (let i = 0; i < hs.length; i++) ctx.moveDirTo(hs[i], 3000, 1100, 1 / 60, 1400); }, 200);
console.log("  子弹数=" + W.bullets.length + " 特效数=" + W.flashes.length);
