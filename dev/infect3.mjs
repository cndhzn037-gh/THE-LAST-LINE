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
function clean() {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0;
  ctx.W.bullets.length = 0; ctx.W.flashes.length = 0; ctx.W.infected = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
}

console.log("=== 感染时间线（无症状 " + ctx.CFG.infect.incubation + "s + 变色 " + ctx.CFG.infect.fade + "s）===");
clean();
const civ = ctx.addUnit("civilian", 2000, 1200);
const z = ctx.addUnit("zombie", 2021, 1200);
z.pounceCd = 999;
let firstLock = -1, firstSide = -1, convertedAt = -1;
for (let i = 0; i < 60 * 8; i++) {
  civ.x = 2000; civ.y = 1200; civ.vx = 0; civ.vy = 0;
  z.x = 2021; z.y = 1200; z.vx = 0; z.vy = 0;
  ctx.stepSim(1 / 60);
  if (firstLock < 0 && civ.infectLocked) firstLock = i;
  if (firstSide < 0 && ctx.isZombieSide(civ)) firstSide = i;
  if (i % 30 === 0 && !civ.dead) {
    console.log("  t=" + (i / 60).toFixed(2) + "s  已感染=" + civ.infectLocked +
      "  无症状=" + civ.incubT.toFixed(2) + "  变色=" + civ.fadeT.toFixed(2) +
      "  按丧尸判定=" + ctx.isZombieSide(civ) + "  外观色=" + ctx.infectColorHex(civ));
  }
  if (civ.dead) { convertedAt = i; break; }
}
console.log("  ① 接触瞬间即感染：t=" + (firstLock / 60).toFixed(2) + "s" + (firstLock <= 1 ? " ✓" : " ✗"));
console.log("  ② 开始被当丧尸判定：t=" + (firstSide / 60).toFixed(2) + "s（应为 " + ctx.CFG.infect.incubation + "s）" + (Math.abs(firstSide / 60 - ctx.CFG.infect.incubation) < 0.05 ? " ✓" : " ✗"));
console.log("  ③ 完成转化：t=" + (convertedAt / 60).toFixed(2) + "s（应为 " + (ctx.CFG.infect.incubation + ctx.CFG.infect.fade) + "s）" + (Math.abs(convertedAt / 60 - 5) < 0.05 ? " ✓" : " ✗"));

console.log("\n=== 无症状期丧尸是否仍把它当人追 ===");
clean();
const c1 = ctx.addUnit("civilian", 2000, 1200);
const z1 = ctx.addUnit("zombie", 2600, 1200);
c1.infectLocked = true; c1.incubT = 0.5;    // 处于无症状期
z1.target = null; z1.retargetT = 0;
ctx.rebuildGrids();
console.log("  无症状期：nearestHuman 结果 = " + (ctx.nearestHuman(z1) === c1 ? "仍锁定这名平民 ✓" : "已跳过 ✗"));
c1.incubT = 2.5;                             // 进入变色期
ctx.rebuildGrids();
console.log("  变色期：  nearestHuman 结果 = " + (ctx.nearestHuman(z1) === c1 ? "仍锁定 ✗" : "已跳过（当丧尸看）✓"));

console.log("\n=== 变色期人类是否会向它开火 ===");
clean();
const c2n = ctx.addUnit("civilian", 2100, 1200);
c2n.infectLocked = true; c2n.incubT = 2.5; c2n.fadeT = 0.5;
const r = ctx.addUnit("rifle", 2000, 1200);
ctx.rebuildGrids();
const s = ctx.senseZombies(r, ctx.CFG.far.r, ctx.CFG.fearR);
console.log("  步枪兵感知到的'丧尸'数量 = " + s.far + "（变色中的平民应被计入）" + (s.far >= 1 ? " ✓" : " ✗"));
console.log("  感知到的最近目标 kind = " + (s.nearest ? s.nearest.kind : "无"));

console.log("\n=== 感染扩散速度对比（完整对局）===");
ctx.buildScenario(undefined, 160);
for (let i = 0; i < 60 * 120 && !ctx.W.over; i++) ctx.stepSim(1 / 60);
const c = ctx.countUnits();
console.log("  120 秒：人类剩余=" + c.h + "（其中平民 " + c.civ + "）丧尸=" + c.z +
  " 击杀=" + ctx.W.kills + " 感染转化=" + ctx.W.infected + " 结果=" + (ctx.W.over ? ctx.W.result : "进行中"));
