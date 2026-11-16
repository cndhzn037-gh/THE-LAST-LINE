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
  W().over = false;              /* 清空单位后 stepSim 会判定"人类全灭"，得把败局标记抹掉 */
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
  W().armedHadMany = 0; W().civHadMany = 0; W().heroTexts.length = 0; W().heroDuo = null;
  CFG.hero.enabled = true;
}

console.log("=== 一、英雄后坐力只剩一成 ===");
clearScene();
const g0 = ctx.addUnit("rifle", 1500, 1000);
const z0 = ctx.addUnit("zombie", 2600, 1000);
z0.hp = 999999;
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
const recNormal = ctx.recoilOf(g0);
g0.hero = "armed";
const recHero = ctx.recoilOf(g0);
console.log("  普通步枪兵后坐力 " + recNormal.toFixed(1) + "px/s → 英雄 " + recHero.toFixed(1) + "px/s（系数 ×" + CFG.hero.recoilMul + "）");
chk(Math.abs(recHero - recNormal * CFG.hero.recoilMul) < 0.01, "后坐力降到原来的 " + (CFG.hero.recoilMul * 100) + "%");
chk(recHero < recNormal * 0.2, "确实只有一成左右");

console.log("\n=== 二、两名英雄会拼命抱团 ===");
clearScene();
/* 造一个武装英雄和一个平民英雄，隔得很远 */
const hA = ctx.addUnit("rifle", 900, 1000);
const hB = ctx.addUnit("rifle", 940, 1000);
ctx.rebuildGrids(); tick(2);
hB.dead = true; ctx.cleanup(); tick(2);
chk(hA.hero === "armed", "武装英雄就位");
const hC = ctx.addUnit("civilian", 2600, 1000);
const hD = ctx.addUnit("civilian", 2640, 1000);
ctx.rebuildGrids(); tick(2);
hD.dead = true; ctx.cleanup(); tick(2);
chk(hC.hero === "civilian", "平民英雄就位");
ctx.stepSim(1 / 60);
console.log("  配对结果：" + (W().heroDuo ? "已结成" : "未结成") + "，两者距离 " +
  Math.hypot(hA.x - hC.x, hA.y - hC.y).toFixed(0) + "px");
chk(!!W().heroDuo, "两名英雄结成了搭档");
const d0 = Math.hypot(hA.x - hC.x, hA.y - hC.y);
tick(60 * 6);
const d1 = Math.hypot(hA.x - hC.x, hA.y - hC.y);
console.log("  6 秒后距离 " + d0.toFixed(0) + " → " + d1.toFixed(0) + "px，武装英雄状态=" + hA.state + "，平民英雄状态=" + hC.state);
chk(d1 < d0 - 300, "两人在拼命靠近（缩短了 " + (d0 - d1).toFixed(0) + "px）");
/* 凑进彼此恐惧半径之后就会交还常规逻辑，所以此时不该还停在 heroPair 上 */
const settled4 = ctx.heroPairSettled(hA);
console.log("  现在相距 " + d1.toFixed(0) + "px，是否已进入彼此恐惧半径=" + settled4);
chk(settled4, "已经凑到彼此的恐惧半径之内");
chk(hA.state !== "heroPair" || !settled4, "凑近之后不再停留在抱团状态");

console.log("\n=== 三、只有一名英雄时不会抱团 ===");
clearScene();
const solo = ctx.addUnit("rifle", 900, 1000);
const solo2 = ctx.addUnit("rifle", 940, 1000);
ctx.rebuildGrids(); tick(2);
solo2.dead = true; ctx.cleanup(); tick(2);
chk(solo.hero === "armed" && !W().heroDuo, "场上只有一名英雄时没有搭档");

console.log("\n=== 四、指名升格按钮 ===");
clearScene();
const plain = ctx.addUnit("rifle", 1500, 1000);
ctx.rebuildGrids();
tick(2);
W().resources = 100;
ctx.togglePromotePick();
W().over = false;
console.log("  资源 100 时按按钮：进入选人=" + ctx.UI.promotePick + "（价格 " + CFG.hero.cost + "）");
chk(!ctx.UI.promotePick, "资源不够时不进入选人状态");
W().resources = CFG.hero.cost + 500;
W().over = false;
ctx.togglePromotePick();
chk(ctx.UI.promotePick === true, "资源充足时进入选人状态");
ctx.tryPromoteAt(plain.x, plain.y);
console.log("  点名升格后：hero=" + plain.hero + "，剩余资源 " + W().resources + "（花费 " + CFG.hero.cost + "）");
chk(plain.hero === "armed", "被指名的单位升格了");
chk(Math.abs(W().resources - 500) < 0.01, "扣掉了 " + CFG.hero.cost + " 资源");
chk(ctx.UI.promotePick === false, "升格后自动退出选人状态");
chk(plain.r > CFG.unit.rifle.r, "体积也变大了（" + CFG.unit.rifle.r + " → " + plain.r.toFixed(1) + "）");

console.log("\n=== 五、指名升格的边界情况 ===");
clearScene();
const dup = ctx.addUnit("rifle", 1500, 1000);
ctx.rebuildGrids(); tick(2);
W().resources = CFG.hero.cost + 1000;
ctx.togglePromotePick();
ctx.tryPromoteAt(dup.x, dup.y);
const after = W().resources;
ctx.togglePromotePick();
ctx.tryPromoteAt(dup.x, dup.y);
console.log("  对同一个英雄再点一次：资源 " + after + " → " + W().resources);
chk(W().resources === after, "已经是英雄的单位不会被重复收费");
/* 点到空地 */
W().resources = CFG.hero.cost + 1000;
W().over = false;
ctx.togglePromotePick();
ctx.tryPromoteAt(200, 200);
console.log("  点到空地：资源 " + W().resources + "，仍在选人=" + ctx.UI.promotePick);
chk(Math.abs(W().resources - (CFG.hero.cost + 1000)) < 0.01, "点到空地不扣资源");
chk(ctx.UI.promotePick === true, "留在选人状态等玩家重新点");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
