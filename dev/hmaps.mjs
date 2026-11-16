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
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function blockedAt(x, y) {
  const tx = Math.floor(x / ctx.NAV.tile), ty = Math.floor(y / ctx.NAV.tile);
  if (tx < 0 || ty < 0 || tx >= ctx.NAV.cols || ty >= ctx.NAV.rows) return 1;
  return ctx.NAV.blocked[ty * ctx.NAV.cols + tx] ? 1 : 0;
}

ctx.CFG.mapPreset = "channel";
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 20;
ctx.buildScenario(20240607, 20);
const w = ctx.CFG.world.w, h = ctx.CFG.world.h;
const gap = 170;                 /* 走廊收窄后是 170，原来 340 */
const cy = h / 2 - gap / 2;
console.log("  地图 " + w + "×" + h + "，走廊 y=" + cy + "~" + (cy + gap));

console.log("=== 一、中间走廊贯通 ===");
/* 走廊里撒了两块矮墙当掩体，它们会挡人但不挡子弹，所以要避开中间那几个格子 */
let midBlocked = 0, midTotal = 0;
for (let x = 800; x < w - 800; x += 40) {
  if (Math.abs(x - w * 0.42) < 140 || Math.abs(x - (w * 0.58 - 60)) < 140) continue;
  midTotal++; midBlocked += blockedAt(x, h / 2);
}
console.log("  走廊中线抽样 " + midTotal + " 点（已跳过掩体），被挡 " + midBlocked);
chk(midBlocked <= 2, "中间走廊从头到尾都是通的（" + midBlocked + " 个格子是掩体边缘）");

console.log("=== 二、左右两间房是封闭的 ===");
const leftIn = blockedAt(380, h / 2 - 400);   /* 左房间里，走廊外的位置 */
const rightIn = blockedAt(w - 380, h / 2 - 400);
const leftWall = blockedAt(5, h / 2 - 400);   /* 左外墙上 */
const rightWall = blockedAt(w - 5, h / 2 - 400);
console.log("  左房内部=" + (leftIn ? "堵" : "空") + " 右房内部=" + (rightIn ? "堵" : "空") +
  " 左外墙=" + (leftWall ? "堵" : "空") + " 右外墙=" + (rightWall ? "堵" : "空"));
chk(leftIn === 0, "左房间里是空的（能站人）");
chk(rightIn === 0, "右房间里是空的（能站人）");
chk(leftWall === 1, "左房间外沿封死");
chk(rightWall === 1, "右房间外沿封死");

console.log("=== 三、走廊上下是封的 ===");
const upBlock = blockedAt(w / 2, cy - 14);      /* 落在走廊上沿那道墙里 */
const downBlock = blockedAt(w / 2, cy + gap + 14);
chk(upBlock === 1, "走廊上方出不去");
chk(downBlock === 1, "走廊下方出不去");

console.log("=== 四、两间房通过走廊连通 ===");
/* 从右房间中心出发，能不能走到左房间 */
const start = [Math.floor((w - 380) / ctx.NAV.tile), Math.floor((h / 2) / ctx.NAV.tile)];
const goalX = Math.floor(380 / ctx.NAV.tile), goalY = Math.floor((h / 2) / ctx.NAV.tile);
const seen = new Set(); const q = [start]; seen.add(start[0] + "," + start[1]);
let reached = false;
while (q.length && !reached) {
  const [cx2, cy2] = q.shift();
  if (cx2 === goalX && cy2 === goalY) { reached = true; break; }
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = cx2 + dx, ny = cy2 + dy;
    const k = nx + "," + ny;
    if (seen.has(k)) continue;
    if (blockedAt(nx * ctx.NAV.tile + 16, ny * ctx.NAV.tile + 16)) continue;
    seen.add(k); q.push([nx, ny]);
  }
}
chk(reached, "从右房间能走到左房间（走廊真的连起来了）");

console.log("=== 五、跑起来正常 ===");
for (let i = 0; i < 300; i++) ctx.stepSim(1 / 60);
const alive = ctx.W.units.filter(u => !u.dead);
console.log("  跑 5 秒后存活 " + alive.length + " 个单位");
chk(alive.every(u => isFinite(u.x) && isFinite(u.y)), "没有 NaN");
chk(alive.every(u => u.x >= -20 && u.x <= w + 20 && u.y >= -20 && u.y <= h + 20), "都在地图内");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));