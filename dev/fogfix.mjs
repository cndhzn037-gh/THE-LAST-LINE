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

console.log("=== 一、视野朝向阻尼 ===");
console.log("  AI 单位：锁定 " + CFG.fog.turnLock + "s，跟随系数 " + CFG.fog.turnSmooth);
console.log("  玩家操控的单位：实时（无阻尼）");
chk(CFG.fog.turnLock > 0 && CFG.fog.turnLock <= 0.2, "AI 单位的锁定期很短，不会拖沓");
chk(CFG.fog.turnSmooth >= 0.3, "AI 单位跟随足够灵敏");
chk(raw.indexOf("u.fogAng = u.faceAng;") >= 0, "玩家操控时视野直接跟手");
chk(raw.indexOf("var isPlayer = (PLAYER.on && PLAYER.unit === u && !u.dead);") >= 0, "按「是不是玩家」分两套");
chk(raw.indexOf("u.fogLock = u.faceAng") >= 0, "AI 单位仍有「锁定目标」这一层");

console.log("=== 二、视野距离与远端过渡 ===");
const want = CFG.far.r * CFG.fog.rangeMul;
console.log("  射程 " + CFG.far.r + " × " + CFG.fog.rangeMul + " = " + want.toFixed(0) + "px（配置上限 " + CFG.fog.range + "）");
chk(want >= CFG.far.r * 7, "目标是射程的七八倍");
chk(raw.indexOf("var screenDiag = Math.sqrt(VW * VW + VH * VH)") >= 0, "超出屏幕的部分按对角线裁剪，不做无用计算");

console.log("=== 三、UI 不再被迷雾罩住 ===");
const iFog = raw.indexOf("  drawFog(z);\n  /* 底部：阵营兵种占比条 */");
const iRatio = raw.indexOf("drawRatioBar();");
console.log("  迷雾调用位置 " + iFog + "，占比条位置 " + iRatio);
chk(iFog > 0 && iFog < iRatio, "迷雾在所有 UI 之前绘制");

console.log("=== 四、淘汰播报的宽度测量 ===");
chk(raw.indexOf("if (_feedFont !== font) { CTX.font = font; _feedFont = font; }") >= 0,
  "量宽度前先把字体设成本行要用的那个");
chk(raw.indexOf("function feedTextW(s, fs, bold)") >= 0, "支持粗体/常规两种字体");
console.log("  原因：measureText 量的是「当前字体」，不先设置就会用到上一次遗留的字体，长文本宽度被算歪");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
