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
function clearScene() {
  ctx.buildScenario(999, 2);
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
  W().armedHadMany = 0; W().civHadMany = 0; W().heroTexts.length = 0;
  CFG.hero.enabled = true;
}
/* 统计某个单位在给定时间内的开火次数（把主武器锁定成远射点射，方便计数） */
function countShots(u, secs, freezer) {
  let n = 0;
  const orig = ctx.fireBullet;
  ctx.fireBullet = function (from) { if (from === u) n++; return orig.apply(this, arguments); };
  for (let i = 0; i < Math.round(secs * 60); i++) {
    if (freezer) freezer();
    ctx.stepSim(1 / 60);
  }
  ctx.fireBullet = orig;
  return n;
}

console.log("=== 一、武装英雄射速翻倍 ===");
clearScene();
const h1 = ctx.addUnit("rifle", 1400, 1000);
const h2 = ctx.addUnit("rifle", 1460, 1000);
const dummy = ctx.addUnit("zombie", 1800, 1000);
dummy.hp = 999999;
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
h2.dead = true; ctx.cleanup();
ctx.stepSim(1 / 60);
ctx.stepSim(1 / 60);     /* 倍率是在 rebuildGrids 里算的，比升格晚一帧，多跑一帧让它落定 */
chk(h1.hero === "armed", "升格成功，rateMul=" + h1.rateMul);
chk(Math.abs(h1.rateMul - CFG.hero.rateMul) < 1e-6, "射速倍率 = " + CFG.hero.rateMul + "（翻倍）");

/* 先把两把附加武器摘掉：它们同样算 h1 开火，混进来就分不清主武器的射速了 */
const savedGuns = h1.guns;
h1.guns = null;
/* 英雄自己也要钉住：否则它会一路走过去贴脸，那就变成速射圈里的 0.06 秒/发，
   测到的就不是"远射点射翻倍"了 */
const shotsHero = countShots(h1, 10, () => {
  h1.x = 1400; h1.y = 1000; h1.vx = 0; h1.vy = 0;
  dummy.x = 1800; dummy.y = 1000; dummy.vx = 0; dummy.vy = 0; dummy.hp = 999999;
});
h1.guns = savedGuns;
console.log("  英雄步枪兵（只算主武器）10 秒开火 " + shotsHero + " 次（远射基准 1 秒/发，翻倍后约 20 次）");
chk(shotsHero >= 18 && shotsHero <= 24, "远射点射确实翻倍（" + shotsHero + " 次，落在 18~24 之间）");

console.log("\n=== 二、对照：普通步枪兵 ===");
clearScene();
const n1 = ctx.addUnit("rifle", 1400, 1000);
const dummy2 = ctx.addUnit("zombie", 1800, 1000);
dummy2.hp = 999999;
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
console.log("  普通步枪兵 rateMul=" + n1.rateMul);
chk(n1.rateMul === 1, "普通单位没有射速加成");
const shotsPlain = countShots(n1, 10, () => {
  n1.x = 1400; n1.y = 1000; n1.vx = 0; n1.vy = 0;
  dummy2.x = 1800; dummy2.y = 1000; dummy2.vx = 0; dummy2.vy = 0; dummy2.hp = 999999;
});
console.log("  普通步枪兵 10 秒开火 " + shotsPlain + " 次");
chk(shotsHero > shotsPlain * 1.6, "英雄射速明显高于普通（" + shotsHero + " vs " + shotsPlain + "）");

console.log("\n=== 三、平民英雄光环：射速 +20% ===");
clearScene();
const pc = ctx.addUnit("civilian", 1400, 1000);
const pc2 = ctx.addUnit("civilian", 1460, 1000);
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
pc2.dead = true; ctx.cleanup(); ctx.stepSim(1 / 60);
chk(pc.hero === "civilian", "平民英雄升格成功");
const auraR = ctx.fearRadiusOf(pc) * CFG.hero.auraR;
console.log("  光环半径 " + auraR.toFixed(0) + "px，射速加成 ×" + CFG.hero.auraRate);
/* 光环内 */
const inAura = ctx.addUnit("rifle", pc.x + 120, pc.y);
const dz = ctx.addUnit("zombie", pc.x + 900, pc.y);
dz.hp = 999999;
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
console.log("  圈内步枪兵：aura=" + inAura.aura + " rateMul=" + inAura.rateMul);
chk(inAura.aura === 1, "被光环覆盖");
chk(Math.abs(inAura.rateMul - CFG.hero.auraRate) < 1e-6, "射速倍率 = " + CFG.hero.auraRate + "（+20%）");
/* 光环外 */
const outAura = ctx.addUnit("rifle", pc.x + auraR + 200, pc.y);
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
console.log("  圈外步枪兵：aura=" + outAura.aura + " rateMul=" + outAura.rateMul);
chk(outAura.aura === 0 && outAura.rateMul === 1, "圈外没有加成");

console.log("\n=== 四、两者叠加 ===");
inAura.hero = "armed";       /* 直接把它也变成武装英雄，测叠乘 */
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
const expect = CFG.hero.rateMul * CFG.hero.auraRate;
console.log("  武装英雄 + 站在光环里：rateMul=" + inAura.rateMul + "（期望 " + expect + "）");
chk(Math.abs(inAura.rateMul - expect) < 1e-6, "两个加成相乘而不是相加");

console.log("\n=== 五、英雄的附加武器也吃这个倍率 ===");
clearScene();
const g1 = ctx.addUnit("rifle", 1400, 1000);
const g2 = ctx.addUnit("rifle", 1460, 1000);
const dz2 = ctx.addUnit("zombie", 1700, 1000);
dz2.hp = 999999;
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
g2.dead = true; ctx.cleanup(); ctx.stepSim(1 / 60);
let gunShots = 0;
const origHB = ctx.fireBullet;
ctx.fireBullet = function (from, tgt, spread) {
  if (from === g1 && tgt === dz2) gunShots++;
  return origHB.apply(this, arguments);
};
for (let i = 0; i < 60 * 5; i++) { dz2.x = 1700; dz2.y = 1000; dz2.hp = 999999; ctx.stepSim(1 / 60); }
ctx.fireBullet = origHB;
/* 附加武器现在是原武器的副本，期望值要按实际配置算，不能写死 */
const ivA = CFG.far.interval * CFG.hero.guns[0], ivB = CFG.far.interval * CFG.hero.guns[1];
const expNoMul = 5 / ivA + 5 / ivB;
const expMul = 5 / (ivA / CFG.hero.rateMul) + 5 / (ivB / CFG.hero.rateMul);
console.log("  5 秒内附加武器开火 " + gunShots + " 次；不翻倍约 " + expNoMul.toFixed(0) +
  " 次，翻倍约 " + expMul.toFixed(0) + " 次");
chk(gunShots > expNoMul * 1.4, "附加武器同样享受射速翻倍（" + gunShots + " 次，明显多于不翻倍的 " + expNoMul.toFixed(0) + "）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
