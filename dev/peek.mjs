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

console.log("=== 一、没接管时点击先用来选人 ===");
chk(typeof ctx.pickPeekUnit === "function", "有「点人选查看」的辅助函数");
chk(raw.indexOf("if (!playerUnitValid()) {") >= 0, "鼠标/触摸按下时先判断有没有接管人");
chk(raw.indexOf("UI.peek = hk;") >= 0, "点中人类单位会记进 UI.peek");
chk(raw.indexOf("再点一次「操控」即可接管") >= 0, "提示告诉玩家下一步怎么接管");

console.log("=== 二、选中后再点操控就接管 ===");
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
console.log("  点中：" + (picked ? picked.kind + " #" + picked.id : "无"));
chk(picked === h1 || (picked && picked.kind === "rifle"), "点中了人类单位");
ctx.PLAYER.on = false; ctx.PLAYER.unit = null;
ctx.UI.peek = h1;
ctx.togglePlayerControl();
console.log("  点「操控」之后：PLAYER.on=" + ctx.PLAYER.on + "，接管对象=" +
  (ctx.PLAYER.unit ? "#" + ctx.PLAYER.unit.id : "无"));
chk(ctx.PLAYER.on && ctx.PLAYER.unit === h1, "已选中的人被直接接管");
chk(!ctx.UI.peek, "接手后清掉「查看」状态");

console.log("=== 三、再点一次操控 = 交还 ===");
ctx.togglePlayerControl();
console.log("  再点一次：PLAYER.on=" + ctx.PLAYER.on + "，unit=" + (ctx.PLAYER.unit ? "有" : "无"));
chk(!ctx.PLAYER.on && !ctx.PLAYER.unit, "关闭操控并交还 AI");

console.log("=== 四、查看状态会显示读数，但不画瞄准线 ===");
chk(raw.indexOf("var controlling = (playerUnitValid() && PLAYER.unit === u);") >= 0, "区分「操控」与「查看」");
chk(raw.indexOf("var len = controlling ? fearRadiusOf(u) * 1.5 : 0;") >= 0, "查看状态不画瞄准线");
chk(raw.indexOf("AI 接管中 · 状态查看") >= 0, "查看状态有明确标识与血条");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
