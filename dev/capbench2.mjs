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
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }
console.log("=== 真实一点的负载（不把丧尸全挤成一团） ===");
for (const n of [600, 1200, 2000, 3000]) {
  ctx.CFG.caps.zombies = 9999;
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
  ctx.LAST_ZOMBIE_COUNT = n;
  ctx.buildScenario(11, n);
  ctx.W.over = false; ctx.W.paused = false;
  const zc0 = ctx.W.units.filter(u => !u.dead && isZ(u)).length;
  const hc0 = ctx.W.units.filter(u => !u.dead && ctx.isHuman(u) && !isZ(u)).length;
  /* 只预热 30 步：让它们刚起步，还没挤成球 */
  for (let i = 0; i < 30; i++) ctx.stepSim(1 / 60);
  const t0 = Date.now();
  const STEPS = 180;
  for (let i = 0; i < STEPS; i++) ctx.stepSim(1 / 60);
  const ms = (Date.now() - t0) / STEPS;
  console.log("  丧尸 " + String(zc0).padStart(4) + " · 人类 " + String(hc0).padStart(3) +
    "  →  " + ms.toFixed(2) + " ms/步");
}
