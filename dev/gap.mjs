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
console.log("世界 " + ctx.CFG.world.w + "x" + ctx.CFG.world.h + "，tile=" + ctx.NAV.tile);

function ob(x, y, w, h) { return ctx.makeObstacle(x, y, w, h, "wall"); }
function setMap(obs) {
  ctx.W.obstacles = obs;
  ctx.NAV.build(ctx.CFG.world, obs, 9);
  ctx.analyzeTerrain(true);
}
function nearestGap(x, y) {
  const g = ctx.TERRAIN.gaps;
  if (!g.length) return null;
  let best = null, bd = 1e9;
  for (const q of g) { const d = Math.hypot(x - q.x, y - q.y); if (d < bd) { bd = d; best = q; } }
  return { g: best, d: bd };
}
function gapDist(p) { const n = nearestGap(p.x, p.y); return n ? n.d : -1; }
function show(p) { return p ? "(" + p.x.toFixed(0) + "," + p.y.toFixed(0) + ")" : "null"; }

console.log("\n=== 一、空地图不该有缺口 ===");
setMap([]);
console.log("  缺口数 " + ctx.TERRAIN.gaps.length);
chk(ctx.TERRAIN.gaps.length === 0, "空旷地图识别出 0 个缺口");

console.log("\n=== 二、房间 + 3 格宽缺口 ===");
const room = [
  ob(1800, 1200, 600, 32), ob(1800, 1768, 600, 32), ob(2368, 1232, 32, 536),
  ob(1800, 1232, 32, 218), ob(1800, 1590, 32, 178)
];
setMap(room);
console.log("  缺口数 " + ctx.TERRAIN.gaps.length + " → " + JSON.stringify(ctx.TERRAIN.gaps));
chk(ctx.TERRAIN.gaps.length >= 1, "左墙的口子被识别成缺口");
const ng = nearestGap(1816, 1520);
chk(ng !== null && ng.d < 60, "最近的缺口就在左墙开口处（" + (ng ? ng.d.toFixed(0) : "-") + "px）");

console.log("\n=== 三、gapNear 的半径 ===");
chk(ctx.gapNear(1816, 1520, 60) !== null, "开口正中有缺口");
chk(ctx.gapNear(2100, 1500, 120) === null, "房间正中 280px 外查不到");
chk(ctx.gapNear(2100, 1500, 360) !== null, "半径放到 360 能查到");

console.log("\n=== 四、被困时撤退点是否偏向缺口 ===");
ctx._sense.cx = 3000; ctx._sense.cy = 1500;
const u = { x: 2100, y: 1500 };
const keepGaps = ctx.TERRAIN.gaps, keepGrid = ctx.TERRAIN.gapGrid;
function emptyGrid() { return new ctx.Grid(ctx.CFG.world.w, ctx.CFG.world.h, 192); }
ctx.TERRAIN.gaps = []; ctx.TERRAIN.gapGrid = emptyGrid();
const A = ctx.pickRetreatSpot(u, -1, 0);
ctx.TERRAIN.gaps = keepGaps; ctx.TERRAIN.gapGrid = keepGrid;
const B = ctx.pickRetreatSpot(u, -1, 0);
console.log("  无缺口 A=" + show(A) + "（到缺口 " + (A ? gapDist(A).toFixed(0) : "-") + "px）");
console.log("  有缺口 B=" + show(B) + "（到缺口 " + (B ? gapDist(B).toFixed(0) : "-") + "px）");
chk(A !== null && B !== null, "两种情况都给出了撤退点");

console.log("\n=== 五、开口偏离正后方 ===");
const room2 = [
  ob(1800, 1200, 600, 32), ob(1800, 1768, 600, 32), ob(2368, 1232, 32, 536),
  ob(1800, 1232, 32, 150), ob(1800, 1500, 32, 268)
];
setMap(room2);
console.log("  缺口数 " + ctx.TERRAIN.gaps.length + " → " + JSON.stringify(ctx.TERRAIN.gaps));
chk(ctx.TERRAIN.gaps.length >= 1, "左墙的口子被识别出来");
ctx._sense.cx = 3400; ctx._sense.cy = 1500;
const u2 = { x: 1900, y: 1500 };
const k2 = ctx.TERRAIN.gaps, k2g = ctx.TERRAIN.gapGrid;
ctx.TERRAIN.gaps = []; ctx.TERRAIN.gapGrid = emptyGrid();
const A2 = ctx.pickRetreatSpot(u2, -1, 0);
ctx.TERRAIN.gaps = k2; ctx.TERRAIN.gapGrid = k2g;
const B2 = ctx.pickRetreatSpot(u2, -1, 0);
console.log("  无缺口 A2=" + show(A2) + "（到缝隙 " + (A2 ? gapDist(A2).toFixed(0) : "-") + "px）");
console.log("  有缺口 B2=" + show(B2) + "（到缝隙 " + (B2 ? gapDist(B2).toFixed(0) : "-") + "px）");

chk(A2 === null || B2 === null || gapDist(B2) <= gapDist(A2) + 1, "缺口只在被困时加分，不会把原本合理的撤退点带歪");

console.log("\n=== 六、真实地图上不该大面积误报 ===");
let maxGaps = 0, minGaps = 1e9, over = 0;
for (let s = 1; s <= 6; s++) {
  ctx.W.obstacles = [];
  ctx.buildScenario(s, 20);
  ctx.analyzeTerrain(true);
  const n = ctx.TERRAIN.gaps.length;
  maxGaps = Math.max(maxGaps, n); minGaps = Math.min(minGaps, n);
  if (n > 200) over++;
  console.log("  seed " + s + "：障碍 " + ctx.W.obstacles.length + " 个，缺口 " + n + " 个");
}
chk(over === 0, "6 张默认地图里没有一张出现成百上千个缺口（" + minGaps + "~" + maxGaps + "）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
