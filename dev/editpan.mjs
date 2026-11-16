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

console.log("=== 一、编辑器里有「移动镜头」按钮 ===");
chk(raw.indexOf('data-tool="pan"') >= 0, "编辑栏里有平移工具按钮");
chk(raw.indexOf("✥ 移动镜头") >= 0, "按钮文字明确");
chk(raw.indexOf("单指拖动屏幕就是平移地图") >= 0, "带说明文字");

console.log("=== 二、平移工具不会触发编辑 ===");
ctx.EDIT.active = true;
ctx.EDIT.tool = "pan";
ctx.EDIT.dragging = false;
ctx.EDIT.hasCorner = false;
ctx.editPointerDown(2000, 1200);
chk(!ctx.EDIT.dragging, "按下时不会开始画框");
chk(!ctx.EDIT.hasCorner, "也不会落下矩形第一角");
ctx.EDIT.grabbed = null;
ctx.editPointerMove(2100, 1300);
chk(!ctx.EDIT.grabbed, "拖动时不会抓单位");

console.log("=== 三、切回地形工具后编辑照常 ===");
ctx.EDIT.tool = "house";
ctx.EDIT.mode = "corner";
ctx.EDIT.hasCorner = false;
ctx.editPointerDown(2000, 1200);
chk(ctx.EDIT.hasCorner, "房屋工具（两角模式）落下第一角");
ctx.editPointerDown(2200, 1400);
chk(!ctx.EDIT.hasCorner, "第二下完成矩形");
ctx.EDIT.mode = "drag";
ctx.EDIT.dragging = false;
ctx.editPointerDown(2000, 1200);
chk(ctx.EDIT.dragging, "拖拽模式下按下就开始框选");
ctx.EDIT.dragging = false;

console.log("=== 四、单指在编辑模式下被拦截的条件 ===");
chk(raw.indexOf('EDIT.tool !== "pan"') >= 0, "只有非平移工具才把单指交给编辑");
chk(raw.indexOf("手机上编辑地形必备") >= 0 || raw.indexOf("✥ 移动镜头") >= 0, "提示到位");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
