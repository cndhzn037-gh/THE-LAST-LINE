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

const E = ctx.EDIT;
function stat(tag) {
  const o = ctx.W.obstacles;
  console.log("  " + tag.padEnd(22) + " 障碍=" + String(o.length).padStart(3) +
    " 墙=" + o.filter(x => x.kind === "wall").length +
    " 矮墙=" + o.filter(x => x.kind === "low").length +
    " 门=" + ctx.W.doors.length + "  已编辑=" + E.touched);
}
console.log("=== 进入编辑器 ===");
ctx.startEditor();
console.log("  EDIT.active=" + E.active + "  底栏隐藏=" + (ctx.$("bottom").className === "bar hide") + "  工具栏显示=" + ctx.$("editbar").style.display);
stat("初始");

console.log("\n=== 画法一：拖拽框选画房屋 ===");
E.tool = "house"; E.mode = "drag";
const n0 = ctx.W.obstacles.length, d0 = ctx.W.doors.length;
ctx.editPointerDown(1200, 1000);
ctx.editPointerMove(1700, 1400);
ctx.editPointerUp(1700, 1400);
stat("拖拽后");
console.log("  房屋墙段 +" + (ctx.W.obstacles.length - n0) + "  门 +" + (ctx.W.doors.length - d0));
const house = ctx.W.obstacles.slice(n0);
console.log("  生成的墙范围: x " + Math.min(...house.map(o=>o.x)) + "~" + Math.max(...house.map(o=>o.x+o.w)) +
  "  y " + Math.min(...house.map(o=>o.y)) + "~" + Math.max(...house.map(o=>o.y+o.h)));

console.log("\n=== 画法二：两角定位画实心墙 ===");
E.tool = "wall"; E.mode = "corner";
const before2 = ctx.W.obstacles.length;
ctx.editPointerDown(600, 400);
console.log("  第一角点击后 障碍=" + ctx.W.obstacles.length + "（应不变，等待第二个角）hasCorner=" + E.hasCorner);
ctx.editPointerMove(780, 560);
ctx.editPointerDown(780, 560);
console.log("  第二角点击后 障碍=" + ctx.W.obstacles.length + "（+1）hasCorner=" + E.hasCorner);
const w2 = ctx.W.obstacles[ctx.W.obstacles.length - 1];
console.log("  实心墙尺寸 " + w2.w + "×" + w2.h + " @(" + w2.x + "," + w2.y + ") kind=" + w2.kind);

console.log("\n=== 画法三：单击放置画矮墙 ===");
E.tool = "low"; E.mode = "point";
ctx.editPointerMove(2500, 1800);
ctx.editPointerDown(2500, 1800);
const lw = ctx.W.obstacles[ctx.W.obstacles.length - 1];
console.log("  矮墙尺寸 " + lw.w + "×" + lw.h + " kind=" + lw.kind + "（预设 128×26，已吸附网格）");

console.log("\n=== 撤销 ===");
const beforeU = ctx.W.obstacles.length;
ctx.editUndo();
console.log("  撤销后 障碍 " + beforeU + " -> " + ctx.W.obstacles.length);

console.log("\n=== 橡皮擦 ===");
E.tool = "low"; E.mode = "point";
ctx.editPointerMove(2650, 1500);
ctx.editPointerDown(2650, 1500);
const target = ctx.W.obstacles[ctx.W.obstacles.length - 1];
const beforeE = ctx.W.obstacles.length;
E.tool = "erase";
ctx.editPointerDown(target.x + target.w / 2, target.y + target.h / 2);
console.log("  擦除矮墙后 障碍 " + beforeE + " -> " + ctx.W.obstacles.length + "（应 -1）");

console.log("\n=== 吸附与最小尺寸 ===");
E.tool = "wall"; E.mode = "corner";
ctx.editPointerDown(1001, 1003);
ctx.editPointerMove(1002, 1004);
ctx.editPointerDown(1002, 1004);
const tiny = ctx.W.obstacles[ctx.W.obstacles.length - 1];
console.log("  极小拖动 -> " + tiny.w + "×" + tiny.h + "（应被撑到最小 40×40）x=" + tiny.x + " y=" + tiny.y + "（应吸附到 8 的倍数）");

console.log("\n=== 完成编辑并开局，地形是否保留 ===");
const customCount = ctx.W.obstacles.length;
const customDoors = ctx.W.doors.length;
ctx.finishEditor();
console.log("  完成后 EDIT.active=" + E.active + "  底栏恢复=" + (ctx.$("bottom").className === "bar"));
ctx.beginGame();
console.log("  开局后 障碍=" + ctx.W.obstacles.length + "（自定义 " + customCount + "） 门=" + ctx.W.doors.length + "（自定义 " + customDoors + "）");
console.log("  人类=" + ctx.countUnits().h + " 丧尸=" + ctx.countUnits().z);
for (let i = 0; i < 120; i++) ctx.stepSim(1 / 60);
let bad = 0;
for (const u of ctx.W.units) {
  for (const o of ctx.W.obstacles) {
    if (u.x > o.x && u.x < o.x + o.w && u.y > o.y && u.y < o.y + o.h) { bad++; break; }
  }
}
console.log("  演算 2 秒后仍卡在墙里的单位=" + bad + "（应为 0）");
console.log("  导航网格重建正常，岗位数=" + ctx.W.posts.length);
