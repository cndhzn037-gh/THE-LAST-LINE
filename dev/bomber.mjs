import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop, getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN, Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } }, document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(gcode, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
const CFG = ctx.CFG;
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }
function freshScene() {
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 2;
  ctx.buildScenario(3, 2); ctx.W.over = false; ctx.W.paused = false;
  for (const u of ctx.W.units) u.dead = true;
  ctx.cleanup(); ctx.W.tongues.length = 0;
  if (ctx.W.bombFx) ctx.W.bombFx.length = 0;
  ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
}

console.log("=== 一、单位设定 ===");
const b = CFG.unit.bomber;
console.log("  体型 " + b.r + "（母体 " + CFG.unit.mother.r + "，普通 " + CFG.unit.zombie.r +
  "），速度 " + b.vmax + "（母体 " + CFG.unit.mother.vmax + "，普通 " + CFG.unit.zombie.vmax + "）");
chk(b.r > CFG.unit.zombie.r && b.r < CFG.unit.mother.r, "体型夹在母体和普通丧尸之间");
chk(b.vmax > CFG.unit.mother.vmax && b.vmax < CFG.unit.zombie.vmax, "速度也夹在两者之间");
chk(b.color.toLowerCase() === "#939b1c", "颜色 RGB(147,155,28) = #939b1c");
chk(b.hp === CFG.unit.licker.hp * 1.5, "血量是舔舐者的 1.5 倍（" + b.hp + "）");
chk(ctx.isZombieKind("bomber"), "归入丧尸阵营");
const raw = html;
chk(raw.indexOf('<option value="bomber">自爆丧尸</option>') >= 0, "放置表里有它");
let cnt = 0; const N = 30000;
for (let i = 0; i < N; i++) if (ctx.pickZombieKind() === "bomber") cnt++;
console.log("  刷新比例：" + N + " 次里出现 " + cnt + " 次 ≈ " + (N / cnt).toFixed(1) + " : 1");
chk(N / cnt > 70 && N / cnt < 135, "刷新比例在 100 : 1 附近");

console.log("=== 二、中弹反应：只微微后退 + 停顿 ===");
freshScene();
const z1 = ctx.addUnit("bomber", 2000, 1200);
const z2 = ctx.addUnit("zombie", 2000, 1400);
ctx.rebuildGrids();
z1.hp = 99; z2.hp = 99;
const rifle = ctx.addUnit("rifle", 1600, 1200);
ctx.rebuildGrids();
const x0 = z1.x, y0 = z2.x;
ctx.damageZombie(z1, 1, rifle);
ctx.damageZombie(z2, 1, rifle);
console.log("  同一枪：自爆丧尸被推 " + Math.abs(z1.vx).toFixed(1) + "px/s，普通丧尸 " + Math.abs(z2.vx).toFixed(1) + "px/s");
chk(Math.abs(z1.vx) < Math.abs(z2.vx) * 0.35, "自爆丧尸的击退明显更小");
chk(z1.slowT > 0 && z1.slowT <= 0.2, "停顿 " + z1.slowT.toFixed(2) + " 秒（要求 0.1~0.2）");
chk(z1.slowMul < 0.3, "停顿期间几乎站住（速度只剩三成以下）");

console.log("=== 三、死亡不立刻消失，先蓄爆一秒 ===");
freshScene();
const bomb = ctx.addUnit("bomber", 2000, 1200);
const civN = ctx.addUnit("civilian", 2000, 1400);      /* 在冲击波里 */
const civFar = ctx.addUnit("civilian", 4000, 3200);    /* 在外面 */
ctx.rebuildGrids();
bomb.hp = 1;
const k0 = ctx.W.kills;
ctx.damageZombie(bomb, 99, null);
console.log("  血量打光后：dead=" + bomb.dead + "，armT=" + (bomb.armT || 0).toFixed(2) + "，击杀数 " + ctx.W.kills);
chk(!bomb.dead, "没有立刻消失");
chk(Math.abs((bomb.armT || 0) - CFG.bomber.armT) < 0.02, "进入 1 秒蓄爆");
chk(ctx.W.kills === k0, "击杀记账还没结算");
const bx0 = bomb.x, by0 = bomb.y;
tick(0.6);
console.log("  0.6 秒后：还在=" + (!bomb.dead) + "，位移 " + Math.hypot(bomb.x - bx0, bomb.y - by0).toFixed(2) + "px");
chk(!bomb.dead && Math.hypot(bomb.x - bx0, bomb.y - by0) < 2, "蓄爆期间钉在原地");
/* 蓄爆期间疯狂补刀：软无敌，不许把它直接打死 */
for (let i = 0; i < 20; i++) { ctx.damageZombie(bomb, 99, null); ctx.stepSim(1 / 60); }
console.log("  蓄爆中连挨 20 发 99 伤害：dead=" + bomb.dead + "，armT=" + (bomb.armT || 0).toFixed(2));
chk(!bomb.dead, "蓄爆期间打不死，不会直接消失");
chk((bomb.armT || 0) > 0, "蓄爆计时还在走");
tick(0.03);
chk(!bomb.dead, "补刀期间仍然还在场上");
tick(0.05);
console.log("  1.2 秒后：dead=" + bomb.dead + "，击杀数 " + ctx.W.kills + "，冲击波 " + ctx.W.shocks.length + " 个");
chk(bomb.dead, "一秒后炸开并消失");
chk(ctx.W.kills === k0 + 1, "爆炸那一刻才记一次击杀");

console.log("=== 四、爆炸效果 ===");
const R = CFG.fearRCivilian * CFG.bomber.blastRMul;
console.log("  冲击波半径 " + R + "px（平民恐惧范围直径）");
const bigShock = ctx.W.shocks.find(s => Math.abs(s.r - R) < 1);
chk(!!bigShock, "放出了一圈对应半径的黄色冲击波");
chk(ctx.W.bloodstains.length > 0, "身下留下了血迹");
console.log("  被波及的平民：slowT=" + (civN.slowT || 0).toFixed(2) + "，速度倍率=" + (civN.slowMul || 1).toFixed(2));
chk(civN.slowT > 0.6, "范围内的人类被减速 1 秒");
chk(Math.abs((civN.slowMul || 1) - 0.2) < 0.01, "只剩 20% 速度（减速 80%）");
chk((civFar.slowT || 0) === 0, "范围外的人不受影响");

console.log("=== 五、爆炸后的散落特效 ===");
let bloodBefore = ctx.W.bloodstains.length;
tick(0.7);
console.log("  0.7 秒后血迹总数 " + ctx.W.bloodstains.length + "（爆炸瞬间 " + bloodBefore + "）");
chk(ctx.W.bloodstains.length > bloodBefore, "0.5 秒内陆续溅出了额外的血");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));