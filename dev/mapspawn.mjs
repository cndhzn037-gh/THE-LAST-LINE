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
/* 在出生区里撒点，看有多少比例落在墙里 */
function zoneBlockRatio(zs) {
  let tot = 0, blk = 0;
  for (let x = zs.x + 10; x < zs.x + zs.w - 10; x += 20) {
    for (let y = zs.y + 10; y < zs.y + zs.h - 10; y += 20) { tot++; blk += blockedAt(x, y); }
  }
  return tot ? blk / tot : 1;
}

for (const id of ["town", "plains", "indoor", "channel"]) {
  console.log("=== " + ctx.MAP_PRESETS[id].name + " ===");
  ctx.CFG.mapPreset = id;
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 60;
  ctx.buildScenario(20240607, 60);
  ctx.W.over = false; ctx.W.paused = false;
  const zs = ctx.mapSpawnZone(id);
  const ratio = zoneBlockRatio(zs);
  console.log("  出生区 " + Math.round(zs.x) + "," + Math.round(zs.y) + "  " +
    Math.round(zs.w) + "×" + Math.round(zs.h) + "  被墙挡住的比例 " + (ratio * 100).toFixed(0) + "%");
  chk(ratio < 0.05, "出生区里基本没有墙");

  const zs2 = ctx.W.units.filter(u => !u.dead && ctx.isZombieSide(u));
  const stuck = zs2.filter(u => blockedAt(u.x, u.y)).length;
  console.log("  生了 " + zs2.length + " 只丧尸，其中卡在墙里的 " + stuck);
  chk(stuck === 0, "没有丧尸生成在墙里");
}

console.log("=== H 型：走廊宽度与贯通 ===");
ctx.CFG.mapPreset = "channel";
ctx.buildScenario(20240607, 40);
const w = ctx.CFG.world.w, h = ctx.CFG.world.h;
let free = 0;
for (let y = h / 2 - 120; y < h / 2 + 120; y += 4) if (!blockedAt(w / 2, y)) free += 4;
console.log("  地图正中一竖线上的净空高度 " + free + "px（走廊设定 170）");
chk(free >= 150 && free <= 200, "走廊确实收窄到 170 左右");

let midOk = 0, midTot = 0;
for (let x = 820; x < w - 800; x += 40) { midTot++; if (!blockedAt(x, h / 2)) midOk++; }
console.log("  走廊中线贯通率 " + midOk + "/" + midTot);
chk(midOk === midTot, "走廊从头到尾是通的");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));