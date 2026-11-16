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
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
  W().armedHadMany = 0; W().civHadMany = 0; W().heroTexts.length = 0;
}
CFG.hero.enabled = true;

console.log("=== 一、数值强化 ===");
console.log("  文本时长 " + CFG.hero.textLife + "s，光环系数 " + CFG.hero.auraR + "，冲击波系数 " + CFG.hero.shockR +
  "，平民加速 ×" + CFG.hero.civSpeedMul + "，附加武器 " + CFG.hero.guns.length + " 把");
chk(CFG.hero.textLife === 8, "头顶金字改为 8 秒");
chk(Math.abs(CFG.hero.auraR - 1.5) < 1e-6, "光环半径改为恐惧半径的 150%");
chk(Math.abs(CFG.hero.shockR - 2.0) < 1e-6, "击退光圈改为恐惧半径的 200%");
chk(CFG.hero.guns.length === 2, "武装英雄有两把附加武器");
chk(CFG.hero.guns[0] !== CFG.hero.guns[1], "两把武器的攻速系数不同（×" +
  CFG.hero.guns[0] + " vs ×" + CFG.hero.guns[1] + "）");

console.log("\n=== 二、平民英雄：速度、光环半径、击退半径 ===");
clearScene();
const p1 = ctx.addUnit("civilian", 1500, 1000);
const p2 = ctx.addUnit("civilian", 1560, 1000);
ctx.rebuildGrids();
tick(2);
const vBefore = p1.vmax;
p2.dead = true; ctx.cleanup(); tick(2);
console.log("  升格后：vmax " + vBefore + " → " + p1.vmax + "，恐惧半径 " + ctx.fearRadiusOf(p1) +
  "，光环半径 " + (ctx.fearRadiusOf(p1) * CFG.hero.auraR).toFixed(0) + "px");
chk(p1.hero === "civilian", "平民升格成功");
chk(Math.abs(p1.vmax - vBefore * CFG.hero.civSpeedMul) < 0.01, "移速提升 12%（" + vBefore + " → " + p1.vmax.toFixed(1) + "）");

/* 光环范围要跟着放大：站在 130px 外（旧半径内、新半径外）的人现在也该被覆盖 */
const nearGun = ctx.addUnit("rifle", p1.x + 300, p1.y);
const farGun2 = ctx.addUnit("rifle", p1.x + 500, p1.y);
ctx.rebuildGrids();
console.log("  300px 处步枪兵 aura=" + nearGun.aura + "，500px 处 aura=" + farGun2.aura +
  "（平民恐惧半径 " + ctx.fearRadiusOf(p1) + "，150% = " + (ctx.fearRadiusOf(p1) * 1.5).toFixed(0) + "px）");
chk(nearGun.aura === 1, "300px 处在光环内（旧的 130px 半径覆盖不到）");
chk(farGun2.aura === 0, "500px 处在光环外");

console.log("\n=== 三、武装英雄：两把武器 + 免射击减速 ===");
clearScene();
const a1 = ctx.addUnit("rifle", 1500, 1000);
const a2 = ctx.addUnit("rifle", 1580, 1000);
const foe = ctx.addUnit("zombie", 2000, 1000);
foe.hp = 99999;
ctx.rebuildGrids();
tick(2);
a2.dead = true; ctx.cleanup(); tick(2);
chk(a1.hero === "armed", "武装升格成功");
console.log("  附加武器 " + a1.guns.length + " 把：" + a1.guns.map((g, i) =>
  "第" + (i + 1) + "把 " + g.interval.toFixed(3) + "s/" + g.mag + "发/伤害" + g.dmg).join("，"));
console.log("  原武器（步枪）：" + CFG.far.interval + "s/" + CFG.far.mag + "发/伤害" + CFG.far.dmg);
chk(a1.guns && a1.guns.length === 2, "拿到两把附加武器");
/* 附加武器必须是他自己那把枪的复制品：伤害、弹匣、射程都要一致，只有攻速浮动 */
chk(a1.guns.every(g => g.dmg === CFG.far.dmg), "伤害与原武器一致（" + CFG.far.dmg + "）");
chk(a1.guns.every(g => g.magSize === CFG.far.mag), "弹匣容量与原武器一致（" + CFG.far.mag + " 发）");
chk(a1.guns.every(g => g.r === CFG.far.r), "射程与原武器一致（" + CFG.far.r + "）");
chk(Math.abs(a1.guns[0].interval - CFG.far.interval * CFG.hero.guns[0]) < 1e-6 &&
    Math.abs(a1.guns[1].interval - CFG.far.interval * CFG.hero.guns[1]) < 1e-6,
    "攻速只是围绕原武器浮动（" + CFG.far.interval + "s → " +
    a1.guns.map(g => g.interval.toFixed(2) + "s").join(" / ") + "）");
const m0 = a1.guns.map(g => g.mag);
/* 附加武器是原武器的副本，步枪的间隔本来就是 1 秒上下，
   观察窗口必须比它长，否则根本还没轮到开火 */
tick(60 * 4);
const m1 = a1.guns.map(g => g.mag);
console.log("  4 秒后两把的弹匣：" + m0.join("/") + " → " + m1.join("/"));
chk(m1[0] < m0[0] || m1[1] < m0[1], "两把武器都在独立开火");

/* 射击减速豁免：开火状态下比较英雄与普通武装的 vmaxCur */
a1.fireHold = 1;
ctx.stepSim(1 / 60);
const heroVmax = a1.vmaxCur;
const plain = ctx.addUnit("rifle", 2500, 1000);
plain.fireHold = 1;
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
console.log("  同样处于开火状态：英雄 vmaxCur=" + heroVmax.toFixed(0) + "，普通步枪兵 vmaxCur=" + plain.vmaxCur.toFixed(0));
chk(heroVmax > plain.vmaxCur, "英雄不再吃射击减速惩罚");

console.log("\n=== 四、换弹时不再原地站着 ===");
clearScene();
const rl = ctx.addUnit("rifle", 1500, 1000);
const zl = ctx.addUnit("zombie", 1750, 1000);   /* 在远射圈内、恐惧圈外 */
zl.hp = 99999;
ctx.rebuildGrids();
tick(10);
rl.mag = 0; rl.reloading = true; rl.reloadT = 5;   /* 强制进入换弹 */
const rx0 = rl.x, ry0 = rl.y;
let moved = 0;
for (let i = 0; i < 60; i++) {
  zl.x = 1750; zl.y = 1000; zl.vx = 0; zl.vy = 0;
  ctx.stepSim(1 / 60);
  moved = Math.max(moved, Math.hypot(rl.x - rx0, rl.y - ry0));
}
console.log("  换弹期间状态=" + rl.state + "，最大位移 " + moved.toFixed(0) + "px");
chk(moved > 12, "换弹时没有原地不动（移动了 " + moved.toFixed(0) + "px）");

console.log("\n=== 五、十秒不开火自动补满弹匣 ===");
clearScene();
const rr = ctx.addUnit("rifle", 1500, 1000);
ctx.rebuildGrids();
tick(2);
rr.mag = 3; rr.lastFireT = W().t - 11;            /* 假装 11 秒没开枪 */
ctx.stepSim(1 / 60);
console.log("  11 秒没开火：弹匣 " + rr.mag + "/" + rr.magSize + "，换弹中=" + rr.reloading);
chk(rr.mag === rr.magSize, "弹匣被自动补满");
rr.mag = 3; rr.reloading = true; rr.reloadT = 5; rr.lastFireT = W().t - 11;
ctx.stepSim(1 / 60);
console.log("  换弹中且久未开火：弹匣 " + rr.mag + "/" + rr.magSize + "，换弹中=" + rr.reloading);
chk(!rr.reloading && rr.mag === rr.magSize, "换弹也被打断并直接补满");
rr.mag = 3; rr.lastFireT = W().t - 2;             /* 刚开过枪 */
ctx.stepSim(1 / 60);
chk(rr.mag === 3, "刚开过火的单位不会被补满（仍然是 " + rr.mag + "）");

console.log("\n=== 六、玩家按 R 换弹 ===");
clearScene();
const pl = ctx.addUnit("rifle", 1500, 1000);
ctx.rebuildGrids();
ctx.PLAYER.on = true;
ctx.PLAYER.unit = pl;
pl.mag = 4; pl.reloading = false;
ctx.keys["r"] = true;
ctx.stepPlayerInput(1 / 60);
console.log("  按 R 后：换弹中=" + pl.reloading + "，剩余 " + pl.reloadT.toFixed(2) + "s，弹匣 " + pl.mag);
chk(pl.reloading === true, "R 键触发了换弹");
chk(pl.reloadT > 0, "换弹计时已启动（" + pl.reloadT.toFixed(2) + "s）");
chk(ctx.keys["r"] === false, "按键被消费，不会反复触发");
/* 满弹时按 R 不该有反应 */
pl.reloading = false; pl.mag = pl.magSize;
ctx.keys["r"] = true;
ctx.stepPlayerInput(1 / 60);
chk(!pl.reloading, "满弹时按 R 不会白换");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
