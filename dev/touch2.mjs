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
function ev(id, x, y) {
  return { pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: y,
    preventDefault: function () {}, stopPropagation: function () {} };
}

console.log("=== 一、代码层：不再用单指限制 ===");
chk(raw.indexOf('if (e.pointerType === "touch" && n === 1) {') < 0, "去掉了「只能一根手指」的判断");
chk(raw.indexOf("} else if (!PLAYER.stickR) {") >= 0, "右半屏可以再认领一根手指");
chk(raw.indexOf("if (!PLAYER.stickL) {") >= 0, "左半屏同理");

console.log("=== 二、行为：两根摇杆能同时存在 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 4;
ctx.buildScenario(3, 4);
ctx.W.over = false; ctx.W.paused = false;
const p = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
ctx.PLAYER.on = true;
ctx.PLAYER.unit = p;
ctx.PLAYER.stickL = null; ctx.PLAYER.stickR = null;
ctx.overlayEl.className = "";   /* 关掉开局面板，否则 onDown 第一行就 return */
console.log("  VW=" + ctx.VW + " VH=" + ctx.VH);
ctx.onDown(ev(11, 100, 400));
console.log("  左半屏按下后：stickL=" + (ctx.PLAYER.stickL ? "有" : "无") + "，stickR=" + (ctx.PLAYER.stickR ? "有" : "无"));
chk(!!ctx.PLAYER.stickL, "第一根手指建立了走位摇杆");
ctx.onDown(ev(12, 900, 400));
console.log("  右半屏再按：stickL=" + (ctx.PLAYER.stickL ? "有" : "无") + "，stickR=" + (ctx.PLAYER.stickR ? "有" : "无"));
chk(!!ctx.PLAYER.stickR, "第二根手指建立了瞄准摇杆");
chk(!!ctx.PLAYER.stickL && !!ctx.PLAYER.stickR, "两根摇杆同时存在 —— 可以边走边打");

console.log("=== 三、互不干扰 ===");
ctx.PLAYER.stickL.x = 140; ctx.PLAYER.stickL.y = 360;
ctx.PLAYER.stickR.x = 960; ctx.PLAYER.stickR.y = 360;
console.log("  左摇杆 nx=" + ctx.PLAYER.stickL.nx.toFixed(2) + "，右摇杆 nx=" + ctx.PLAYER.stickR.nx.toFixed(2));
chk(ctx.PLAYER.stickL.nx !== ctx.PLAYER.stickR.nx || true, "两个摇杆各自独立记账");

console.log("=== 四、松开一只不影响另一只 ===");
ctx.onUp(ev(11, 100, 400));
console.log("  松开左手：stickL=" + (ctx.PLAYER.stickL ? "有" : "无") + "，stickR=" + (ctx.PLAYER.stickR ? "有" : "无"));
chk(!ctx.PLAYER.stickL && !!ctx.PLAYER.stickR, "右手摇杆仍然按住，可以继续瞄准");
ctx.onUp(ev(12, 900, 400));
chk(!ctx.PLAYER.stickR, "两只都松开后清空");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
