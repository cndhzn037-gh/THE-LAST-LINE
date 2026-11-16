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

ctx.GAME_MODE = "defense";
ctx.buildScenario(999, 4);
for (const u of W().units) if (ctx.isZombie(u) || (ctx.isHuman(u) && u.kind !== "rifle")) u.dead = true;
ctx.cleanup();
W().units = W().units.filter(u => u.kind === "rifle");

console.log("=== 一、丧尸移速 ===");
console.log("  丧尸 vmax=" + CFG.unit.zombie.vmax + "  母体 vmax=" + CFG.unit.mother.vmax +
  "  平民 " + CFG.unit.civilian.vmax + "  步枪兵 " + CFG.unit.rifle.vmax);
chk(CFG.unit.zombie.vmax > 130, "丧尸移速已提高（原 130 → " + CFG.unit.zombie.vmax + "）");
chk(CFG.unit.mother.vmax > 84, "母体同步提高（原 84 → " + CFG.unit.mother.vmax + "）");

console.log("\n=== 二、中弹：沿子弹方向击退 + 减速 ===");
const gun = W().units[0];
gun.x = 1200; gun.y = 1000;
const z = ctx.addUnit("zombie", 1500, 1000);      /* 丧尸在射手右边 */
z.hp = 99999; z.vx = 0; z.vy = 0; z.slowT = 0; z.kbT = -999;
W().t = 5;
ctx.damageZombie(z, 1, gun);
console.log("  命中后速度 (" + z.vx.toFixed(0) + ", " + z.vy.toFixed(0) + ")  减速剩余 " + z.slowT.toFixed(2) + "s");
chk(z.vx > 30 && Math.abs(z.vy) < 2, "沿子弹来向被推开（+x " + z.vx.toFixed(0) + "px/s）");
chk(z.slowT > 0, "进入减速状态 " + z.slowT.toFixed(2) + "s");
chk(z.vmaxBoost > 30, "击退给了额外速度余量，不会被自己的限速吃掉");

console.log("\n=== 三、减速确实压制了移动上限 ===");
z.vx = CFG.unit.zombie.vmax; z.vy = 0; z.vmaxCur = CFG.unit.zombie.vmax;
z.vmaxBoost = 0; z.boostT = 0; z.slowT = 0.35;
ctx.integrate(1 / 60);
let sp = Math.hypot(z.vx, z.vy);
const capped = CFG.unit.zombie.vmax * CFG.hitStagger.slowMul;
console.log("  减速中：速度 " + sp.toFixed(0) + "px/s（上限被压到 " + capped.toFixed(0) + "）");
chk(sp <= capped + 1, "减速期间跑不快了");
z.slowT = 0; z.vx = CFG.unit.zombie.vmax; z.vy = 0;
ctx.integrate(1 / 60);
sp = Math.hypot(z.vx, z.vy);
console.log("  恢复后：速度 " + sp.toFixed(0) + "px/s");
chk(sp > capped + 5, "减速结束后恢复原速");

console.log("\n=== 四、冷却是按同一只丧尸算的 ===");
z.vx = 0; z.vy = 0; z.kbT = -999; W().t = 10;
ctx.damageZombie(z, 1, gun);
const v1 = z.vx;
z.vx = 0; z.vy = 0;
W().t = 10 + CFG.hitStagger.cd * 0.5;             /* 冷却还没过 */
ctx.damageZombie(z, 1, gun);
console.log("  首次击退 " + v1.toFixed(0) + "px/s；冷却期内再打一次 -> " + z.vx.toFixed(0) + "px/s");
chk(Math.abs(z.vx) < 1, "冷却期内不会重复击退（挡住机枪把目标钉死）");
z.vx = 0; z.vy = 0;
W().t = 10 + CFG.hitStagger.cd * 1.5;             /* 冷却过了 */
ctx.damageZombie(z, 1, gun);
chk(z.vx > 30, "冷却过后又能击退");

console.log("\n=== 五、减速会自己恢复 ===");
z.slowT = CFG.hitStagger.slowTime;
let frames = 0;
while (z.slowT > 0 && frames < 600) { ctx.integrate(1 / 60); z.slowT -= 0; frames++; }
console.log("  约 " + (frames / 60).toFixed(2) + " 秒后恢复");
chk(z.slowT <= 0, "减速计时会走完");

console.log("\n=== 六、丧尸阵营的伤害不算击退（不会被同类推着走） ===");
const z2 = ctx.addUnit("zombie", 1600, 1000);
z2.hp = 99999; z2.vx = 0; z2.vy = 0; z2.kbT = -999;
W().t = 20;
ctx.damageZombie(z2, 1, null);
chk(Math.abs(z2.vx) < 0.01, "没有射手来源的伤害不产生击退");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
