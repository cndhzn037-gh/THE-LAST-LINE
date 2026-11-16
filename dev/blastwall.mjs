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
const W = () => ctx.W;
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function reset() {
  ctx.buildScenario(999, 2);
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
}
/* 一堵 20px 厚的竖墙 —— 游戏里建筑墙就是这个厚度 */
const WALL_X = 1600, WALL_W = 20, WALL_Y = 600, WALL_H = 800;
function buildWall() {
  W().obstacles.push(ctx.makeObstacle(WALL_X, WALL_Y, WALL_W, WALL_H, "wall"));
  ctx.NAV.build(CFG.world, W().obstacles, 9);
}
function insideWall(u) {
  return u.x > WALL_X && u.x < WALL_X + WALL_W && u.y > WALL_Y && u.y < WALL_Y + WALL_H;
}
function farSide(u) { return u.x > WALL_X + WALL_W; }

console.log("=== 零、先单独验证 pushUnit 本身 ===");
reset();
const t0 = ctx.addUnit("zombie", 2000, 1000);
t0.vx = 0; t0.vy = 0;
const tx0 = t0.x;
ctx.pushUnit(t0, 50, 0);
console.log("  直接调用 pushUnit(50,0)：" + tx0 + " → " + t0.x.toFixed(1));
chk(Math.abs(t0.x - (tx0 + 50)) < 0.5, "pushUnit 本身工作正常");

console.log("\n=== 零之二、从 ZGRID 能不能扫到它 ===");
reset();
const s0 = ctx.addUnit("shield", 1500, 1000);
const zz0 = ctx.addUnit("zombie", 1600, 1000);
zz0.hp = 99999;
ctx.rebuildGrids();
const q = [];
ctx.ZGRID.query(s0.x, s0.y, CFG.fearR + 20, q);
console.log("  盾兵(" + s0.x + ") 半径 " + (CFG.fearR + 20) + " 内扫到 " + q.length + " 个单位" +
  (q.length ? "：[" + q.map(x => x.kind).join(",") + "]" : ""));
chk(q.length > 0, "ZGRID 能扫到丧尸");
chk(q.indexOf(zz0) >= 0, "扫到的正是那只丧尸");
const dq = Math.hypot(zz0.x - s0.x, zz0.y - s0.y);
console.log("  两者距离 " + dq.toFixed(0) + "px，恐惧半径 " + CFG.fearR + "px → 在范围内=" + (dq <= CFG.fearR));
chk(dq <= CFG.fearR, "距离在冲击范围内");

console.log("\n=== 一、护盾碎裂冲击波：把丧尸推向墙 ===");
reset(); buildWall();
/* 盾兵在墙左，丧尸夹在盾兵和墙之间 —— 冲击方向正对墙，最容易穿过去 */
const sh = ctx.addUnit("shield", 1500, 1000);
const z = ctx.addUnit("zombie", 1570, 1000);
z.hp = 99999;
z.vx = 0; z.vy = 0;
console.log("  冲击前：盾兵 x=" + sh.x + "，丧尸 x=" + z.x + "，墙 x=" + WALL_X + "~" + (WALL_X + WALL_W) +
  "，丧尸距墙 " + (WALL_X - z.x).toFixed(0) + "px，冲击距离上限 " + CFG.shield.blastPush + "px");
ctx.rebuildGrids();   /* 网格不是实时更新的，冲击波靠它找目标 */
ctx.shieldBlast(sh);
console.log("  冲击后：丧尸 x=" + z.x.toFixed(1) + "（墙左边界 " + WALL_X + "）");
chk(!insideWall(z), "丧尸没有被塞进墙体内部");
chk(!farSide(z), "丧尸没有穿到墙的另一侧");
chk(z.x <= WALL_X - z.r + 0.5, "丧尸停在墙边（x=" + z.x.toFixed(1) + " ≤ " + (WALL_X - z.r) + "）");

console.log("\n=== 二、殉爆冲击波：同样不能穿墙 ===");
reset(); buildWall();
const sh2 = ctx.addUnit("shield", 1500, 1000);
const z2 = ctx.addUnit("zombie", 1570, 1000);
z2.hp = 99999; z2.vx = 0; z2.vy = 0;
ctx.rebuildGrids();   /* 网格不是实时更新的，冲击波靠它找目标 */
ctx.shieldDetonate(sh2);
console.log("  冲击后：丧尸 x=" + z2.x.toFixed(1) + "，存活=" + !z2.dead);
chk(!z2.dead || (!insideWall(z2) && !farSide(z2)), "殉爆也没把它推穿墙");

console.log("\n=== 三、大批丧尸同时被推，全都不许穿墙 ===");
reset(); buildWall();
const sh3 = ctx.addUnit("shield", 1500, 1000);
const crowd = [];
for (let i = 0; i < 30; i++) {
  const zz = ctx.addUnit("zombie", 1500 + 30 + (i % 6) * 12, 950 + i * 3.5);
  zz.hp = 99999; zz.vx = 0; zz.vy = 0;
  crowd.push(zz);
}
ctx.rebuildGrids();   /* 网格不是实时更新的，冲击波靠它找目标 */
ctx.shieldBlast(sh3);
let through = 0, inside = 0;
for (const zz of crowd) { if (farSide(zz)) through++; if (insideWall(zz)) inside++; }
console.log("  30 只丧尸：穿到墙另一侧 " + through + " 只，卡在墙体里 " + inside + " 只");
chk(through === 0, "没有一只是穿过去的");
chk(inside === 0, "没有一只卡在墙体内部");

console.log("\n=== 四、分散推进本身仍然有效（不是被墙一挡就完全没反应）===");
reset();
const sh4 = ctx.addUnit("shield", 1500, 1000);
const z4 = ctx.addUnit("zombie", 1600, 1000);
z4.hp = 99999; z4.vx = 0; z4.vy = 0;
const x0 = z4.x;
ctx.rebuildGrids();   /* 网格不是实时更新的，冲击波靠它找目标 */
ctx.shieldBlast(sh4);
/* 冲击之后有一段抛飞动画，等它落地再量最终位移 */
for (let i = 0; i < 60; i++) ctx.stepSim(1 / 60);
const expectPush = CFG.shield.blastPush * (0.35 + 0.65 * (1 - 100 / CFG.fearR));
console.log("  空旷处：丧尸 x " + x0.toFixed(0) + " → " + z4.x.toFixed(0) + "（位移 " + (z4.x - x0).toFixed(1) +
  "px；公式给的抛出距离是 " + expectPush.toFixed(1) + "px，其余是落地后的惯性滑行）");
chk(z4.x - x0 >= expectPush - 2, "抛出距离没有被打折（" + (z4.x - x0).toFixed(0) + " ≥ " + expectPush.toFixed(0) + "）");

console.log("\n=== 五、角落与贴墙情形 ===");
reset(); buildWall();
const sh5 = ctx.addUnit("shield", 1500, 620);
const z5 = ctx.addUnit("zombie", 1570, 620);   /* 靠近墙的顶端 */
z5.hp = 99999; z5.vx = 0; z5.vy = 0;
ctx.rebuildGrids();   /* 网格不是实时更新的，冲击波靠它找目标 */
ctx.shieldBlast(sh5);
console.log("  墙顶端附近：丧尸 (" + z5.x.toFixed(0) + "," + z5.y.toFixed(0) + ")");
chk(!insideWall(z5), "没有被塞进墙里");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);