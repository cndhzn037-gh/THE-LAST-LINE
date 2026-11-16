import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
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
vm.runInContext(src, ctx, { filename: "game.js" });
function ob(x, y, w, h) { return ctx.makeObstacle(x, y, w, h, "wall"); }
const room = [ ob(1800,1200,600,32), ob(1800,1768,600,32), ob(2368,1232,32,536), ob(1800,1232,32,218), ob(1800,1590,32,178) ];
ctx.W.obstacles = room;
ctx.NAV.build(ctx.CFG.world, room, 9);
for (let x = 53; x <= 59; x++) {
  let row = "x=" + x + ": ";
  for (let y = 42; y <= 52; y++) row += (ctx.NAV.b(x, y) ? "#" : ".");
  console.log(row);
}
function ob2(x, y, w, h) { return ctx.makeObstacle(x, y, w, h, "wall"); }
const room2 = [ ob2(1800,1200,600,32), ob2(1800,1768,600,32), ob2(2368,1232,32,536), ob2(1800,1232,32,8), ob2(1800,1296,32,472) ];
ctx.W.obstacles = room2;
ctx.NAV.build(ctx.CFG.world, room2, 9);
console.log("--- room2 列 55-58，行 36-44 ---");
for (let x = 55; x <= 58; x++) {
  let row = "x=" + x + ": ";
  for (let y = 36; y <= 44; y++) row += (ctx.NAV.b(x, y) ? "#" : ".");
  console.log(row);
}
