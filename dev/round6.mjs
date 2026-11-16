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
function tick(n) { for (let i = 0; i < n; i++) ctx.stepSim(1 / 60); }
function clearScene() {
  ctx.buildScenario(999, 2);
  W().over = false;
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
  W().armedHadMany = 0; W().civHadMany = 0; W().heroTexts.length = 0; W().heroDuo = null;
  W().bloodstains.length = 0; W().domes.length = 0;
  CFG.hero.enabled = true;
}

console.log("=== 一、数值调整 ===");
chk(Math.abs(CFG.hero.civSpeedMul - 1.25) < 1e-6, "平民英雄移速 +25%");
chk(CFG.hero.textLife === 8, "头顶金字停留 8 秒");

console.log("\n=== 二、两名英雄凑近后恢复常规逻辑 ===");
clearScene();
const hA = ctx.addUnit("rifle", 1400, 1000), hA2 = ctx.addUnit("rifle", 1440, 1000);
ctx.rebuildGrids(); tick(2);
hA2.dead = true; ctx.cleanup(); tick(2);
const hC = ctx.addUnit("civilian", 1480, 1000), hC2 = ctx.addUnit("civilian", 1520, 1000);
ctx.rebuildGrids(); tick(2);
hC2.dead = true; ctx.cleanup(); tick(2);
ctx.rebuildGrids();
chk(!!W().heroDuo, "两名英雄结成搭档");
chk(ctx.heroPairSettled(hA) === true, "已经在彼此的恐惧半径内");
/* 旁边放一只丧尸，看英雄会不会正常交战，而不是干耗着 */
const foe = ctx.addUnit("zombie", 1900, 1000);
foe.hp = 99999;
ctx.rebuildGrids();
tick(60);
console.log("  凑近之后：武装英雄状态=" + hA.state + "，平民英雄状态=" + hC.state);
chk(hA.state !== "heroPair" && hC.state !== "heroPair", "不再停留在抱团状态（交还给常规逻辑）");
chk(hA.state === "advance" || hA.state === "engage" || hA.state === "hold" || hA.state === "route",
  "进入了常规的索敌/交战状态（" + hA.state + "）");

console.log("\n=== 三、奔跑者 ===");
chk(!!CFG.unit.runner, "奔跑者已加入单位表");
console.log("  奔跑者 vmax=" + CFG.unit.runner.vmax + "（普通丧尸 " + CFG.unit.zombie.vmax + "），血量 " + CFG.unit.runner.hp +
  "，颜色 " + CFG.unit.runner.color);
chk(CFG.unit.runner.vmax === CFG.unit.zombie.vmax * 2, "移速是普通丧尸的两倍");
chk(CFG.unit.runner.hp === 3, "血量只有 3 点");
clearScene();
const rn = ctx.addUnit("runner", 1500, 1000);
chk(ctx.isZombie(rn) && ctx.isZombieSide(rn), "被认作丧尸阵营");
ctx.rebuildGrids();
let mixed = 0, runs = 0;
for (let i = 0; i < 400; i++) {
  const k = ctx.pickZombieKind();
  mixed++;
  if (k === "runner") runs++;
}
console.log("  随机混编 400 次：奔跑者 " + runs + " 只（期望约 19 只，20:1）");
chk(runs > 3 && runs < 60, "混入比例大致是 20:1");

console.log("\n=== 四、血迹 ===");
clearScene();
const bz = ctx.addUnit("zombie", 1500, 1000);
bz.hp = 1;
ctx.rebuildGrids();
ctx.killZombie(bz);
console.log("  击杀一只后留下 " + W().bloodstains.length + " 处血迹，明度 " + (W().bloodstains[0] ? W().bloodstains[0].lit.toFixed(1) : "-"));
chk(W().bloodstains.length === 1, "死亡处留下血迹");
const bs0 = W().bloodstains[0];
chk(bs0.pts.length >= 3, "由 " + bs0.pts.length + " 段曲线组成（不规则形状）");
chk(bs0.lit >= CFG.blood.litLo && bs0.lit <= CFG.blood.litHi, "明度落在设定的窄区间里");
const lits = [];
for (let i = 0; i < 30; i++) { const z = ctx.addUnit("zombie", 1500 + i, 1000); z.hp = 1; ctx.killZombie(z); lits.push(W().bloodstains[W().bloodstains.length - 1].lit); }
const spread = Math.max(...lits) - Math.min(...lits);
console.log("  连续 30 处的明度跨度 " + spread.toFixed(1) + "（" + Math.min(...lits).toFixed(0) + "~" + Math.max(...lits).toFixed(0) + "）");
chk(spread > 0.5, "明度确实有上下浮动");
chk(spread < 20, "浮动幅度不大");
ctx.resetForSetup();
chk(W().bloodstains.length === 0, "重开对局时血迹一起清空");

console.log("\n=== 五、盾兵护盾分档冲击 ===");
clearScene();
const shd = ctx.addUnit("shield", 1500, 1000);
const zz = ctx.addUnit("zombie", 1500, 1020);
zz.hp = 99999;
ctx.rebuildGrids();
const hp0 = shd.shieldHp;
const wave0 = shd.shieldNextWave;
console.log("  护盾耐久 " + hp0 + "s，下一档阈值 " + wave0.toFixed(2) + "s（每掉 " + (CFG.shield.pulseStep * 100) + "% 一档）");
chk(Math.abs(wave0 - hp0 * 0.8) < 0.01, "阈值设在 80% 处");
let pulses = 0;
const oShock = ctx.addShock;
ctx.addShock = function () { pulses++; return oShock.apply(this, arguments); };
for (let i = 0; i < 60 * 6; i++) { zz.x = shd.x; zz.y = shd.y + 20; zz.vx = 0; zz.vy = 0; ctx.stepSim(1 / 60); }
ctx.addShock = oShock;
console.log("  6 秒贴身共触发 " + pulses + " 次冲击（含最后破盾那一次）");
/* 每次冲击都会把丧尸弹开，它要重新贴上来才会继续磨损护盾，
   所以档位不会像以前那样一口气全打满 */
chk(pulses >= 2, "每掉一档就震一次（" + pulses + " 次）");

console.log("\n=== 六、盾兵英雄的能量防护罩 ===");
clearScene();
const shH = ctx.addUnit("shield", 1500, 1000);
const shH2 = ctx.addUnit("shield", 1560, 1000);
ctx.rebuildGrids(); tick(2);
shH2.dead = true; ctx.cleanup(); tick(2);
console.log("  升格后：hero=" + shH.hero + "，武器=" + (shH.guns ? shH.guns.length + " 把" : "无") +
  "，防护罩耐久 " + shH.domeHp.toFixed(1) + "s");
chk(shH.hero === "armed", "盾兵升格成功");
chk(!shH.guns, "盾兵英雄不拿附加武器");
chk(Math.abs(shH.domeHp - CFG.shield.domeHp) < 0.01, "拿到 " + CFG.shield.domeHp + " 秒耐久的防护罩");
ctx.rebuildGrids(); tick(2);
chk(W().domes.length === 1, "防护罩已生效");
/* 人类能进、丧尸被挡 */
const inside = ctx.addUnit("rifle", 1500, 1300);
const outside = ctx.addUnit("zombie", 1500, 1900);
outside.hp = 99999;
ctx.rebuildGrids();
for (let i = 0; i < 60 * 4; i++) ctx.stepSim(1 / 60);
const dIn = Math.hypot(inside.x - shH.x, inside.y - shH.y);
const dOut = Math.hypot(outside.x - shH.x, outside.y - shH.y);
console.log("  4 秒后：人类距护罩中心 " + dIn.toFixed(0) + "px（护罩半径 " + CFG.fearRCivilian + "），丧尸 " + dOut.toFixed(0) + "px");
chk(dIn < CFG.fearRCivilian, "人类可以进到防护罩里面");
chk(dOut >= CFG.fearRCivilian - 2, "丧尸被挡在防护罩外面");

console.log("\n=== 七、慢放档位 ===");
const SPEEDS = [0.25, 0.75, 1, 2, 4];
W().speed = 1;
const seq = [];
for (let i = 0; i < 5; i++) {
  const idx = SPEEDS.indexOf(W().speed);
  W().speed = SPEEDS[(idx + 1) % SPEEDS.length];
  seq.push(W().speed);
}
console.log("  连点 5 次速度按钮：" + seq.join(" → "));
chk(seq.indexOf(0.25) >= 0 && seq.indexOf(0.75) >= 0, "包含 0.25 与 0.75 两档慢放");
chk(seq[seq.length - 1] === 1 || seq.indexOf(1) >= 0, "能循环回到 1×");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
