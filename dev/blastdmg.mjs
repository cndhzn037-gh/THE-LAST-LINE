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
  CFG.hero.enabled = true;
}

console.log("=== 一、护盾分档冲击有伤害 ===");
clearScene();
const shd = ctx.addUnit("shield", 1500, 1000);
const z1 = ctx.addUnit("zombie", 1500, 1030);
z1.hp = 50; z1.maxHp = 50;
ctx.rebuildGrids();
const hp0 = z1.hp;
/* 直接放一次分档冲击 */
ctx.shieldPulse(shd, CFG.fearR, CFG.shield.pulseDmg, CFG.shield.pulsePush);
console.log("  冲击后：pendingDmg=" + z1.pendingDmg + "，血量 " + z1.hp + "（原本 " + hp0 + "），伤害设定 " + CFG.shield.pulseDmg);
chk(z1.pendingDmg === CFG.shield.pulseDmg, "伤害被记下来了（" + z1.pendingDmg + "）");
/* 等落地 */
for (let i = 0; i < 60 * 2; i++) { z1.hp = Math.max(z1.hp, 0); ctx.stepSim(1 / 60); }
console.log("  落地后血量 " + z1.hp + "（期望 " + (hp0 - CFG.shield.pulseDmg) + "）");
chk(z1.hp === hp0 - CFG.shield.pulseDmg || z1.dead, "落地后伤害结算了");

console.log("\n=== 二、金光冲击波有伤害 ===");
clearScene();
const heroU = ctx.addUnit("rifle", 1500, 1000);
const h2 = ctx.addUnit("rifle", 1560, 1000);
ctx.rebuildGrids(); tick(2);
h2.dead = true; ctx.cleanup(); tick(2);
chk(heroU.hero === "armed", "升格成功");
const zz = ctx.addUnit("zombie", 1560, 1000);
zz.hp = 50; zz.maxHp = 50;
/* 把英雄摁在换弹状态里：否则他会一直开枪，血量变化就分不清是谁打的了 */
heroU.reloading = true; heroU.reloadT = 999;
heroU.guns = null;   /* 附加武器是独立自动开火的，不受主武器换弹影响 */
ctx.rebuildGrids();
ctx.heroShockwave(heroU);
console.log("  金光冲击：pendingDmg=" + zz.pendingDmg + "，伤害设定 " + CFG.hero.shockDmg);
chk(zz.pendingDmg === CFG.hero.shockDmg, "金光伤害被记下来了");
const zhp = zz.hp;
for (let i = 0; i < 60 * 2; i++) { zz.hp = Math.max(zz.hp, 0); ctx.stepSim(1 / 60); }
chk(zz.hp === zhp - CFG.hero.shockDmg || zz.dead, "落地后结算（" + zhp + " → " + zz.hp + "）");

console.log("\n=== 三、破盾与殉爆仍然只有击退、不造成伤害 ===");
clearScene();
const sd2 = ctx.addUnit("shield", 1500, 1000);
const z3 = ctx.addUnit("zombie", 1560, 1000);
z3.hp = 50; z3.maxHp = 50;
ctx.rebuildGrids();
ctx.shieldBlast(sd2);
console.log("  破盾冲击：pendingDmg=" + z3.pendingDmg + "（这道冲击本来就没有伤害）");
chk(z3.pendingDmg === 0, "破盾冲击不伤人，只击退");
const z3x = z3.x;
for (let i = 0; i < 60 * 2; i++) { ctx.stepSim(1 / 60); }
chk(z3.x > z3x, "但确实被推开了（" + z3x.toFixed(0) + " → " + z3.x.toFixed(0) + "）");

console.log("\n=== 四、血迹透明度 ===");
console.log("  当前 alpha " + CFG.blood.alpha);
chk(CFG.blood.alpha < 0.46, "比上一版更淡了");
chk(CFG.blood.alpha >= 0.2, "但还没淡到看不见");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
