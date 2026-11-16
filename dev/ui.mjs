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

console.log("=== 一、界面结构都在 ===");
const must = [
  ["顶部菜单按钮", 'id="bMenu"'],
  ["菜单弹层", 'id="menuPop"'],
  ["新手引导条", 'id="tips"'],
  ["规模下拉", "id='sizeSel'"],
  ["首屏容器", "#panel.home"],
  ["折叠项样式", "#panel details"],
  ["编辑栏分组标签", 'data-gtab="terrain"'],
  ["坚守按钮", 'data-cue="garrison"']
];
for (const [name, frag] of must) chk(raw.indexOf(frag) >= 0, name + " 在文件里（" + frag + "）");
const menuIds = ["bSave", "bLoad", "bExport", "bImport", "bRestart", "bHelp", "bDebug", "debugSel", "volRange"];
const menuStart = raw.indexOf('id="menuPop"');
const menuEnd = raw.indexOf("</div>", raw.indexOf("bHelp"));
let allInMenu = true;
for (const id of menuIds) {
  const p = raw.indexOf('id="' + id + '"');
  if (p < 0 || p < menuStart || p > menuEnd + 200) allInMenu = false;
}
chk(allInMenu, "存档/读档/导出/导入/重开/帮助/调试/音量都收进了菜单弹层");
chk(raw.indexOf('id="bRestart"') > menuStart, "重开已从底栏移到菜单");

console.log("=== 二、关键函数存在 ===");
for (const fn of ["showHome", "showStartPanel", "showHelp", "setEditGroup", "showTutor", "hideTutor", "tutorNext", "tutorSeen"]) {
  chk(typeof ctx[fn] === "function", fn + "() 已定义");
}

console.log("=== 三、三个面板都能渲染且不抛错 ===");
let err = null;
try { ctx.showHome(); } catch (e) { err = e; }
chk(!err, "首屏渲染通过" + (err ? "：" + err.message : ""));
chk(ctx.panelEl.className === "home", "首屏用 home 样式（更宽松的排版）");
chk(String(ctx.panelEl.innerHTML).indexOf("防线作战") >= 0, "首屏列出了三种模式");
chk(String(ctx.panelEl.innerHTML).indexOf("直接开打") >= 0, "首屏有醒目的一键开始按钮");
err = null;
try { ctx.showStartPanel(); } catch (e) { err = e; }
chk(!err, "设置页渲染通过" + (err ? "：" + err.message : ""));
chk(ctx.panelEl.className === "", "从首屏进设置页时样式被换回普通面板");
const sh = String(ctx.panelEl.innerHTML);
chk(sh.indexOf("返回主页") >= 0, "设置页有返回主页的入口");
chk(sh.indexOf("<details>") >= 0, "进阶项被收进折叠块");
chk(sh.indexOf("data-add=") < 0, "十几个增数按钮已经收进下拉，不再平铺");
chk(sh.indexOf("goEdit") >= 0 && sh.indexOf("goStart") >= 0, "编辑地形 / 开始战斗都在");
err = null;
try { ctx.showHelp(); } catch (e) { err = e; }
chk(!err, "帮助面板渲染通过" + (err ? "：" + err.message : ""));
chk(String(ctx.panelEl.innerHTML).indexOf("三条最要紧的") >= 0, "帮助第一屏只讲三条要点");
chk(String(ctx.panelEl.innerHTML).indexOf("<details>") >= 0, "完整说明被折叠起来");

console.log("=== 四、编辑栏分组切换 ===");
const groups = ["terrain", "unit", "level", "route", "misc"];
for (const g of groups) {
  err = null;
  try { ctx.setEditGroup(g); } catch (e) { err = e; }
  chk(!err && ctx.EDIT_GROUP === g, "切到「" + g + "」组不报错");
}

console.log("=== 五、新手引导五步走 ===");
const stepsN = ctx.tutorSteps().length;
chk(stepsN === 5, "教程现在有 " + stepsN + " 步");
ctx.showTutor(0);
chk(ctx.TUTOR.on === true && ctx.TUTOR.i === 0, "第 1 步已弹出");
chk(String(ctx.document.getElementById("tipsB").innerHTML).length > 10, "第 1 步有正文");
for (let i = 1; i < stepsN; i++) {
  ctx.tutorNext();
  chk(ctx.TUTOR.i === i && ctx.TUTOR.on, "下一步 → 第 " + (i + 1) + " 步");
}
ctx.tutorNext();
chk(ctx.TUTOR.on === false, "最后一步之后自动收起");
chk(ctx.tutorSeen() === true, "看过一次就记下来，不再重复打扰");
ctx.showTutor(0);
ctx.hideTutor();
chk(ctx.TUTOR.on === false, "跳过按钮立刻收起");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
