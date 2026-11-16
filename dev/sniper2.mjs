import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
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
const W = () => ctx.W;
function clean() {
  W().units.length = 0; W().obstacles.length = 0; W().doors.length = 0;
  W().bullets.length = 0; W().flashes.length = 0; W().trails.length = 0;
  ctx.NAV.build(ctx.CFG.world, W().obstacles, 9);
}

console.log("=== ① 命中判定宽度 ×3 ===");
function sideShot(offset, label) {
  clean();
  const z = ctx.addUnit("zombie", 2000, 1200);
  const s = ctx.addUnit("sniper", 1900, 1200 + offset);
  ctx.rebuildGrids();
  const hp0 = z.hp;
  ctx.fireBullet(s, { x: z.x, y: z.y + offset }, 0, 4, 5, false, true);
  for (let i = 0; i < 20; i++) ctx.stepBullets(1 / 60);
  console.log("  弹道偏离目标中心 " + String(offset).padStart(3) + "px：" + (z.hp < hp0 ? "命中 ✓" : "未命中"));
}
sideShot(0, "正中");
sideShot(20, "偏 20px（丧尸半径 8）");
sideShot(40, "偏 40px");
console.log("  判定半径 = 丧尸半径 8 + 加成 " + (ctx.CFG.bullet.width * ctx.CFG.sniper.widthMul * ctx.CFG.sniper.hitRMul).toFixed(1) + "px = " +
  (8 + ctx.CFG.bullet.width * ctx.CFG.sniper.widthMul * ctx.CFG.sniper.hitRMul).toFixed(1) + "px");

console.log("\n=== ② 尾迹与消散 ===");
clean();
const s2 = ctx.addUnit("sniper", 1900, 1200);
ctx.addUnit("zombie", 2600, 1200);
ctx.rebuildGrids();
ctx.fireBullet(s2, { x: 2600, y: 1200 }, 0, 4, 5, false, true);
console.log("  开火瞬间尾迹段 = " + W().trails.length);
for (let i = 0; i < 20; i++) ctx.stepBullets(1 / 60);
console.log("  飞 20 帧后尾迹段 = " + W().trails.length + "（每帧一段）");
const life0 = W().trails.length ? W().trails[0].life : -1;
console.log("  首段剩余寿命 = " + life0.toFixed(2) + "s（上限 " + ctx.CFG.sniper.trailLife + "s）");
let half = 0;
for (let i = 0; i < 60 * 3; i++) {
  ctx.stepBullets(1 / 60);
  if (i === 30) half = W().trails.length;
}
console.log("  半秒后 " + half + " 段 → 三秒后 " + W().trails.length + " 段 " + (W().trails.length === 0 ? "✓ 已完全消散" : "✗"));

console.log("\n=== ③ 狙击枪射速与弹匣 ===");
clean();
const s3 = ctx.addUnit("sniper", 1900, 1200);
for (let i = 0; i < 3; i++) ctx.addUnit("zombie", 2400 + i * 30, 1200);
let shots = [], t0 = W().t;
for (let i = 0; i < 60 * 30; i++) {
  ctx.stepSim(1 / 60);
  s3.x = 1900; s3.y = 1200; s3.vx = 0; s3.vy = 0;
  if (W().kills > shots.length) shots.push(+W().t.toFixed(2));
  if (W().kills >= 3) break;
}
console.log("  击杀三只丧尸用时 " + W().t.toFixed(1) + "s（每发 3 秒 + 5 发弹匣的换弹节奏）");
console.log("  狙击枪：间隔 " + ctx.CFG.sniper.interval + "s  弹匣 " + ctx.CFG.sniper.mag + "  换弹 " + ctx.CFG.sniper.reload + "s");

console.log("\n=== ④ 拉开距离的意愿 ===");
clean();
const s4 = ctx.addUnit("sniper", 2600, 1200);
const z4 = ctx.addUnit("zombie", 2500, 1200);
z4.pounceCd = 999;
const d0 = Math.hypot(s4.x - z4.x, s4.y - z4.y);
const samples = [];
for (let s = 1; s <= 6; s++) {
  for (let i = 0; i < 60; i++) {
    ctx.stepSim(1 / 60);
    if (z4.dead) { z4.dead = false; z4.hp = 5; }
  }
  samples.push(Math.hypot(s4.x - z4.x, s4.y - z4.y));
}
console.log("  初始距离 " + d0.toFixed(0) + "px，逐秒距离 = " + samples.map(d => d.toFixed(0)).join(" → "));
console.log("  是否主动拉开 = " + (Math.max(...samples) > d0 * 3 ? "✓ 明显拉开（最高 " + Math.max(...samples).toFixed(0) + "px）" : "（未明显拉开）"));
console.log("  狙击手落位点 (" + s4.sniperX.toFixed(0) + "," + s4.sniperY.toFixed(0) + ")  当前位置 (" + s4.x.toFixed(0) + "," + s4.y.toFixed(0) + ")");

console.log("\n=== ⑤ 无限建筑穿透 ===");
clean();
for (let i = 0; i < 5; i++) W().obstacles.push(ctx.makeObstacle(2100 + i * 120, 1100, 20, 220, "wall"));
ctx.NAV.build(ctx.CFG.world, W().obstacles, 9);
const z5 = ctx.addUnit("zombie", 2800, 1200);
const s5 = ctx.addUnit("sniper", 2000, 1200);
ctx.rebuildGrids();
console.log("  五堵墙夹在中间，countWallsOnSegment = " + ctx.countWallsOnSegment(s5.x, s5.y, z5.x, z5.y) + " 堵");
const hp5 = z5.hp;
ctx.fireBullet(s5, z5, 0, 4, 5, false, true);
for (let i = 0; i < 30; i++) ctx.stepBullets(1 / 60);
console.log("  狙击弹命中 = " + (z5.hp < hp5 ? "是 ✓（穿透全部五堵墙）" : "否 ✗"));
