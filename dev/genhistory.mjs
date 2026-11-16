import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0, firstChild: null,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720;
sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(gcode, ctx, { name: "game.js" });

/* 朴素格式：空行分段，条目从 1 开始编号，不用任何符号装饰 */
let out = "";
out += "丧尸沙盘 历代更新记录\n";
out += "当前版本 " + ctx.GAME_VERSION + "\n";
out += "共 " + ctx.PATCH_VERSIONS.length + " 个版本，从新到旧\n";

for (const V of ctx.PATCH_VERSIONS) {
  out += "\n\n";
  out += V.v + "  " + V.d + "  " + V.title + "\n\n";
  V.items.forEach((it, idx) => { out += (idx + 1) + "、" + it + "\n"; });
}

out += "\n\n";
out += "补充说明\n\n";
out += "游戏里的更新公告只显示最近三个版本。\n";
out += "更早的记录在菜单的帮助与其它里，点版本号详情能看到全部。\n";

fs.writeFileSync("E:\\开发小游戏\\HTML 代码文件夹\\历代更新.txt", out, "utf8");
const total = ctx.PATCH_VERSIONS.reduce((a, v) => a + v.items.length, 0);
console.log("已写入历代更新.txt");
console.log("  " + ctx.PATCH_VERSIONS.length + " 个版本，" + total + " 条细则，" + out.length + " 字符");
console.log("  含横杠分隔线: " + (out.indexOf("----") >= 0));
console.log("  含点符号: " + (out.indexOf("·") >= 0));
console.log("  含井号或星号: " + (out.indexOf("#") >= 0 || out.indexOf("**") >= 0));