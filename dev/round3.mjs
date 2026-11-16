import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [] }; }
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
function clean() {
  W().units.length = 0; W().obstacles.length = 0; W().doors.length = 0;
  W().bullets.length = 0; W().flashes.length = 0; W().infected = 0; W().kills = 0;
  ctx.NAV.build(ctx.CFG.world, W().obstacles, 9);
}

console.log("=== 一、数值 ===");
console.log("  步枪兵伤害 = " + ctx.CFG.far.dmg + "（远射） / " + ctx.CFG.near.dmg + "（速射）  [原为 1]");
console.log("  母体 hp = " + ctx.CFG.unit.mother.hp + "，每掉 " + (ctx.CFG.unit.mother.hp * ctx.CFG.brood.step) + " 血产 " + ctx.CFG.brood.count + " 只 → 共 4 次 = 40 只");
clean();
const m = ctx.addUnit("mother", 2000, 1200);
console.log("  母体首个产卵阈值 = " + m.nextSpawnHp);
let lastZ = 0, spawns = 0, lastCount = 0;
for (let i = 0; i < 100 && !m.dead; i++) {
  ctx.damageZombie(m, 5);
  const zc = W().units.filter(u => u.kind === "zombie").length;
  if (zc > lastZ) { spawns++; lastCount = zc - lastZ; lastZ = zc; }
}
console.log("  实测：产卵 " + spawns + " 次，每次 " + lastCount + " 只，累计 " + lastZ + " 只，母体已死=" + m.dead);

console.log("\n=== 二、狙击手 ===");
clean();
const sn = ctx.addUnit("sniper", 3000, 1200);
for (let i = 0; i < 5; i++) ctx.addUnit("civilian", 2900 + i * 40, 1100 + i * 40);
for (let i = 0; i < 4; i++) ctx.addUnit("zombie", 2400 - i * 60, 1200);
for (let i = 0; i < 60 * 3; i++) ctx.stepSim(1 / 60);
console.log("  狙击手护卫数 = " + sn.guards.length + "（上限 " + ctx.CFG.sniper.guards + "）" + (sn.guards.length <= 2 ? " ✓" : " ✗"));
const armedLine = W().units.filter(u => ctx.isLineInfantry(u));
ctx.W.bullets.length = 0;
ctx.rebuildGrids();
console.log("  集群聚合是否包含狙击手 = " + (ctx.mateCenter(sn, 460) ? "参与了 ✗" : "未参与 ✓（同伴仅统计常规步兵）"));
console.log("  狙击手恐惧半径 = " + ctx.fearRadiusOf(sn) + "（普通武装 " + ctx.CFG.fearR + "，双倍 " + (ctx.CFG.fearR * 2) + "）");
console.log("  狙击枪：射程 " + ctx.CFG.sniper.r + "  弹匣 " + ctx.CFG.sniper.mag + "  换弹 " + ctx.CFG.sniper.reload + "s  伤害 " + ctx.CFG.sniper.dmg + "  可穿墙 " + ctx.CFG.sniper.wallPierce + " 堵  速度 ×" + ctx.CFG.sniper.speedMul);

console.log("\n=== 三、狙击弹：无限穿透丧尸 + 穿过一堵墙 ===");
function snipeTest(wallCount, label) {
  clean();
  for (let i = 0; i < wallCount; i++) W().obstacles.push(ctx.makeObstacle(2200 + i * 300, 1100, 20, 200, "wall"));
  ctx.NAV.build(ctx.CFG.world, W().obstacles, 9);
  const zs = [];
  for (let i = 0; i < 6; i++) zs.push(ctx.addUnit("zombie", 2400 + i * 22, 1200));
  const s2 = ctx.addUnit("sniper", 2000, 1200);
  ctx.rebuildGrids();
  const before = zs.map(z => z.hp);
  ctx.fireBullet(s2, zs[0], 0, ctx.CFG.sniper.dmg, 3, false, true);
  for (let f = 0; f < 12; f++) ctx.stepBullets(1 / 60);
  const hit = zs.filter((z, i) => before[i] - z.hp > 0).length;
  console.log("  " + label.padEnd(24) + " 命中 " + hit + "/6 只丧尸" + (hit > 0 ? "（伤害 " + (before[0] - zs[0].hp) + "）" : ""));
}
snipeTest(0, "无墙");
snipeTest(1, "中间隔一堵墙");
snipeTest(2, "中间隔两堵墙");

console.log("\n=== 四、盾兵护盾 ===");
clean();
const sh = ctx.addUnit("shield", 2000, 1200);
const z1 = ctx.addUnit("zombie", 2018, 1200);
z1.pounceCd = 999;
console.log("  初始护盾耐久 = " + sh.shieldHp + "/" + ctx.CFG.shield.hp + "s，感染免疫=" + ctx.hasShield(sh));
let brokeAt = -1, infectDuringShield = false;
for (let i = 0; i < 60 * 7; i++) {
  sh.x = 2000; sh.y = 1200; sh.vx = 0; sh.vy = 0;
  z1.x = 2018; z1.y = 1200; z1.vx = 0; z1.vy = 0;
  ctx.stepSim(1 / 60);
  if (!sh.shieldBroken && sh.infectLocked) infectDuringShield = true;
  if (sh.shieldBroken && brokeAt < 0) brokeAt = i;
}
console.log("  持盾期间被感染 = " + (infectDuringShield ? "是 ✗" : "否 ✓"));
console.log("  护盾破裂于 t=" + (brokeAt >= 0 ? (brokeAt / 60).toFixed(1) + "s" : "未破裂") + "（约 6 秒接触）");
z1.dead = true;
sh.infectLocked = false; sh.incubT = 0; sh.fadeT = 0;   // 排除破盾后被咬的干扰，单独测护盾恢复
let regenAt = -1;
for (let i = 0; i < 60 * 10; i++) {
  ctx.stepSim(1 / 60);
  if (!sh.shieldBroken && regenAt < 0) { regenAt = i; break; }
}
console.log("  护盾恢复于破盾后 " + (regenAt >= 0 ? (regenAt / 60).toFixed(1) + "s" : "未恢复") + "（应为 8 秒）");

console.log("\n=== 五、丧尸是否优先锁定举盾的盾兵 ===");
clean();
const sh2 = ctx.addUnit("shield", 2000, 1200);
const civ2 = ctx.addUnit("civilian", 2100, 1200);
const z2 = ctx.addUnit("zombie", 2400, 1200);
ctx.rebuildGrids();
const tgt = ctx.nearestHuman(z2);
console.log("  盾兵距离 400、平民距离 300 → 丧尸锁定 = " + (tgt === sh2 ? "盾兵 ✓（护盾提升仇恨）" : "平民 ✗"));
sh2.shieldBroken = true;
ctx.rebuildGrids();
const tgt2 = ctx.nearestHuman(z2);
console.log("  破盾后再判定 → 锁定 = " + (tgt2 === sh2 ? "盾兵" : "平民 ✓（仇恨恢复正常）"));
