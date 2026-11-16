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

console.log("=== 一、场景结构 ===");
ctx.buildScenario(undefined, 80);
const obs = ctx.W.obstacles;
const walls = obs.filter(o => o.kind === "wall");
const lows = obs.filter(o => o.kind === "low");
console.log("障碍总数=" + obs.length + "  实心墙=" + walls.length + "  矮墙=" + lows.length + "  门=" + ctx.W.doors.length);
let overlaps = 0, sample = null;
for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
  const a = walls[i], b = walls[j];
  if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) { overlaps++; if (!sample) sample = a.x.toFixed(0) + "," + a.y.toFixed(0) + " vs " + b.x.toFixed(0) + "," + b.y.toFixed(0); }
}
console.log("实心墙互相重叠对数 = " + overlaps + (sample ? "  例: " + sample : "  （房屋与走廊互不穿插）"));
// 矮墙排布
const lowXs = new Set(lows.map(o => Math.round(o.x)));
const lowYs = lows.map(o => Math.round(o.y)).sort((a, b) => a - b);
const gaps = lowYs.slice(1).map((y, i) => y - lowYs[i]);
console.log("矮墙所在x = " + [...lowXs].join(",") + "  段数=" + lows.length + "  间距=" + [...new Set(gaps)].join(",") + "  单项尺寸=" + lows[0].w + "x" + lows[0].h);
// 大本营内部
const HX = 3060, HY = 520, HW = 920, HH = 1240;
const inside = obs.filter(o => o.x > HX && o.x + o.w < HX + HW && o.y > HY && o.y + o.h < HY + HH);
console.log("大本营内部障碍数 = " + inside.length + " （应为 0）");

console.log("\n=== 二、子弹 ===");
console.log("速度=" + ctx.CFG.bullet.speed + "px/s  长度=" + ctx.CFG.bullet.len + "  每帧位移=" + (ctx.CFG.bullet.speed / 60).toFixed(1) + "px");
function shotTest(label, dist, wallBetween) {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.bullets.length = 0; ctx.W.flashes.length = 0;
  if (wallBetween) {
    ctx.W.obstacles.push(ctx.makeObstacle(2000 + dist / 2 - 10, 1150, 20, 140, "wall"));
  }
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
  const z = ctx.addUnit("zombie", 2000 + dist, 1200);
  const r = ctx.addUnit("rifle", 2000, 1200);
  let hitFrame = -1;
  for (let i = 0; i < 180; i++) {
    ctx.stepSim(1 / 60);
    if (z.dead) { hitFrame = i; break; }
  }
  console.log("  " + label + "：丧尸hp=" + z.hp + " " + (z.dead ? ("在 " + (hitFrame / 60).toFixed(2) + "s 被击杀") : "未被击杀"));
}
shotTest("空旷 150px（速射圈）", 150, false);
shotTest("空旷 320px（远射圈）", 320, false);
shotTest("中间隔一堵实心墙 320px", 320, true);

// 贴墙射击：射手紧贴墙面（枪口落在墙体内部）
ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.bullets.length = 0;
ctx.W.obstacles.push(ctx.makeObstacle(2000, 1050, 20, 300, "wall"));
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const z2 = ctx.addUnit("zombie", 2300, 1200);
const r2 = ctx.addUnit("rifle", 2012, 1200);   // 圆心距墙 12px，墙厚 20 → 枪口在墙内
ctx.rebuildGrids();
let hit2 = -1;
for (let i = 0; i < 240; i++) { ctx.stepSim(1 / 60); if (z2.dead) { hit2 = i; break; } }
console.log("  贴墙射击（枪口落在墙体内）：丧尸hp=" + z2.hp + " " + (z2.dead ? ("在 " + (hit2 / 60).toFixed(2) + "s 被击杀 ✓") : "未击杀 ✗"));
