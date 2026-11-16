import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { const el = { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0, firstChild: null,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null };
  return el; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, Event: function(){}.constructor, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720;
sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(gcode, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
const raw = html;

console.log("=== 一、菜单顶层收成 5 项 ===");
const topLevel = ["bSave", "bLoad", "bExport", "bImport", "bRestart", "bMarket", "bNet",
                  "bFireMode", "bDirector", "bSettings", "bHelp"];
chk(raw.indexOf('id="bSettings"') >= 0 && raw.indexOf('id="bHelp"') >= 0, "设置 / 帮助 两个入口都在");
chk(raw.indexOf('<div class="grp">排查问题</div>') < 0, "原来的分组标签已经撤掉");
chk(raw.indexOf('id="settingBag"') >= 0, "有统一的控件容器");

console.log("=== 二、亮度功能 ===");
chk(typeof ctx.setBrightness === "function", "有 setBrightness");
chk(ctx.CFG.brightness === 1, "默认亮度 1.0");
ctx.setBrightness(0.6);
chk(Math.abs(ctx.CFG.brightness - 0.6) < 0.001, "能调到 0.6");
chk(store["zombieSandbox.bright"] === "0.6", "调完会记到本地");
ctx.setBrightness(9);
chk(ctx.CFG.brightness === 1.5, "超出范围会夹到上限");
ctx.setBrightness(0.1);
chk(ctx.CFG.brightness === 0.5, "低于下限会夹到 0.5");
ctx.setBrightness(1);
store["zombieSandbox.bright"] = "1.3";
ctx.loadBrightness();
chk(Math.abs(ctx.CFG.brightness - 1.3) < 0.001, "下次打开能读回上次的亮度");

console.log("=== 三、亮度只压战场 ===");
chk(raw.indexOf("画面亮度：压在世界层之上、界面之下") >= 0, "亮度层画在界面之前");
chk(raw.indexOf("drawRatioBar();") > raw.indexOf("画面亮度：压在世界层之上"), "占比条在亮度之后，不会被一起压暗");

console.log("=== 四、设置面板能打开 ===");
chk(typeof ctx.showSettingsPanel === "function", "有 showSettingsPanel");
chk(typeof ctx.showMorePanel === "function", "有 showMorePanel");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));