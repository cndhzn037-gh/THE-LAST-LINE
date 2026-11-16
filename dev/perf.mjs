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

for (const n of [80, 200, 400, 800]) {
  ctx.buildScenario(undefined, n);
  for (let i = 0; i < 240; i++) ctx.stepSim(1 / 60);
  const N = 240;
  const t0 = process.hrtime.bigint();
  let worst = 0;
  for (let i = 0; i < N; i++) {
    const s0 = process.hrtime.bigint();
    ctx.stepSim(1 / 60);
    const ms = Number(process.hrtime.bigint() - s0) / 1e6;
    if (ms > worst) worst = ms;
  }
  const avg = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  const c = ctx.countUnits();
  console.log("开局 " + n + " 只：实际丧尸=" + c.z + " 人类=" + c.h + "  平均 " + avg.toFixed(2) + "ms/步  最差 " + worst.toFixed(1) + "ms");
}
