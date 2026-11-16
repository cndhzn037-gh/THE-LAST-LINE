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

console.log("=== 一、配色 ===");
chk(raw.indexOf('CTX.fillStyle = "rgba(255,255,255," + a + ")";') >= 0, "KILL 字样是白色");
chk(raw.indexOf('p.big ? "rgba(255,214,90," + a + ")" : "rgba(255,255,255," + a + ")"') >= 0,
  "母体的 +100 才用金色，普通击杀白色");
chk(raw.indexOf('gold ? "rgba(255,214,90,"') >= 0, "累积总分突破后转金");

console.log("=== 二、突破 200 的脉冲 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 4;
ctx.buildScenario(3, 4);
ctx.W.over = false; ctx.W.paused = false;
ctx.W.score = { total: 0, shown: 0, t: 0, pulse: 0 };
ctx.W.pops.length = 0;
for (let i = 0; i < 19; i++) ctx.addScorePop(10, false);
console.log("  19 次 +10 之后：total=" + ctx.W.score.total + "，pulse=" + ctx.W.score.pulse);
chk(ctx.W.score.total === 190, "累计到 190");
chk(ctx.W.score.pulse === 0, "还没到 200，不弹");
ctx.addScorePop(10, false);
console.log("  再 +10（=200）：pulse=" + ctx.W.score.pulse);
chk(ctx.W.score.total === 200, "跨过 200");
chk(ctx.W.score.pulse > 0, "触发了放大缩小脉冲");
ctx.stepPops(0.5);
chk(ctx.W.score.pulse < 1 && ctx.W.score.pulse >= 0, "脉冲会自己衰减");

console.log("=== 三、累积数字是滚动追上去的 ===");
ctx.W.score = { total: 0, shown: 0, t: 0, pulse: 0 };
ctx.addScorePop(100, false);
const before = ctx.W.score.shown;
ctx.stepPops(1 / 60);
const after1 = ctx.W.score.shown;
console.log("  加 100 之后一帧：shown " + before.toFixed(1) + " → " + after1.toFixed(1) + "（total " + ctx.W.score.total + "）");
chk(after1 > before && after1 < 90, "不是瞬间跳到位，要追十几帧才到 100");
let frames = 0;
while (ctx.W.score.shown < 100 && frames < 200) { ctx.stepPops(1 / 60); frames++; }
console.log("  追满 100 用了 " + frames + " 帧（约 " + (frames / 60).toFixed(2) + " 秒）");
chk(frames > 8, "滚动过程肉眼可见");

console.log("=== 四、弹射动画三段 ===");
chk(raw.indexOf("var A = 0.16, B = 0.85;") >= 0, "分成弹射 / 停留 / 上浮三段");
chk(raw.indexOf("1 - Math.pow(1 - k, 2.6)") >= 0, "弹射用缓出曲线（先快后慢）");
chk(raw.indexOf("y = targetY;") >= 0, "中间有停留段");
chk(raw.indexOf("y = targetY - 46 * k2;") >= 0, "最后继续上移");
chk(raw.indexOf("a = 1 - k2;") >= 0, "上移的同时淡出");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
