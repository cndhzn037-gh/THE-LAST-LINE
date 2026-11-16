import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [] }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });

console.log("=== 速射模式合法性：每次开火时弹道距离必须 <= 恐惧半径 ===");
ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0;
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const shooter = ctx.addUnit("rifle", 2000, 1200);
const zs = [];
for (let i = 0; i < 12; i++) zs.push(ctx.addUnit("zombie", 2100 + i * 12, 1100 + (i % 4) * 60));
const rec = [];
const origFire = ctx.fireBullet;
ctx.fireBullet = function (from, target, spread) {
  const d = Math.hypot(target.x - from.x, target.y - from.y);
  rec.push({ spread: spread, d: d });
  return origFire.apply(this, arguments);
};
for (let i = 0; i < 60 * 20; i++) {
  ctx.stepSim(1 / 60);
  shooter.x = 2000; shooter.y = 1200; shooter.vx = 0; shooter.vy = 0;   // 钉住射手
}
ctx.fireBullet = origFire;
const fast = rec.filter(r => r.spread > 0);
const precise = rec.filter(r => r.spread === 0);
const bad = fast.filter(r => r.d > ctx.CFG.fearR + 1);
console.log("  总开火 " + rec.length + " 次：速射 " + fast.length + " 次，精确点射 " + precise.length + " 次");
console.log("  速射时的距离范围: " + (fast.length ? Math.min(...fast.map(r=>r.d)).toFixed(0) + "~" + Math.max(...fast.map(r=>r.d)).toFixed(0) + "px" : "-"));
console.log("  越界速射（距离 > 恐惧半径 " + ctx.CFG.fearR + "px）= " + bad.length + " 次 " + (bad.length ? "✗" : "✓"));
console.log("  精确点射时的距离范围: " + (precise.length ? Math.min(...precise.map(r=>r.d)).toFixed(0) + "~" + Math.max(...precise.map(r=>r.d)).toFixed(0) + "px" : "-"));

console.log("\n=== 编辑器：单位 / 门 / 出生区 / 框选删除 / 坚守点位 ===");
ctx.buildScenario(undefined, 60);
ctx.startEditor();
const E = ctx.EDIT;
const before = { o: ctx.W.obstacles.length, d: ctx.W.doors.length, u: ctx.W.units.length };
console.log("  起点：障碍=" + before.o + " 门=" + before.d + " 单位=" + before.u);

E.tool = "rifle"; E.mode = "point";
ctx.editPointerDown(2000, 1200);
ctx.editPointerDown(2100, 1200);
console.log("  放置单位后 单位=" + ctx.W.units.length + "（+2）");
const placed = ctx.W.units[ctx.W.units.length - 1];
console.log("  新单位: " + placed.kind + " @(" + placed.x.toFixed(0) + "," + placed.y.toFixed(0) + ")");

E.tool = "zombie";
ctx.editPointerDown(800, 800);
console.log("  放置丧尸后 单位=" + ctx.W.units.length);

E.tool = "door";
const wallBefore = ctx.W.obstacles.length, doorBefore = ctx.W.doors.length;
ctx.editPointerDown(3080, 900);   // 大本营西墙上开门
console.log("  在某段墙上开门：障碍 " + wallBefore + " -> " + ctx.W.obstacles.length + "，门 " + doorBefore + " -> " + ctx.W.doors.length);
const newDoor = ctx.W.doors[ctx.W.doors.length - 1];
if (newDoor) {
  ctx.editPointerDown(newDoor.x + newDoor.w / 2, newDoor.y + newDoor.h / 2);
  console.log("  再点该门封门：障碍=" + ctx.W.obstacles.length + "，门=" + ctx.W.doors.length + "（应恢复 " + doorBefore + "）");
}

E.tool = "spawn";
ctx.editPointerDown(100, 200); ctx.editPointerMove(600, 900); ctx.editPointerUp(600, 900);
console.log("  设定出生区: " + JSON.stringify(E.spawn));

E.tool = "defend";
const rifle = ctx.W.units.find(u => u.kind === "rifle");
ctx.editPointerDown(rifle.x, rifle.y);
console.log("  点选士兵 -> selUnit=" + (E.selUnit ? E.selUnit.kind : "null"));
ctx.editPointerDown(3200, 1000);
console.log("  设点位 -> defend=" + JSON.stringify(rifle.defend));

E.tool = "erase"; E.mode = "drag";
const beforeErase = { o: ctx.W.obstacles.length, u: ctx.W.units.length };
ctx.editPointerDown(700, 700); ctx.editPointerMove(900, 950); ctx.editPointerUp(900, 950);
console.log("  框选删除 (700,700)-(900,950)：障碍 " + beforeErase.o + " -> " + ctx.W.obstacles.length + "，单位 " + beforeErase.u + " -> " + ctx.W.units.length);

ctx.editUndo();
console.log("  撤销后：障碍=" + ctx.W.obstacles.length + " 单位=" + ctx.W.units.length + " 门=" + ctx.W.doors.length);

console.log("\n=== 出生区是否影响开局丧尸分布 ===");
E.spawn = { x: 200, y: 300, w: 400, h: 500 };
ctx.beginGame();
const zz = ctx.W.units.filter(u => ctx.isZombie(u));
let inside = 0;
for (const z of zz) if (z.x >= 200 && z.x <= 600 && z.y >= 300 && z.y <= 800) inside++;
console.log("  开局丧尸 " + zz.length + " 只，落在设定出生区内 " + inside + " 只 " + (inside === zz.length ? "✓" : "✗"));
