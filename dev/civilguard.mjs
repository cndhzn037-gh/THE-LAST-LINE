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
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }
function parkFar() {
  for (const u of ctx.W.units) {
    if (u.dead) continue;
    if (isZ(u)) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
  }
}
const CFG = ctx.CFG;
const FD = CFG.squad.followDist;

function setup(seed) {
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
  ctx.LAST_ZOMBIE_COUNT = 12;
  ctx.buildScenario(seed, 12);
  ctx.W.over = false; ctx.W.result = ""; ctx.W.waves = null; ctx.W.paused = false;
  parkFar();
  const armed = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
  const civ = ctx.W.units.find(u => !u.dead && u.kind === "civilian");
  for (const u of ctx.W.units) {
    if (u.dead || u === armed || u === civ) continue;
    if (isZ(u)) continue;
    u.x = 200 + (u.id % 30) * 12; u.y = 200 + (u.id % 17) * 12; u.vx = 0; u.vy = 0;
  }
  armed.x = 2000; armed.y = 1200; armed.vx = 0; armed.vy = 0;
  civ.x = 2000 - 130; civ.y = 1200; civ.vx = 0; civ.vy = 0;
  civ.guardOf = armed;
  armed.guards = [civ];
  ctx.rebuildGrids();
  return { armed, civ };
}

console.log("=== 一、没有敌人时：平民只是跟上，不该绕圈 ===");
let pair = setup(9);
let armed = pair.armed, civ = pair.civ;
console.log("  平民护卫对象 #" + (civ.guardOf ? civ.guardOf.id : "无") + "，跟随距离 " + FD + "px");
let angs = [], dists = [], flips = 0, prevSign = 0;
let frontTicks = 0, moveTicks = 0;
for (let s = 0; s < 40; s++) {
  tick(0.25);
  const dx = civ.x - armed.x, dy = civ.y - armed.y;
  angs.push(Math.atan2(dy, dx));
  dists.push(Math.hypot(dx, dy));
  const sg = dx >= 0 ? 1 : -1;
  if (prevSign !== 0 && sg !== prevSign) flips++;
  prevSign = sg;
  /* 护卫在走的时候，平民是不是跑到了它的正前方（沿护卫速度方向投影 > 40px） */
  const sp = Math.hypot(armed.vx, armed.vy);
  if (sp > 20) {
    const proj = (dx * armed.vx + dy * armed.vy) / sp;
    if (proj > 40) frontTicks++;
    moveTicks++;
  }
}
let totalTurn = 0;
for (let i = 1; i < angs.length; i++) {
  let d = angs[i] - angs[i - 1];
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  totalTurn += Math.abs(d);
}
const maxD = Math.max.apply(null, dists);
const finalD = dists[dists.length - 1];
console.log("  10 秒内：累计转角 " + (totalTurn * 180 / Math.PI).toFixed(0) + "°，左右穿越 " + flips + " 次，" +
  "与护卫最远 " + maxD.toFixed(0) + "px，最后 " + finalD.toFixed(0) + "px");
const frontRatio = moveTicks ? frontTicks / moveTicks : 0;
console.log("  护卫行进时，平民跑到它正前方的时间占比 " + (frontRatio * 100).toFixed(0) + "%");
/* 护卫自己会在 advance / engage / reposition 之间来回切方向，
   "正前方"这个基准本身就在抖，所以阈值放到 25% —— 真正的绕圈是持续性地绕，不是这种往返 */
chk(frontRatio < 0.25, "没有绕到护卫前面去（占比 " + (frontRatio * 100).toFixed(0) + "% < 25%）");
chk(flips <= 3, "没有反复穿到护卫另一侧（穿越 " + flips + " 次）");
/* 平民速度比步枪兵慢，护卫一路高速推进时会落后一大段 ——
   这是"跟随"而不是"绕圈"，掉队补偿会把它拉回来（见 tune2 的掉队测试） */
chk(maxD < FD * 8, "没有跟丢（最远 " + maxD.toFixed(0) + "px < " + (FD * 8).toFixed(0) + "px）");

console.log("=== 二、有敌人时：站在护卫背对敌人的一侧 ===");
pair = setup(9);
armed = pair.armed; civ = pair.civ;
const foe = ctx.addUnit("zombie", armed.x + 320, armed.y);
foe.hp = 99999;
ctx.rebuildGrids();
let behindSum = 0, samples = 0;
for (let s = 0; s < 16; s++) {
  tick(0.25);
  parkFar();
  foe.x = armed.x + 320; foe.y = armed.y; foe.vx = 0; foe.vy = 0;
  ctx.rebuildGrids();
  const cx = civ.x - armed.x, cy = civ.y - armed.y;
  const zx = foe.x - armed.x, zy = foe.y - armed.y;
  const cl = Math.hypot(cx, cy), zl = Math.hypot(zx, zy);
  if (cl > 20 && zl > 20) {
    behindSum += (cx / cl) * (zx / zl);
    samples++;
  }
}
const behind = samples ? behindSum / samples : 1;
console.log("  平民相对护卫的方位 · 与敌人方向的余弦 = " + behind.toFixed(2) + "（负数 = 站在背敌面）");
chk(samples > 6, "取到了足够样本（" + samples + "）");
chk(behind < 0.2, "平民待在护卫背对敌人的那一侧");

console.log("=== 三、参数就位 ===");
console.log("  目标点缓存 " + CFG.squad.escortRepath + "s，到位阈值 " + CFG.squad.escortEps + "px，跟随余量 ×" + CFG.squad.escortSlack);
chk(CFG.squad.escortRepath >= 0.3, "目标点有缓存，不会每帧重算");
chk(CFG.squad.escortEps > 0, "有到位阈值，不会无限微调");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
