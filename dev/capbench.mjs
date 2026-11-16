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
/* 丧尸数量上限基准：测 stepSim 单步耗时（60fps 的预算是 16.6ms） */
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }
console.log("=== 模拟单步耗时基准 ===");
console.log("  60fps 预算 16.6ms/步；主线程还要留一半给绘制，所以模拟最好 ≤ 8ms");
const results = [];
for (const n of [800, 1500, 2500, 3500, 5000]) {
  ctx.CFG.caps.zombies = 9999;
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
  ctx.LAST_ZOMBIE_COUNT = n;
  ctx.buildScenario(7, n);
  ctx.W.over = false; ctx.W.paused = false;
  /* 让它们先跑起来（挤在一起、互相寻路才是真实负载） */
  for (let i = 0; i < 180; i++) ctx.stepSim(1 / 60);
  const zc = ctx.W.units.filter(u => !u.dead && isZ(u)).length;
  const t0 = Date.now();
  const STEPS = 240;
  for (let i = 0; i < STEPS; i++) ctx.stepSim(1 / 60);
  const ms = (Date.now() - t0) / STEPS;
  results.push({ n: n, alive: zc, ms: ms });
  console.log("  目标 " + String(n).padStart(4) + " 只（存活 " + String(zc).padStart(4) + "）：" + ms.toFixed(2) + " ms/步  " +
    (ms <= 8 ? "✔ 富余" : ms <= 16.6 ? "△ 勉强" : "✘ 超预算"));
}
const ok = results.filter(r => r.ms <= 8).pop();
console.log("\n  模拟能稳住的规模约 " + (ok ? ok.n : 0) + " 只");
