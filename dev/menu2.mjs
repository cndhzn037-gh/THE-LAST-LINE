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

console.log("=== 一、战争迷雾默认关闭 + 标注 ===");
chk(CFG.fog.on === false, "默认不开启");
chk(raw.indexOf("实验性功能") >= 0, "菜单里标注了「实验性功能」");

console.log("=== 二、键位设置进菜单 ===");
chk(raw.indexOf('id="bKeys"') >= 0, "菜单里有「键位设置」入口");
chk(raw.indexOf('bKeys.addEventListener("click", showBindPanel)') >= 0, "点击打开键位面板");

console.log("=== 三、开火模式可改键 ===");
const fm = ctx.KEY_ACTS.filter(a => a.id === "fireMode")[0];
console.log("  fireMode 默认键 " + (fm ? fm.def : "无") + "，分组 " + (fm ? fm.g : "-"));
chk(!!fm, "开火模式是一个可绑定的动作");
chk(fm && fm.g === "game", "归在全局操作组");
chk(raw.indexOf('case "fireMode":') >= 0, "有对应的处理分支");
chk(raw.indexOf('if (DIRECTOR.on) { directorDoAction("face"); return true; }') >= 0,
  "空手时退回剧情「朝向」，一键两用");

console.log("=== 四、护送刷怪按兵力缩放 ===");
ctx.W.squadSize = 5;
const k5 = ctx.escortSquadScale();
ctx.W.squadSize = 1;
const k1 = ctx.escortSquadScale();
ctx.W.squadSize = 10;
const k10 = ctx.escortSquadScale();
console.log("  5 人 = " + k5.toFixed(2) + "，1 人 = " + k1.toFixed(2) + "，10 人 = " + k10.toFixed(2));
chk(Math.abs(k5 - 1) < 0.01, "5 人是基准 1.0");
chk(k1 < 0.5, "单人进场的刷怪量不到一半");
chk(k10 > k5, "人多时压力相应上升");
chk(k1 >= 0.4, "但保留下限，不至于完全不刷");
chk(raw.indexOf("W.squadSize = LAST_SQUAD.length") >= 0, "开局会记下小队规模");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
