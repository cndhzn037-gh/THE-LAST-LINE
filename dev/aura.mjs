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

console.log("=== 一、批量升格不再逐个放特效 ===");
chk(raw.indexOf("function promoteHero(u, kind, quiet)") >= 0, "升格函数支持 quiet");
chk(raw.indexOf("if (quiet) return;") >= 0, "quiet 时跳过冲击波/金字/toast");
chk(raw.indexOf('promoteHero(squad[i], squad[i].kind === "civilian" ? "civilian" : "armed", true);') >= 0,
  "帝皇特使批量升格走静默");
chk(raw.indexOf('addShock(r.cx, r.cy, CFG.fearRCivilian * CFG.hero.shockR * 1.15, "rgba(255,215,90,1)");') >= 0,
  "整批只统一放一次冲击波");

console.log("=== 二、光环按人数降级 ===");
chk(raw.indexOf("W.auraCount = an;") >= 0, "每帧统计平民英雄数量");
chk(raw.indexOf("var AURA_CIRCLES = [];") >= 0, "把所有光环/护盾收集到同一个列表");
chk(raw.indexOf("AURA_CIRCLES.push({ x: ux, y: uy, r: fearRadiusOf(u) * CFG.hero.auraR * z") >= 0,
  "光环不再逐个直接画，改成收集");
chk(raw.indexOf("AURA_CIRCLES.push({ x: ux, y: uy, r: CFG.fearRCivilian * z") >= 0, "护盾同样收集");
chk(raw.indexOf("g.globalCompositeOperation = \"destination-out\";") >= 0,
  "用「并集 − 内缩并集」求最外轮廓，圆之间的交线被抹掉");
chk(raw.indexOf("CTX.globalAlpha = 0.06;") >= 0, "填充只画一次，重叠区不加深");
chk(raw.indexOf("drawAuraCircles();") >= 0, "在单位循环之后统一绘制");

console.log("=== 三、数值感受 ===");
for (const n of [1, 2, 5, 10, 25]) {
  const k = Math.min(1, 1 / Math.sqrt(n));
  const fill = (n <= 2) ? 0.09 : (n <= 5 ? 0.045 : 0);
  const line = 0.18 + 0.37 * k;
  const stack = 1 - Math.pow(1 - (fill * k), n);   // 中心叠加后的实际色浓度
  console.log("  " + String(n).padStart(2) + " 个英雄：描边 " + line.toFixed(2) +
    "，填充 " + fill + "，中心叠加浓度约 " + (stack * 100).toFixed(0) + "%");
}

console.log("=== 四、升格本身照常生效 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 4;
ctx.buildScenario(3, 4);
ctx.W.over = false; ctx.W.paused = false;
const c1 = ctx.W.units.find(u => !u.dead && u.kind === "civilian");
ctx.promoteHero(c1, "civilian", true);
chk(c1.hero === "civilian", "静默模式下依然完成升格");
chk(ctx.W.heroTexts.length === 0, "但不塞头顶金字");
ctx.render();
console.log("  渲染后 auraCount = " + ctx.W.auraCount);

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
