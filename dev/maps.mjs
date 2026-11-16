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

console.log("=== 一、四个预设都在 ===");
const ids = Object.keys(ctx.MAP_PRESETS);
console.log("  " + ids.map(i => ctx.MAP_PRESETS[i].name + " " + ctx.MAP_PRESETS[i].w + "×" + ctx.MAP_PRESETS[i].h).join("\n  "));
chk(ids.length === 4, "一共 4 张图");

for (const id of ids) {
  console.log("=== 生成：" + ctx.MAP_PRESETS[id].name + " ===");
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 40;
  ctx.CFG.mapPreset = id;
  ctx.buildScenario(20240607, 40);
  ctx.W.over = false; ctx.W.paused = false;
  const w = ctx.CFG.world.w, h = ctx.CFG.world.h;
  console.log("  地图 " + w + "×" + h + "，障碍 " + ctx.W.obstacles.length +
    "，人类 " + ctx.W.units.filter(u => !u.dead && ctx.isHuman(u)).length +
    "，丧尸 " + ctx.W.units.filter(u => !u.dead && ctx.isZombieSide(u)).length);
  chk(w === ctx.MAP_PRESETS[id].w && h === ctx.MAP_PRESETS[id].h, "尺寸对");
  chk(ctx.W.obstacles.length > 0, "有建筑");
  /* 跑几秒看会不会崩 */
  for (let i = 0; i < 180; i++) ctx.stepSim(1 / 60);
  const alive = ctx.W.units.filter(u => !u.dead);
  chk(alive.every(u => isFinite(u.x) && isFinite(u.y)), "跑 3 秒没有 NaN");
  chk(alive.every(u => u.x >= -20 && u.x <= w + 20 && u.y >= -20 && u.y <= h + 20), "单位都在地图内");
}

console.log("=== 二、H 型通道的结构 ===");
ctx.CFG.mapPreset = "channel";
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 20;
ctx.buildScenario(20240607, 20);
const cw = ctx.CFG.world.w, chh = ctx.CFG.world.h;
const cy = chh / 2 - 150;
/* 走廊正中应当可通行，上下两侧应当是墙 */
const mid = ctx.NAV.passable ? null : null;
/* 走廊中线：跳过掩体位置 */
let midBlocked = 0;
for (let x = 840; x < cw - 840; x += 60) {
  if (Math.abs(x - cw * 0.42) < 140 || Math.abs(x - (cw * 0.58 - 60)) < 140) continue;
  const tx = Math.floor(x / ctx.NAV.tile), ty = Math.floor(chh / 2 / ctx.NAV.tile);
  midBlocked += ctx.NAV.blocked[ty * ctx.NAV.cols + tx] ? 1 : 0;
}
/* 上下沿墙：贴着走廊边界取样 */
let edgeBlocked = 0;
const cGap = 170, cyTop = chh / 2 - cGap / 2;
for (let x = 840; x < cw - 840; x += 60) {
  const tx = Math.floor(x / ctx.NAV.tile);
  const tyUp = Math.floor((cyTop - 14) / ctx.NAV.tile);
  const tyDn = Math.floor((cyTop + cGap + 14) / ctx.NAV.tile);
  if (ctx.NAV.blocked[tyUp * ctx.NAV.cols + tx]) edgeBlocked++;
  if (ctx.NAV.blocked[tyDn * ctx.NAV.cols + tx]) edgeBlocked++;
}
console.log("  走廊中线被挡 " + midBlocked + "，上下沿封挡 " + edgeBlocked);
chk(midBlocked <= 2, "中间走廊是贯通的（" + midBlocked + " 个格子属于掩体边缘）");
chk(edgeBlocked > 0, "走廊上下沿是封死的");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));