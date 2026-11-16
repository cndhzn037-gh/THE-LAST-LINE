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
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }
const raw = html;

console.log("=== 一、不开操控也能点角色查看 ===");
chk(raw.indexOf("var pkHit = pickPeekUnit(p.x, p.y);") >= 0, "点击落点会尝试选中角色");
chk(raw.indexOf("UI.peek = pkHit;") >= 0, "选中结果记进 UI.peek");
chk(raw.indexOf("点「操控」即可接管他") >= 0, "提示玩家下一步怎么接管");

console.log("=== 二、查看状态下点操控 = 接管 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 8;
ctx.buildScenario(6, 8);
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) if (isZ(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
ctx.rebuildGrids();
const h1 = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
h1.x = 2000; h1.y = 1200;
ctx.rebuildGrids();
const sx = ctx.w2sx(h1.x), sy = ctx.w2sy(h1.y);
ctx.PLAYER.on = false; ctx.PLAYER.unit = null;
ctx.UI.peek = ctx.pickPeekUnit(sx, sy);
console.log("  查看中：" + (ctx.UI.peek ? "#" + ctx.UI.peek.id : "无"));
chk(!!ctx.UI.peek, "点中角色后进入查看状态");
ctx.togglePlayerControl();
chk(ctx.PLAYER.on && ctx.PLAYER.unit === h1, "再点「操控」就接管了它");

console.log("=== 三、ESC 退出操控 ===");
chk(raw.indexOf("if (PLAYER.on && PLAYER.unit) { togglePlayerControl(); return true; }") >= 0,
  "Esc 分支里优先处理退出操控");
ctx.togglePlayerControl();
console.log("  交还后：PLAYER.on=" + ctx.PLAYER.on + "，unit=" + (ctx.PLAYER.unit ? "有" : "无"));
chk(!ctx.PLAYER.on && !ctx.PLAYER.unit, "退出操控并交还 AI");

console.log("=== 四、查看状态不会挡住投放 ===");
chk(raw.indexOf("if (UI.selected) doPlace(UI.selected, wx, wy, batchCount());") >= 0,
  "有投放物时仍然优先投放，查看逻辑只在空手时生效");
chk(raw.indexOf("UI.peek = null;\n  centerCamera();") >= 0 || raw.indexOf("UI.peek = null;") >= 0,
  "重开场景会清掉查看状态");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
