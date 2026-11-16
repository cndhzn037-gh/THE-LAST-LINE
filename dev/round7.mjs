import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl(id) { return { id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl(id)), createElement: () => makeEl("x"), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });
const W = () => ctx.W;
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function tick(n) { for (let i = 0; i < n; i++) ctx.stepSim(1 / 60); }
function clearScene() {
  ctx.buildScenario(999, 2);
  W().over = false;
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
  W().armHadMany = 0;
  W().shells.length = 0; W().casings.length = 0;
  W().heroTexts.length = 0; W().heroDuo = null;
}

console.log("=== 一、尸潮威胁值 ===");
chk(!!CFG.threat, "威胁值参数已就位");
console.log("  基准 " + CFG.threat.base + " 只以内不放大，每多 1 只 +" + (CFG.threat.per * 100).toFixed(1) +
  "%，最多 ×" + CFG.threat.maxMul + "，感知半径 " + CFG.threat.range);
/* 少量丧尸：平民应该岿然不动 */
clearScene();
const civA = ctx.addUnit("civilian", 1500, 1000);
const few = [];
/* 必须放到恐惧半径（260）之外，否则它们一开局就在圈里 */
for (let i = 0; i < 6; i++) { const z = ctx.addUnit("zombie", 1500 + 420 + i * 12, 1000); z.hp = 99999; few.push(z); }
ctx.rebuildGrids();
tick(2);
const fearSmall = ctx.senseZombies(civA, CFG.threat.range, ctx.fearRadiusOf(civA)).fear;
console.log("  6 只丧尸时：恐惧统计 " + fearSmall + "，状态=" + civA.state);
chk(fearSmall === 0, "小股丧尸还够不到恐惧圈（" + fearSmall + "）");
/* 大量丧尸压上来：应该被推远，越早开始跑 */
clearScene();
const civB = ctx.addUnit("civilian", 1500, 1000);
for (let i = 0; i < 45; i++) {
  const a = Math.PI * 2 * i / 45;
  const z = ctx.addUnit("zombie", 1500 + Math.cos(a) * 430, 1000 + Math.sin(a) * 430);
  z.hp = 99999;
}
ctx.rebuildGrids();
let fledAt = -1;
for (let i = 0; i < 60 * 6; i++) {
  tick(1);
  if (civB.state === "flee" && fledAt < 0) fledAt = i / 60;
}
const threatMul = 1 + Math.min(CFG.threat.maxMul - 1, (45 - CFG.threat.base) * CFG.threat.per);
console.log("  45 只丧尸时：威胁倍率约 ×" + threatMul.toFixed(2) +
  "（恐惧半径 " + ctx.fearRadiusOf(civB) + " → " + (ctx.fearRadiusOf(civB) * threatMul).toFixed(0) + "），" +
  (fledAt >= 0 ? "第 " + fledAt.toFixed(2) + "s 开始逃" : "没逃"));
chk(fledAt >= 0, "大尸潮压上来时平民开始撤退");

console.log("\n=== 二、弹壳基本行为 ===");
clearScene();
const gun = ctx.addUnit("rifle", 1500, 1000);
const tgt = ctx.addUnit("zombie", 2000, 1000);
tgt.hp = 99999;
ctx.rebuildGrids();
ctx.fireBullet(gun, tgt, 0, 2, 1, false, false);
console.log("  开一枪后场上弹壳 " + W().shells.length + " 枚，颜色 " + CFG.shell.color);
chk(W().shells.length === 1, "每发子弹抛出一枚弹壳");
chk(CFG.shell.color === "#e8f04a", "颜色是柠檬黄");
const sh0 = W().shells[0];
chk(sh0.z > 0 && sh0.vz > 0, "有向上的初速度（伪 3D 抛物线的起点）");
chk(sh0.t > 0, "有存活时间");
/* 跑一会儿，看它是否先上升后下落 */
/* 整个抛物大约 0.43 秒到顶，看 12 帧（0.2 秒）只会看到它在上升 */
const zs = [];
for (let i = 0; i < 50; i++) { ctx.stepShells(1 / 60); if (W().shells[0]) zs.push(W().shells[0].z); }
const peak = Math.max(...zs);
console.log("  最高点 " + peak.toFixed(0) + "，随后降到 " + zs[zs.length - 1].toFixed(0));
chk(peak > zs[0] && zs[zs.length - 1] < peak, "高度先涨后落（最高 " + peak.toFixed(0) + "）");

console.log("\n=== 三、弹壳落地变贴图 ===");
clearScene();
const gun2 = ctx.addUnit("rifle", 1500, 1000);
const tgt2 = ctx.addUnit("zombie", 2000, 1000);
tgt2.hp = 99999;
ctx.rebuildGrids();
ctx.fireBullet(gun2, tgt2, 0, 2, 1, false, false);
/* 把开火的单位干掉，免得 tick 期间又打出新弹壳干扰统计 */
gun2.dead = true; tgt2.dead = true; ctx.cleanup();
tick(60 * 3);
console.log("  3 秒后：飞行中 " + W().shells.length + " 枚，地上的贴图 " + W().casings.length + " 枚");
chk(W().shells.length === 0, "弹壳动画已经结束");
chk(W().casings.length === 1, "落地后变成了地面贴图");
ctx.resetForSetup();
chk(W().casings.length === 0 && W().shells.length === 0, "重置对局时弹壳一起清空");

console.log("\n=== 四、弹壳尺寸按兵种区分 ===");
clearScene();
const byKind = {};
for (const k of ["rifle", "mg", "sniper"]) {
  const u = ctx.addUnit(k, 1500, 1000);
  const t = ctx.addUnit("zombie", 2000, 1000);
  t.hp = 99999;
  ctx.rebuildGrids();
  ctx.fireBullet(u, t, 0, 2, 1, false, false);
  byKind[k] = W().shells[W().shells.length - 1].size;
  W().shells.length = 0;
  u.dead = true; t.dead = true; ctx.cleanup();
}
console.log("  弹壳尺寸：步枪 " + byKind.rifle + "，机枪 " + byKind.mg + "，狙击 " + byKind.sniper +
  "（子弹宽度 " + CFG.bullet.width + "）");
chk(byKind.sniper > byKind.mg && byKind.mg > byKind.rifle, "狙击 > 机枪 > 步枪");
chk(byKind.rifle < 1.5, "步枪弹壳只比子弹宽一点点（" + byKind.rifle + "）");

console.log("\n=== 五、数量上限 ===");
clearScene();
const spam = ctx.addUnit("rifle", 1500, 1000);
const sp2 = ctx.addUnit("zombie", 2000, 1000);
sp2.hp = 99999;
ctx.rebuildGrids();
for (let i = 0; i < 400; i++) ctx.fireBullet(spam, sp2, 0, 2, 1, false, false);
console.log("  连开 400 枪：飞行中 " + W().shells.length + " 枚（上限 " + CFG.shell.max + "）");
chk(W().shells.length <= CFG.shell.max, "飞行中的弹壳有上限");
for (let i = 0; i < 400; i++) ctx.stepShells(1 / 60);
console.log("  全部落地后：贴图 " + W().casings.length + " 枚（上限 " + CFG.shell.max + "）");
chk(W().casings.length <= CFG.shell.max, "地面贴图也有上限");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
