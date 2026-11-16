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
  ctx.W.bullets.length = 0; ctx.W.flashes.length = 0; ctx.W.infected = 0; ctx.W.kills = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
}
console.log("=== 感染时间线：接触即感染 → 2s 无症状 → 3s 变色 → 完成才换阵营 ===");
clean();
const civ = ctx.addUnit("civilian", 2000, 1200);
const z = ctx.addUnit("zombie", 2018, 1200);
z.pounceCd = 999;
let firstLock = -1, firstSide = -1, convertedAt = -1, sideBeforeConvert = 0;
for (let i = 0; i < 60 * 9; i++) {
  civ.x = 2000; civ.y = 1200; civ.vx = 0; civ.vy = 0;
  z.x = 2018; z.y = 1200; z.vx = 0; z.vy = 0;
  ctx.stepSim(1 / 60);
  if (firstLock < 0 && civ.infectLocked) firstLock = i;
  if (firstSide < 0 && ctx.isZombieSide(civ)) firstSide = i;
  if (i % 30 === 0 && !civ.dead) {
    console.log("  t=" + (i / 60).toFixed(2) + "s  已感染=" + civ.infectLocked +
      "  无症状=" + civ.incubT.toFixed(2) + "  变色进度=" + civ.fadeT.toFixed(2) +
      "  按丧尸判定=" + ctx.isZombieSide(civ) + "  颜色=" + ctx.infectColorHex(civ));
  }
  if (civ.dead) { convertedAt = i; break; }
}
console.log("  ① 接触即感染：t=" + (firstLock >= 0 ? (firstLock / 60).toFixed(3) + "s" : "未触发") + (firstLock >= 0 && firstLock <= 3 ? " ✓" : " ✗"));
console.log("  ② 转化完成时才改阵营：完成于 t=" + (convertedAt >= 0 ? (convertedAt / 60).toFixed(2) + "s" : "未完成") +
  "，全程 isZombieSide 保持 false " + (firstSide === -1 && convertedAt > 0 ? "✓" : "✗"));

console.log("\n=== 变色期间：丧尸仍把它当人追、人类不会向它开火 ===");
clean();
const c1 = ctx.addUnit("civilian", 2000, 1200);
c1.infectLocked = true; c1.incubT = 2.6; c1.fadeT = 1.5;   // 正在变色的平民
const z1 = ctx.addUnit("zombie", 2400, 1200);               // 场上唯一丧尸
ctx.rebuildGrids();
console.log("  丧尸的 nearestHuman = " + (ctx.nearestHuman(z1) === c1 ? "仍是这名变色中的平民 ✓" : "已跳过 ✗"));
const r1 = ctx.addUnit("rifle", 2200, 1200);                // 人类射手，旁边只有变色者
ctx.rebuildGrids();
const s1 = ctx.senseZombies(r1, ctx.CFG.far.r, ctx.CFG.fearR);
console.log("  步枪兵感知到的丧尸数 = " + s1.far + (s1.far === 0 ? "（不会向变色中的同伴开火）✓" : "（误把变色者当丧尸）✗"));
// 对照组：真正转化完成后
c1.kind = "zombie";
ctx.rebuildGrids();
const s2 = ctx.senseZombies(r1, ctx.CFG.far.r, ctx.CFG.fearR);
console.log("  对照（颜色变完、已转成丧尸单位）：感知到的丧尸数 = " + s2.far + (s2.far >= 1 ? " ✓" : " ✗"));

console.log("\n=== 完整对局：感染是否真正发生 ===");
ctx.buildScenario(undefined, 160);
let firstInfectAt = -1;
for (let i = 0; i < 60 * 150 && !ctx.W.over; i++) {
  ctx.stepSim(1 / 60);
  if (firstInfectAt < 0 && ctx.W.infected > 0) firstInfectAt = i;
}
const c = ctx.countUnits();
console.log("  首次完成转化：t=" + (firstInfectAt >= 0 ? (firstInfectAt / 60).toFixed(1) + "s" : "未发生"));
console.log("  150 秒：人类=" + c.h + "（平民 " + c.civ + "）丧尸=" + c.z +
  " 击杀=" + ctx.W.kills + " 感染转化=" + ctx.W.infected + " 结果=" + (ctx.W.over ? ctx.W.result : "进行中"));
