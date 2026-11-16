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
const cold = [];
for (let i = 0; i < 300; i++) {
  const s0 = process.hrtime.bigint();
  ctx.stepSim(1 / 60);
  const ms = Number(process.hrtime.bigint() - s0) / 1e6;
  if (ms > 30) cold.push(i + ":" + ms.toFixed(0));
}
console.log("冷启动阶段（前 5 秒）>30ms 的步: " + (cold.length ? cold.join(" ") : "无"));

// 重新开一局并预热，模拟真实运行状态
ctx.buildScenario(undefined, 80);
for (let i = 0; i < 900; i++) ctx.stepSim(1 / 60);
const spikes = [];
let sum = 0;
for (let i = 0; i < 1800; i++) {
  const s0 = process.hrtime.bigint();
  ctx.stepSim(1 / 60);
  const ms = Number(process.hrtime.bigint() - s0) / 1e6;
  sum += ms;
  if (ms > 30) spikes.push((i / 60).toFixed(1) + "s:" + ms.toFixed(0));
}
console.log("稳态 30 秒（已预热）：平均 " + (sum / 1800).toFixed(2) + "ms/步，>30ms 的步 " + spikes.length + " 次 " + (spikes.length ? spikes.slice(0, 12).join(" ") : ""));
