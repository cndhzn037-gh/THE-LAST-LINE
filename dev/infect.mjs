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

console.log("=== 感染判定：擦到即算接触（touchPad=" + ctx.CFG.infect.touchPad + "，接触阈值 = r+r+" + ctx.CFG.infect.touchPad + " = " + (8 + 8 + ctx.CFG.infect.touchPad) + "px）===");
function infectTest(gap, label) {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
  const civ = ctx.addUnit("civilian", 2000, 1200);
  const z = ctx.addUnit("zombie", 2000 + 16 + gap, 1200);
  z.pounceCd = 999;                       // 不让它猛扑，保持固定间距
  let locked = -1, converted = -1;
  for (let i = 0; i < 60 * 8; i++) {
    civ.x = 2000; civ.y = 1200; civ.vx = 0; civ.vy = 0;   // 钉住平民
    z.x = 2000 + 16 + gap; z.y = 1200; z.vx = 0; z.vy = 0;
    ctx.stepSim(1 / 60);
    if (locked < 0 && civ.infectLocked) locked = i;
    if (!civ.dead && ctx.W.infected > 0) { converted = i; break; }
  }
  console.log("  " + label.padEnd(30) + " 间距 " + String(gap).padStart(3) + "px  边缘间隔 " + (gap > 0 ? "+" + gap : gap) +
    "px → " + (locked >= 0 ? ("接触累积成功，第 " + (locked / 60).toFixed(2) + "s 锁定感染" + (converted >= 0 ? "，并完成转化 ✓" : "")) : "未触发感染"));
}
infectTest(-4, "明显重叠");
infectTest(0, "边缘正好相切");
infectTest(3, "仅擦到一点（原来不算）");
infectTest(6, "相距 6px（原来不算）");
infectTest(12, "相距 12px（不应触发）");

console.log("\n=== 完整对局中的感染数量（放大人对被围殴的场景）===");
ctx.buildScenario(undefined, 200);
for (let i = 0; i < 60 * 90 && !ctx.W.over; i++) ctx.stepSim(1 / 60);
const c = ctx.countUnits();
console.log("  90 秒：人类剩余=" + c.h + "（平民 " + c.civ + "）丧尸=" + c.z +
  " 击杀=" + ctx.W.kills + " 感染转化=" + ctx.W.infected + " 结果=" + (ctx.W.over ? ctx.W.result : "进行中"));

console.log("\n=== 地形与开局检查 ===");
ctx.buildScenario(undefined, 80);
const obs = ctx.W.obstacles;
const walls = obs.filter(o => o.kind === "wall");
const horiz = walls.filter(o => o.w / o.h > 6);
const vert = walls.filter(o => o.h / o.w > 6);
console.log("  长条墙（走廊特征）数量：横向 " + horiz.length + "，纵向 " + vert.length + "（应为 0 或仅建筑墙段）");
console.log("  障碍总数=" + obs.length + " 矮墙=" + obs.filter(o => o.kind === "low").length + " 门=" + ctx.W.doors.length);
const civs = ctx.W.units.filter(u => u.kind === "civilian").length;
const zs = ctx.W.units.filter(u => u.kind === "zombie").length;
console.log("  平民 " + civs + " 人 vs 普通丧尸 " + zs + " 只 → " + (civs === zs ? "数量相同 ✓" : "不相等 ✗"));
console.log("  平民跟随距离=" + ctx.CFG.squad.followDist + "px（原 34px）");
console.log("  岗位值守开关 CFG.postDuty=" + ctx.CFG.postDuty + "（默认关闭）");
console.log("  子弹线宽=" + ctx.CFG.bullet.width + "（原 1.3，已变细）");
