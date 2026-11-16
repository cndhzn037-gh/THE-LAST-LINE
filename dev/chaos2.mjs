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
function chaos(n, hero) {
  ctx.GAME_MODE = "chaos";
  ctx.START.gameMode = "chaos";
  ctx.START.chaosCiv = n;
  ctx.START.heroMode = !!hero;
  CFG.hero.enabled = !!hero;
  ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false; ctx.EDIT.units = null;
  ctx.buildScenario(999, 0);
  let g = 0;
  while (W().countdown > 0 && g++ < 60 * 15) ctx.stepSim(1 / 60);
}

console.log("=== 一、比例调整 ===");
console.log("  步枪兵 " + (CFG.chaos.mix.rifle * 100).toFixed(1) + "%，机枪手 " + (CFG.chaos.mix.mg * 100).toFixed(1) + "%");
chk(Math.abs(CFG.chaos.mix.rifle - 0.04) < 1e-9, "步枪兵下调到 4%");
chk(Math.abs(CFG.chaos.mix.mg - 0.008) < 1e-9, "机枪手上调到 0.8%");
chaos(1200, false);
const cnt = {};
for (const u of W().units) if (!u.dead) cnt[u.kind] = (cnt[u.kind] || 0) + 1;
const n0 = W().chaosCiv0;
console.log("  平民 " + n0 + "：步枪兵 " + (cnt.rifle || 0) + "（期望 " + Math.floor(n0 * 0.04) + "），" +
  "机枪 " + (cnt.mg || 0) + "（期望 " + Math.floor(n0 * 0.008) + "）");
chk((cnt.rifle || 0) === Math.floor(n0 * 0.04), "步枪兵数量对");
chk((cnt.mg || 0) === Math.floor(n0 * 0.008), "机枪兵数量对");

console.log("\n=== 二、丧尸血量三倍 ===");
console.log("  模式倍率 zombieHpMul=" + CFG.game.zombieHpMul + "（设定 " + CFG.chaos.zombieHpMul + "）");
chk(CFG.game.zombieHpMul === 3, "混沌模式丧尸血量倍率 3");
const zz = W().units.find(u => !u.dead && u.kind === "zombie");
const rr = W().units.find(u => !u.dead && u.kind === "runner");
const mm = W().units.find(u => !u.dead && u.kind === "mother");
console.log("  普通丧尸 hp=" + (zz ? zz.hp : "-") + "（基础 " + CFG.unit.zombie.hp + "）" +
  "，奔跑者 hp=" + (rr ? rr.hp : "-") + "（基础 " + CFG.unit.runner.hp + "）" +
  "，母体 hp=" + (mm ? mm.hp : "-") + "（基础 " + CFG.unit.mother.hp + "）");
chk(zz && zz.hp === CFG.unit.zombie.hp * 3, "普通丧尸 5 → 15");
chk(rr && rr.hp === CFG.unit.runner.hp * 3, "奔跑者 3 → 9");
chk(mm && mm.hp === CFG.unit.mother.hp * 3, "母体 120 → 360");
/* 人类不加血 */
const rf = W().units.find(u => !u.dead && u.kind === "rifle");
chk(rf && rf.hp === CFG.unit.rifle.hp, "人类单位血量不受影响（" + (rf ? rf.hp : "-") + "）");

console.log("\n=== 三、子弹击退翻倍 ===");
console.log("  模式倍率 knockMul=" + CFG.game.knockMul + "（基础击退 " + CFG.hitStagger.knock + "）");
chk(CFG.game.knockMul === 2, "混沌模式击退倍率 2");
chaos(60, false);
const gun = ctx.addUnit("rifle", 1000, 1000);
const vic = ctx.addUnit("zombie", 1300, 1000);
vic.hp = 99999;
ctx.rebuildGrids();
W().t = 5;
ctx.damageZombie(vic, 1, gun);
const pushed = vic.vx;
console.log("  中弹后被推开的速度 " + pushed.toFixed(1) + "px/s（基础应为 " + (CFG.hitStagger.knock * 2) + "）");
chk(Math.abs(pushed - CFG.hitStagger.knock * 2) < 1, "击退速度翻倍（" + pushed.toFixed(0) + "px/s）");

console.log("\n=== 四、其它模式不受影响 ===");
ctx.GAME_MODE = "defense";
ctx.START.gameMode = "defense";
ctx.buildScenario(999, 30);
console.log("  切回防线模式：zombieHpMul=" + CFG.game.zombieHpMul + "，knockMul=" + CFG.game.knockMul);
chk(CFG.game.zombieHpMul === 1 && CFG.game.knockMul === 1, "倍率已重置为 1");
const dz = W().units.find(u => ctx.isZombie(u) && !u.dead);
chk(dz && dz.hp === CFG.unit[dz.kind].hp, "防线模式的丧尸是正常血量（" + (dz ? dz.hp : "-") + "）");
ctx.GAME_MODE = "escort";
ctx.START.gameMode = "escort";
ctx.LAST_CIV_COUNT = 6;
ctx.LAST_SQUAD = ["rifle", "rifle"];
ctx.buildScenario(999, 0);
chk(CFG.game.zombieHpMul === 1, "护送模式同样不受影响");

console.log("\n=== 五、无密闭空间 ===");
chaos(200, false);
chk(ctx.punchOutPockets() === 0, "生成后仍无密闭空间");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
