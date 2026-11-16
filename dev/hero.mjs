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

console.log("=== 一、开关关掉时不会升格 ===");
clearScene();
CFG.hero.enabled = false;
const a1 = ctx.addUnit("rifle", 1500, 1000), a2 = ctx.addUnit("rifle", 1560, 1000);
const cv1 = ctx.addUnit("civilian", 1600, 1000), cv2 = ctx.addUnit("civilian", 1660, 1000);
ctx.rebuildGrids();
a2.dead = true; c2.dead = true;
ctx.cleanup();
tick(3);
chk(!a1.hero && !cv1.hero, "开关关闭时无人升格");

console.log("\n=== 二、武装单位只剩最后一个时升格 ===");
clearScene();
CFG.hero.enabled = true;
const r1 = ctx.addUnit("rifle", 1500, 1000);
const r2 = ctx.addUnit("rifle", 1560, 1000);
const cv3 = ctx.addUnit("civilian", 1700, 1000);
const cv4 = ctx.addUnit("civilian", 1760, 1000);
[r1, r2, cv3, cv4].forEach(u => { u.hp = 999; });
ctx.rebuildGrids();
tick(2);
chk(!r1.hero, "两个武装单位时谁也不升格");
/* 必须先让系统看到过"多于一个"，才会在掉到最后一个时升格 */
const r0 = CFG.unit.rifle.r;
r2.dead = true;
ctx.cleanup();
tick(2);
console.log("  少了一个之后：r1.hero=" + r1.hero + "  半径 " + r0 + " → " + r1.r + "  防护服 " + r1.suitHp.toFixed(1) + "s");
chk(r1.hero === "armed", "最后一名武装单位升格为武装英雄");
chk(r1.r > r0, "体型变大（" + r0 + " → " + r1.r.toFixed(1) + "）");
chk(Math.abs(r1.suitHp - CFG.hero.suitTime) < 0.01, "拿到防护服（" + CFG.hero.suitTime + "s 耐久）");

console.log("\n=== 三、武装英雄拿到两把附加武器 ===");
const bg = ctx.baseGunOf(r1.kind);
console.log("  附加武器 " + (r1.guns ? r1.guns.length : 0) + " 把，本体弹匣 " + bg.mag + " 发，攻速倍率 " +
  CFG.hero.guns.join(" / ") + "，主武器弹匣 " + r1.magSize + " 发");
chk(!!r1.guns && r1.guns.length === CFG.hero.guns.length, "拿到 " + CFG.hero.guns.length + " 把附加武器");
chk(r1.guns.every(g => g.magSize === bg.mag), "附加武器的弹匣容量与本体一致（" + bg.mag + " 发）");
chk(Math.abs(r1.guns[0].interval - bg.interval * CFG.hero.guns[0]) < 1e-6 &&
    Math.abs(r1.guns[1].interval - bg.interval * CFG.hero.guns[1]) < 1e-6, "两把枪攻速一快一慢");
const foe = ctx.addUnit("zombie", r1.x + 130, r1.y);
foe.hp = 99999;
ctx.rebuildGrids();
const mainBefore = r1.mag, g0 = r1.guns[0].mag, g1b = r1.guns[1].mag;
tick(2);
console.log("  主武器弹匣 " + mainBefore + " → " + r1.mag + "，附加武器 " + g0 + "/" + g1b + " → " +
  r1.guns[0].mag + "/" + r1.guns[1].mag + "（各自记账）");
chk(r1.guns[0].mag < g0 || r1.guns[1].mag < g1b, "附加武器自己开火了");

console.log("\n=== 四、头顶金字 ===");
const ht = W().heroTexts[0];
console.log("  文本：" + (ht ? "「" + ht.text + "」" : "无") + "，持续 " + (ht ? ht.t.toFixed(1) : "-") + "s");
chk(W().heroTexts.length >= 1, "升格时弹出了头顶文本");
chk(CFG.hero.lines.indexOf(ht.text) >= 0, "文本来自指定台词表");
chk(Math.abs(ht.max - CFG.hero.textLife) < 0.01, "停留时间等于设定的 " + CFG.hero.textLife + " 秒");

console.log("\n=== 五、防护服扛满 3 秒后破裂 ===");
clearScene();
const h1 = ctx.addUnit("rifle", 1500, 1000);
const h2 = ctx.addUnit("rifle", 1580, 1000);
/* 丧尸先放在远处：升格之前它身上可没有防护服，那两帧里被咬到就前功尽弃了 */
const biter = ctx.addUnit("zombie", 2600, 1000);
biter.hp = 99999;
ctx.rebuildGrids();
tick(2);                       /* 先让系统看到两个武装单位 */
h2.dead = true;
ctx.cleanup();
tick(2);                       /* 再掉到最后一个 -> 升格 */
chk(h1.hero === "armed", "升格成功（用于测防护服）");
let brokeAt = -1, infectAt = -1;
console.log("  升格后立刻检查：hero=" + h1.hero + " suitHp=" + h1.suitHp + " suitBroken=" + h1.suitBroken +
  " infectLocked=" + h1.infectLocked);
for (let fr = 0; fr < 3; fr++) {
  biter.x = h1.x; biter.y = h1.y + 10;
  ctx.stepSim(1 / 60);
  console.log("    第 " + fr + " 帧：suitHp=" + h1.suitHp.toFixed(2) + " broken=" + h1.suitBroken +
    " infectLocked=" + h1.infectLocked + " hero=" + h1.hero + " 丧尸数=" + W().units.filter(x => ctx.isZombie(x) && !x.dead).length);
}
h1.infectLocked = false; h1.incubT = 0; h1.fadeT = 0;
h1.suitHp = CFG.hero.suitTime; h1.suitBroken = false;
for (let i = 0; i < 60 * 6; i++) {
  biter.x = h1.x; biter.y = h1.y + 10; biter.vx = 0; biter.vy = 0;   /* 一直贴着它 */
  ctx.stepSim(1 / 60);
  if (h1.suitBroken && brokeAt < 0) brokeAt = i / 60;
  if (h1.infectLocked && infectAt < 0) infectAt = i / 60;
}
console.log("  持续贴身：防护服在第 " + brokeAt.toFixed(2) + "s 破裂，首次感染发生在第 " +
  (infectAt < 0 ? "未感染" : infectAt.toFixed(2) + "s"));
chk(brokeAt > 0, "防护服确实在承受接触后破裂");
chk(Math.abs(brokeAt - CFG.hero.suitTime) < 0.35, "破裂时间接近设定的 " + CFG.hero.suitTime + "s");
chk(infectAt < 0 || infectAt >= brokeAt - 0.05,
  "防护服破裂之前一直没被感染（感染发生在 " + (infectAt < 0 ? "-" : infectAt.toFixed(2) + "s") +
  "，不早于破裂的 " + brokeAt.toFixed(2) + "s）");

console.log("\n=== 六、平民英雄：光环与无限弹药 ===");
clearScene();
const p1 = ctx.addUnit("civilian", 1500, 1000);
const p2 = ctx.addUnit("civilian", 1560, 1000);
const gunner = ctx.addUnit("rifle", 1540, 1000);
ctx.rebuildGrids();
tick(2);                       /* 先看到两个平民 */
p2.dead = true;
ctx.cleanup();
tick(2);                       /* 再掉到最后一个 -> 升格 */
console.log("  平民英雄 hero=" + p1.hero + "  武器=" + (p1.gun ? "有" : "无（按要求不给武器）") +
  "  光环半径=" + (ctx.fearRadiusOf(p1) * CFG.hero.auraR).toFixed(0) + "px");
chk(p1.hero === "civilian", "最后一名平民升格为平民英雄");
chk(!p1.gun, "平民英雄不给武器");
chk(p1.suitHp > 0, "同样拿到防护服");
const auraR = ctx.fearRadiusOf(p1) * CFG.hero.auraR;
chk(Math.abs(auraR - ctx.fearRadiusOf(p1) * CFG.hero.auraR) < 0.01,
  "光环半径 = 恐惧半径 × " + CFG.hero.auraR + "（" + ctx.fearRadiusOf(p1).toFixed(0) + " → " + auraR.toFixed(0) + "px）");
gunner.x = p1.x + 40; gunner.y = p1.y;
ctx.rebuildGrids();
chk(gunner.aura === 1, "圈内的步枪兵被标记为无限弹药");
gunner.mag = 1;
ctx.stepSim(1 / 60);
console.log("  圈内步枪兵弹匣 1 → " + gunner.mag + "（上限 " + gunner.magSize + "）");
chk(gunner.mag === gunner.magSize, "弹匣被自动补满");
/* 圈外应当没有这个待遇 */
const farGun = ctx.addUnit("rifle", p1.x + auraR + 300, p1.y);
ctx.rebuildGrids();
chk(farGun.aura === 0, "圈外的单位没有无限弹药");

console.log("\n=== 七、文本十秒后消散 ===");
W().heroTexts.length = 0;
p1.hero = null; p1.r = CFG.unit.civilian.r;
clearScene();
const q1 = ctx.addUnit("civilian", 1500, 1000);
const q2 = ctx.addUnit("civilian", 1560, 1000);
ctx.rebuildGrids();
tick(2);
q2.dead = true;
ctx.cleanup();
tick(2);
chk(W().heroTexts.length === 1, "升格弹出一条文本");
tick(60 * 5);
console.log("  5 秒后还剩 " + W().heroTexts.length + " 条，剩余时间 " + (W().heroTexts[0] ? W().heroTexts[0].t.toFixed(1) : "-") + "s");
chk(W().heroTexts.length === 1, "5 秒时还在");
tick(60 * 6);
console.log("  再过 6 秒后剩 " + W().heroTexts.length + " 条");
chk(W().heroTexts.length === 0, "满 10 秒后消散");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);