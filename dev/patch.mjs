import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { const el = { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0,
  addEventListener: function (ev, fn) { (el._h = el._h || {})[ev] = fn; }, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null, fire: function (ev) { if (el._h && el._h[ev]) el._h[ev]({ preventDefault: noop }); } };
  return el; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN, Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } }, document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(gcode, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
const raw = html;
const P = els["patchNote"];

console.log("=== 一、结构和层级 ===");
chk(!!raw.match(/id="patchNote"/), "有公告层的 DOM");
chk(raw.indexOf('id="patchX"') >= 0, "右上角有关闭的叉");
chk(raw.indexOf('id="patchOk"') >= 0, "最下方有「关闭」按钮");
chk(raw.indexOf('id="patchBody"') >= 0, "有独立的内容区");
const zPatch = Number((raw.match(/#patchNote\{[^}]*z-index:(\d+)/) || [])[1]);
const zOverlay = Number((raw.match(/#overlay\{[^}]*z-index:(\d+)/) || [])[1]);
console.log("  公告层 z-index=" + zPatch + "，开局选项层 z-index=" + zOverlay);
chk(zPatch > zOverlay, "公告盖在开局选项之上");
chk(raw.indexOf("overflow-y:auto") >= 0 && raw.indexOf("touch-action:pan-y") >= 0, "内容区可以上下滑动（含触摸）");

console.log("=== 二、第一次打开会弹 ===");
chk(ctx.GAME_VERSION.length > 0, "版本号 " + ctx.GAME_VERSION);
chk(P.className === "show", "首次进入就弹了出来");
console.log("  标题：" + els["patchSub"].textContent);
chk(els["patchSub"].textContent.indexOf(ctx.GAME_VERSION) >= 0, "副标题带版本号");
const body = els["patchBody"].innerHTML;
console.log("  正文长度 " + body.length + " 字");
chk(body.length > 500, "内容够长，确实需要滑动");
/* 这些关键词散落在不同版本里，公告只留最近三次，所以改到完整记录里查 */
const hist = ctx.patchHistoryHtml();
["军需商城", "自爆丧尸", "医疗兵", "舔舐者", "丧尸阵营", "联机对战", "地图预设", "配色主题"].forEach(function (k) {
  chk(hist.indexOf(k) >= 0, "历史里写到了「" + k + "」");
});
/* 语气检查：官方公告里不该出现面向玩家说话的口语词 */
const spoken = ["不必先", "一轮接一轮", "就能配装", "打不死", "你", "咱", "了。换成"];
spoken.forEach(function (w) {
  chk(body.indexOf(w) < 0, "没有口语词「" + w + "」");
});
/* 版本分段之后，"调整为" 不一定每次都出现，改成检查更基础的两类陈述 */
chk(body.indexOf("新增") >= 0 && body.indexOf("修复") >= 0, "同时写了新增与修复两类内容");
/* 新版公告按版本分段：每个版本一个 verHead 中标题 */
const heads = (body.match(/class='verHead'/g) || []).length;
console.log("  共 " + heads + " 个版本段");
chk(heads === 3, "公告里只保留最近 3 个版本");
/* 倒序不再写死具体版本号，改成和版本库的前三个逐位比对 */
const vsInBody = (body.match(/\d+\.\d+\.\d+/g) || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
const vsExpect = ctx.PATCH_VERSIONS.slice(0, 3).map(function (v) { return v.v; });
chk(vsInBody.join(",") === vsExpect.join(","), "版本号按日期倒序排下来了（" + vsInBody.join(" / ") + "）");
/* 不再写死具体版本号：取三个版本标题的先后，和版本库前三个比对 */
const headsOrder = (body.match(/class='verHead'>[^<]+</g) || []).map(function (s) {
  return s.replace(/^class='verHead'>/, "").replace(/</, "").replace(/\s*·.*/, "").trim();
});
chk(headsOrder.join(",") === vsExpect.join(","), "最新的排在最上面（" + headsOrder.join(" / ") + "）");

console.log("=== 三、两种关法都行 ===");
els["patchOk"].fire("click");
chk(P.className === "", "底部「关闭」能关掉");

console.log("=== 四、每次刷新都重新弹 ===");
ctx.maybeShowPatch();
chk(P.className === "show", "关掉之后再刷新（重新 boot）还会弹");
els["patchX"].fire("click");
chk(P.className === "", "右上角的叉也能关");
chk(raw.indexOf("localStorage.getItem(PATCH_KEY)") < 0, "不再按本地记录决定弹不弹");

console.log("=== 五、菜单里随时能再打开 ===");
chk(raw.indexOf('id="bPatch"') >= 0, "菜单里有「更新公告」按钮");
chk(raw.indexOf('$("bPatch")') >= 0, "按钮已经接上打开逻辑");
ctx.showPatchNote();
chk(P.className === "show", "调用打开函数就能重新显示");
chk(els["patchBody"].scrollTop === 0, "重新打开时滚回顶部");
els["patchOk"].fire("click");
chk(P.className === "", "再次关闭正常");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));