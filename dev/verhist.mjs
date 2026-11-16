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
vm.runInContext(gcode, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }

console.log("=== 一、版本库完整 ===");
const V = ctx.PATCH_VERSIONS;
console.log("  共 " + V.length + " 个版本：" + V.map(v => v.v + "(" + v.d + ")").join(" / "));
chk(V.length >= 4, "版本库里有 " + V.length + " 个版本");
chk(ctx.GAME_VERSION === V[0].v, "当前版本号与列表最新的那个一致");

console.log("=== 二、公告只显示最近 3 个 ===");
const note = ctx.patchNoteHtml();
const noteHeads = (note.match(/class='verHead'/g) || []).length;
console.log("  公告里 " + noteHeads + " 段");
chk(noteHeads === 3, "公告只放三次");
chk(note.indexOf(V[0].v) < note.indexOf(V[2].v), "最新的排最前");

console.log("=== 三、历史详情一条不落 ===");
const hist = ctx.patchHistoryHtml();
chk(V.every(v => hist.indexOf(v.v) >= 0), "每个版本号都在历史里");
chk(V.every(v => hist.indexOf(v.d) >= 0), "每个日期都在");
console.log("  历史面板 HTML 长度 " + hist.length + " 字");
chk((hist.match(/class='verHead'/g) || []).length === V.length, "历史里放了全部 " + V.length + " 个版本");
chk(hist.indexOf("1.0.0") >= 0, "最早的 1.0.0 也留着");

console.log("=== 四、加点新版本后仍然只显示 3 个，但历史会变长 ===");
V.unshift({ v: "1.4.0", d: "2026-11-01", title: "测试版", items: ["测试条目"] });
const note2 = ctx.patchNoteHtml();
const hist2 = ctx.patchHistoryHtml();
chk((note2.match(/class='verHead'/g) || []).length === 3, "公告还是 3 段");
chk((hist2.match(/class='verHead'/g) || []).length === V.length, "历史跟着变长（" + V.length + " 段）");
chk(note2.indexOf("1.4.0") >= 0 && note2.indexOf("1.1.0") < 0, "最老的那个被挤出公告");
chk(hist2.indexOf("1.1.0") >= 0, "但历史里还在，没被删");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));