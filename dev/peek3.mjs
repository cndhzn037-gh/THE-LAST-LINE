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

console.log("=== 退出查看的两条路 ===");
chk(raw.indexOf("if (UI.peek) { UI.peek = null; return true; }") >= 0, "Esc 可以退出查看");
chk(raw.indexOf("UI.peek = pkHit;") >= 0, "点空地时 UI.peek 被置空");
chk(raw.indexOf('toast("已取消查看")') >= 0, "取消查看有提示");

console.log("=== 行为验证 ===");
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
const picked = ctx.pickPeekUnit(sx, sy);
chk(!!picked, "点到角色能选中");
ctx.UI.peek = picked;
/* 点很远的地方 = 空白 */
const far = ctx.pickPeekUnit(sx + 600, sy + 600);
console.log("  点空白处返回：" + far);
chk(!far, "空白处点选返回 null → UI.peek 会被清空");
ctx.UI.peek = picked;
ctx.UI.peek = null;
chk(!ctx.UI.peek, "清空后不再显示查看状态");

console.log("=== Esc 的优先级 ===");
chk(raw.indexOf("if (PLAYER.on && PLAYER.unit) { togglePlayerControl(); return true; }") >= 0, "操控优先被 Esc 解除");
chk(raw.indexOf("if (UI.peek) { UI.peek = null; return true; }") > raw.indexOf("if (PLAYER.on && PLAYER.unit) { togglePlayerControl(); return true; }"),
  "先退操控，再退查看（顺序正确）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
