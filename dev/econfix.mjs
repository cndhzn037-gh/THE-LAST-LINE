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
const raw = html;
const CFG = ctx.CFG;

console.log("=== 一、资源上限 ===");
console.log("  上限 " + CFG.econ.cap + "，赐福价格 " + CFG.hero.cost);
chk(CFG.econ.cap > CFG.hero.cost * 10, "上限远高于最贵的项目");
chk(raw.indexOf("Math.min(9999") < 0, "不再卡在 9999");

console.log("=== 二、淘汰播报顺序 ===");
chk(raw.indexOf("var startX = x - total;") >= 0, "从左端开始排版");
chk(raw.indexOf('CTX.fillText(f.k, startX, y);') >= 0, "击杀者在最左");
chk(raw.indexOf('CTX.fillText(f.v, startX + wK + wG, y);') >= 0, "被击杀者在最右");

ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 4;
ctx.buildScenario(3, 4);
ctx.W.over = false; ctx.W.paused = false;
const p = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
const v = ctx.addUnit("zombie", p.x + 100, p.y);
v.hp = 1;
ctx.rebuildGrids();
ctx.W.feed.length = 0;
ctx.damageZombie(v, 99, p);
const f0 = ctx.W.feed[0];
console.log("  一条播报：" + f0.k + " ｜ " + f0.gun + " ｜ " + f0.v);
chk(f0.k === "步枪兵", "击杀者是步枪兵");
chk(f0.v === "丧尸", "被击杀的是丧尸");

console.log("=== 三、得分消散后归零 ===");
ctx.W.score = { total: 0, shown: 0, t: 0, pulse: 0 };
ctx.addScorePop(30, false);
chk(ctx.W.score.total === 30, "先累计 30");
for (let i = 0; i < 60 * 5; i++) ctx.stepPops(1 / 60);
console.log("  5 秒之后：total=" + ctx.W.score.total + "，shown=" + ctx.W.score.shown + "，t=" + ctx.W.score.t.toFixed(2));
chk(ctx.W.score.total === 0, "总分回到 0，下一次击杀重新累计");
chk(ctx.W.score.shown === 0, "显示值也归零");
ctx.addScorePop(10, false);
chk(ctx.W.score.total === 10, "重新开始从 10 累计");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
