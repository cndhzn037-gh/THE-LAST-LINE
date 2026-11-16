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
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }
const ctxW = () => ctx.W;
ctx.GAME_MODE = "defense"; ctxW().mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 12;
ctx.buildScenario(9, 12);
ctxW().over = false; ctxW().paused = false;
for (const u of ctxW().units) if (isZ(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
const armed = ctxW().units.find(u => !u.dead && u.kind === "rifle");
const civ = ctxW().units.find(u => !u.dead && u.kind === "civilian");
for (const u of ctxW().units) {
  if (u.dead || u === armed || u === civ || isZ(u)) continue;
  u.x = 200 + (u.id % 30) * 12; u.y = 200 + (u.id % 17) * 12; u.vx = 0; u.vy = 0;
}
armed.x = 2000; armed.y = 1200; armed.vx = 0; armed.vy = 0;
civ.x = 1870; civ.y = 1200; civ.vx = 0; civ.vy = 0;
civ.guardOf = armed; armed.guards = [civ];
ctx.rebuildGrids();
const ax0 = armed.x, ay0 = armed.y;
for (let s = 0; s < 20; s++) {
  tick(0.5);
  console.log("t=" + ((s + 1) * 0.5).toFixed(1) + "s  护卫(" + armed.x.toFixed(0) + "," + armed.y.toFixed(0) + ") state=" + armed.state +
    "  平民(" + civ.x.toFixed(0) + "," + civ.y.toFixed(0) + ") state=" + civ.state +
    "  距离 " + Math.hypot(civ.x - armed.x, civ.y - armed.y).toFixed(0));
}
console.log("10 秒内护卫位移 " + Math.hypot(armed.x - ax0, armed.y - ay0).toFixed(0) + "px");
