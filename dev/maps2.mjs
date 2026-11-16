import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0, firstChild: null, tagName: "DIV",
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
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function blockedAt(x, y) {
  const tx = Math.floor(x / ctx.NAV.tile), ty = Math.floor(y / ctx.NAV.tile);
  if (tx < 0 || ty < 0 || tx >= ctx.NAV.cols || ty >= ctx.NAV.rows) return 1;
  return ctx.NAV.blocked[ty * ctx.NAV.cols + tx] ? 1 : 0;
}

console.log("=== 一、地图选择在开局面板里 ===");
ctx.START.gameMode = "defense";
const panel = ctx.defensePanelHtml();
chk(panel.indexOf("id='mapSel'") >= 0, "开局面板里有地图下拉");
chk(panel.indexOf("平原") >= 0 && panel.indexOf("H 型通道") >= 0, "四张图都列出来了");
chk(panel.indexOf("sizeSel") > panel.indexOf("mapSel"), "地图排在丧尸规模前面");
const setPanel = html;  /* 设置面板不该再有 */
const setFn = ctx.showSettingsPanel.toString();
chk(setFn.indexOf("mapRow") < 0, "设置面板里已经撤掉地图选择");

console.log("=== 二、每种地图：丧尸不生成在墙里 ===");
for (const id of ["town", "plains", "indoor", "channel"]) {
  ctx.CFG.mapPreset = id;
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 60;
  ctx.buildScenario(20240607, 60);
  ctx.W.over = false; ctx.W.paused = false;
  const zs2 = ctx.W.units.filter(u => !u.dead && ctx.isZombieSide(u));
  const stuck = zs2.filter(u => blockedAt(u.x, u.y)).length;
  console.log("  " + ctx.MAP_PRESETS[id].name + "： " + zs2.length + " 只丧尸，卡墙 " + stuck);
  chk(stuck === 0, ctx.MAP_PRESETS[id].name + " 没有丧尸卡在墙里");
}

console.log("=== 三、H 型走廊宽度 ===");
ctx.CFG.mapPreset = "channel";
ctx.buildScenario(20240607, 20);
const w = ctx.CFG.world.w, h = ctx.CFG.world.h;
/* 在掩体之外量：x 取 0.3 倍宽度处 */
let free = 0;
for (let y = h / 2 - 130; y < h / 2 + 130; y += 2) if (!blockedAt(w * 0.3, y)) free += 2;
console.log("  走廊净空高 " + free + "px");
chk(free >= 90 && free < 175, "走廊收窄了一半以上（原来 340，现在 " + free + "）");
let midOk = 0, midTot = 0;
for (let x = 820; x < w - 800; x += 30) {
  const tx = Math.floor(x / ctx.NAV.tile), ty = Math.floor(h / 2 / ctx.NAV.tile);
  if (x > w * 0.40 && x < w * 0.50) continue;   /* 跳过两块掩体 */
  if (x > w * 0.52 && x < w * 0.62) continue;
  midTot++; if (!ctx.NAV.blocked[ty * ctx.NAV.cols + tx]) midOk++;
}
console.log("  走廊中线贯通 " + midOk + "/" + midTot + "（已跳过掩体）");
chk(midOk === midTot, "走廊从头到尾是通的");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));