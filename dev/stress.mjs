import fs from "node:fs";
import vm from "node:vm";

const file = process.argv[2] || "丧尸沙盒.html";
const html = fs.readFileSync(file, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: 没有 script"); process.exit(1); }
const code = m[1];
const noop = function () {};
function ctxStub() {
  const base = { canvas: null, globalCompositeOperation: "source-over", fillStyle: "", strokeStyle: "",
    lineWidth: 1, globalAlpha: 1, font: "", textAlign: "", shadowBlur: 0, lineCap: "butt", lineJoin: "miter",
    createLinearGradient: function () { return { addColorStop: noop }; },
    createRadialGradient: function () { return { addColorStop: noop }; } };
  return new Proxy(base, { get(t, p) { if (p in t) return t[p]; return noop; }, set(t, p, v) { t[p] = v; return true; } });
}
const ctxs = ctxStub();
function makeEl(id) {
  return { id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [],
    width: 800, height: 600, addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop,
    setAttribute: noop, getAttribute: function () { return null; }, click: noop,
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 800, height: 600 }; },
    getContext: function () { return ctxs; }, querySelectorAll: function () { return []; } };
}
const els = {}, store = {};
const sandbox = {
  console: console, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String,
  Number: Number, isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat, Infinity: Infinity,
  NaN: NaN, Uint8Array: Uint8Array, Int32Array: Int32Array, Float32Array: Float32Array, Map: Map, Set: Set,
  Error: Error, Promise: Promise, TextEncoder: TextEncoder, TextDecoder: TextDecoder,
  Blob: Blob, Response: Response, CompressionStream: (typeof CompressionStream !== "undefined" ? CompressionStream : undefined),
  DecompressionStream: (typeof DecompressionStream !== "undefined" ? DecompressionStream : undefined),
  atob: atob, btoa: btoa, URL: URL, navigator: { clipboard: null, share: null },
  setTimeout: noop, clearTimeout: noop, requestAnimationFrame: function () { return 1; },
  localStorage: { getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
  document: { getElementById: function (id) { return els[id] || (els[id] = makeEl(id)); },
    createElement: function (t) { return makeEl("new-" + t); },
    querySelectorAll: function () { return []; }, body: { appendChild: noop } }
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.window.innerWidth = 1280; sandbox.window.innerHeight = 720; sandbox.window.devicePixelRatio = 1;
sandbox.window.addEventListener = noop;
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx, { filename: "game.js" });

ctx.resetForSetup ? ctx.resetForSetup() : null;
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.bullets.length = 0;
ctx.W.over = false;
for (let i = 0; i < 10; i++) {
  const u = ctx.addUnit("rifle", 900 + (i % 5) * 30, 1000 + Math.floor(i / 5) * 30);
  if (u) u.hp = u.maxHp = 200;
}
for (let i = 0; i < 260; i++) {
  const z = ctx.addUnit("zombie", 1350 + (i % 13) * 34, 780 + Math.floor(i / 13) * 34);
  if (z) z.hp = z.maxHp = 60;
}
for (let i = 0; i < 30; i++) ctx.stepSim(1 / 60);
const N = 180, t0 = Date.now();
for (let i = 0; i < N; i++) ctx.stepSim(1 / 60);
const ms = (Date.now() - t0) / N;
console.log("单位 " + ctx.W.units.length + " · 平均每步 " + ms.toFixed(2) + "ms · 预算 16.7ms");
if (ms > 25) { console.log("FAIL 超出压力预算"); process.exit(1); }
console.log("PASS 压力测试通过");
