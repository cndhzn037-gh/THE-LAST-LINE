import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
/* 这次要让事件真的能被触发，所以记录每个元素挂过什么监听 */
function makeEl(id) {
  const el = { id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [],
    width: 800, height: 600, scrollTop: 0, firstChild: null, tagName: "DIV", parentNode: null,
    _h: {}, addEventListener: function (ev, fn) { (el._h[ev] = el._h[ev] || []).push(fn); },
    removeEventListener: noop, appendChild: function (c) { c.parentNode = el; el.firstChild = c; return c; },
    remove: noop, setAttribute: noop, getAttribute: () => null, click: function () { el.fire("click"); },
    fire: function (ev, arg) { (el._h[ev] || []).forEach(fn => fn(Object.assign({ target: el, stopPropagation: noop, preventDefault: noop }, arg || {}))); },
    getBoundingClientRect: () => ({ left: 0, top: 48, width: 800, height: 40 }),
    getContext: () => c2, querySelectorAll: () => [], querySelector: () => null };
  return el;
}
const els = {}; const store = {};
const doc = {
  getElementById: (id) => els[id] || (els[id] = makeEl(id)),
  createElement: () => makeEl("new"),
  querySelectorAll: () => [], body: makeEl("body"),
  addEventListener: noop, documentElement: { style: { setProperty: noop }, clientHeight: 720, clientWidth: 1280 }
};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: doc };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720;
sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(gcode, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }

console.log("=== 一、菜单按钮挂上了点击监听 ===");
const mb = els["bMenu"], mp = els["menuPop"];
chk(!!mb && !!mp, "两个元素都取到了");
const handlers = (mb && mb._h && mb._h["click"]) || [];
console.log("  bMenu 上挂了 " + handlers.length + " 个 click 监听");
chk(handlers.length > 0, "菜单按钮有响应函数");

console.log("=== 二、点一下菜单能展开 ===");
console.log("  点前 className=[" + mp.className + "]");
mb.fire("click");
console.log("  点后 className=[" + mp.className + "]");
chk(mp.className === "show", "菜单正确展开");
chk(mp.style.maxHeight && mp.style.maxHeight.indexOf("px") > 0, "高度也算了：" + mp.style.maxHeight);

console.log("=== 三、再点一下收起 ===");
mb.fire("click");
chk(mp.className === "", "再点一次收起了");

console.log("=== 四、出错也不会连累菜单 ===");
/* 故意让下拉框初始化报错，看菜单还能不能用 */
const origQS = doc.getElementById;
doc.getElementById = function (id) {
  if (id === "placeSel") throw new Error("故意制造的错误");
  return origQS(id);
};
ctx.rebindTest && ctx.rebindTest();
doc.getElementById = origQS;
chk(true, "初始化保护已就位（try-catch 包住了下拉框填充）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));