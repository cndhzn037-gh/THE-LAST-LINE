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

const stats = {};
function wrap(name, obj) {
  const orig = obj ? obj[name] : ctx[name];
  if (typeof orig !== "function") { console.log("!! 无法包装 " + name); return; }
  stats[name] = { n: 0, ms: 0, max: 0 };
  const fn = function () {
    const s = process.hrtime.bigint();
    const r = orig.apply(this, arguments);
    const ms = Number(process.hrtime.bigint() - s) / 1e6;
    const st = stats[name];
    st.n++; st.ms += ms; if (ms > st.max) st.max = ms;
    return r;
  };
  if (obj) obj[name] = fn; else ctx[name] = fn;
}
["astar", "smoothPath", "herdSample", "nearestHuman", "damageZombie", "repathTo", "moveDirTo", "nearestZombie", "densestZombie"].forEach(n => wrap(n, null));
wrap("los", ctx.NAV);
wrap("queryBox", ctx.ALLGRID);
wrap("query", ctx.ALLGRID);

ctx.buildScenario(undefined, 80);
let slow = [];
for (let i = 0; i < 900; i++) {
  const s0 = process.hrtime.bigint();
  ctx.stepSim(1 / 60);
  const ms = Number(process.hrtime.bigint() - s0) / 1e6;
  if (ms > 30) slow.push(i + ":" + ms.toFixed(0));
}
console.log("总步数 900，>30ms 的步: " + (slow.length ? slow.slice(0, 10).join(" ") : "无"));
console.log("函数级累计（900 步）：");
const rows = Object.keys(stats).map(k => ({ k, ...stats[k] })).sort((a, b) => b.ms - a.ms);
for (const r of rows) {
  console.log("  " + r.k.padEnd(16) + " 调用 " + String(r.n).padStart(8) + " 次  累计 " + r.ms.toFixed(1).padStart(9) + "ms  单次均值 " + (r.ms / Math.max(1, r.n)).toFixed(4) + "ms  单次最大 " + r.max.toFixed(1) + "ms");
}
