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
  if (ctx.W.heals) ctx.W.heals.length = 0;
  ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
}
const M = CFG.medic;
const raw = html;

console.log("=== 一、单位设定 ===");
const c = CFG.unit.medic;
console.log("  体型 " + c.r + "（平民 " + CFG.unit.civilian.r + "），速度 " + c.vmax + "（平民 " + CFG.unit.civilian.vmax + "）");
chk(c.r === CFG.unit.civilian.r, "体型与平民相同");
chk(c.vmax === CFG.unit.civilian.vmax, "速度与平民相同");
chk(CFG.econ.cost.medic === 100, "价格 100");
chk(c.color.toLowerCase() === "#f2f2f2", "通体白色 #f2f2f2");
chk(M.r === Math.round(CFG.far.r * 0.75), "锁定范围 = 步枪远射射程的一半再 +50%（" + M.r + "）");
chk(M.mag === 12 && M.reload === 8 && M.cd === 2, "弹匣 12 / 换弹 8 秒 / 冷却 2 秒");
chk(M.dmgZombie === 3, "打丧尸每发 3 点");
chk(!ctx.isArmedKind("medic"), "不算武装单位（走位与平民一致）");
chk(ctx.isHuman(ctx.W.units[0] || { kind: "medic" }), "被当作人类阵营");

console.log("=== 二、读条一秒，锁定被感染的人 ===");
freshScene();
const med = ctx.addUnit("medic", 2000, 1200);
const s1 = ctx.addUnit("civilian", 2200, 1200);
const s2 = ctx.addUnit("civilian", 2250, 1200);
s1.infectLocked = true; s1.incubT = 0;
s2.infectLocked = true; s2.incubT = 0;
const healthy = ctx.addUnit("civilian", 2280, 1200);
ctx.rebuildGrids();
tick(0.5);
console.log("  0.5 秒时：读条 " + (med.lockT || 0).toFixed(2) + "，锁定 " + ((med.lockList || []).length));
chk((med.lockT || 0) > 0, "看到感染者就开始读条");
chk((med.lockList || []).length === 2, "锁定了两个感染者（健康的不算）");
tick(0.7);
console.log("  1.2 秒时：弹匣 " + med.mag + "，飞行中的治疗弹 " + ctx.W.heals.length + " 发");
chk(med.mag === 10, "读满一秒后打了两发（弹匣 12 → 10）");
tick(0.15);
const pops = ctx.W.healPops || [];
console.log("  命中瞬间：s1 感染=" + s1.infectLocked + " s2 感染=" + s2.infectLocked +
  "，头顶飘字 " + pops.length + " 个");
chk(!s1.infectLocked && !s2.infectLocked, "两发治疗把感染都清掉了");
chk(CFG.medic.popCount === 3, "治愈标记是 3 个");
chk(pops.length >= 6, "每个被治好的人飘出 3 个绿色十字（两人共 " + pops.length + " 个）");
if (pops.length >= 3) {
  console.log("  三个符号的剩余生命：" + pops.slice(0, 3).map(p => p.t.toFixed(2)).join(" / "));
  chk(pops[0].t < pops[1].t && pops[1].t < pops[2].t, "三个符号依次错开出现");
}
chk(raw.indexOf('CTX.fillStyle = "#3de07a"') >= 0, "符号是绿色的");
chk(raw.indexOf("W.healPops") >= 0, "有独立的飘字层");
tick(1.6);
console.log("  飘完之后还剩 " + (ctx.W.healPops || []).length + " 个");
chk((ctx.W.healPops || []).length === 0, "飘完自动消失");

console.log("=== 三、身体颜色渲染 ===");
chk(raw.indexOf('u.kind === "medic"') >= 0, "渲染里有医疗兵分支");
chk(raw.indexOf("W.heals") >= 0, "治疗弹有自己的绘制层");
chk(raw.indexOf('"治疗枪"') >= 0, "武器名叫治疗枪");
chk(raw.indexOf("CTX.strokeStyle = CFG.medic.color;") >= 0, "治疗弹直接取 CFG.medic.color 绘制");
const mc = CFG.medic.color;
const gc = parseInt(mc.slice(3, 5), 16), rc = parseInt(mc.slice(1, 3), 16);
chk(gc > 240 && gc > rc + 150, "弹色是亮绿 " + mc);

console.log("=== 四、没有感染者就改打丧尸，每发 3 点 ===");
freshScene();
const med2 = ctx.addUnit("medic", 2000, 1200);
const z1 = ctx.addUnit("zombie", 2300, 1200);
const z2 = ctx.addUnit("zombie", 2350, 1200);
const z3 = ctx.addUnit("zombie", 2400, 1200);
const z4 = ctx.addUnit("zombie", 2400, 1300);
ctx.rebuildGrids();
for (const z of [z1, z2, z3, z4]) { z.hp = 100; z.maxHp = 100; }
tick(1.1);
console.log("  1.1 秒时弹匣 " + med2.mag + "，飞行中的治疗弹 " + ctx.W.heals.length + " 发");
chk(med2.mag === 8, "打出了四发（弹匣 12 → 8）");
tick(2.5);
const dmgDone = [z1, z2, z3, z4].filter(z => z.hp < 100).length;
console.log("  四只丧尸受伤情况：" + [z1, z2, z3, z4].map(z => Math.round(100 - z.hp)).join("/"));
chk(dmgDone === 4, "四只都被打了");
chk([z1, z2, z3, z4].every(z => Math.round(100 - z.hp) === 3), "每只正好 3 点");

console.log("=== 五、目标不足四个：等两秒后把额度摊下去 ===");
freshScene();
const med3 = ctx.addUnit("medic", 2000, 1200);
const solo = ctx.addUnit("zombie", 2300, 1200);
solo.hp = 100; solo.maxHp = 100;
ctx.rebuildGrids();
tick(0.6);
console.log("  0.6 秒时（只有一只丧尸）：还在读条 " + (med3.lockT || 0).toFixed(2));
chk((med3.lockT || 0) > 0.4, "只有一只也照常读条");
tick(0.6);
console.log("  1.2 秒时：弹匣 " + med3.mag + "，飞行中的治疗弹 " + ctx.W.heals.length + " 发");
chk(med3.mag === 8, "读满一秒就把四发全打在这一只身上");
tick(2.0);
const soloDmg = Math.round(100 - solo.hp);
console.log("  这一只挨了 " + soloDmg + " 点（4 发 × 3）");
chk(soloDmg === 12, "四发全命中同一只，共 12 点");

console.log("=== 六、玩家手动操控：长按锁定、松手齐射 ===");
freshScene();
const medP = ctx.addUnit("medic", 2000, 1200);
const pz1 = ctx.addUnit("zombie", 2150, 1200);
const pz2 = ctx.addUnit("zombie", 2230, 1200);
pz1.hp = 100; pz2.hp = 100;
ctx.rebuildGrids();
ctx.PLAYER.on = true; ctx.PLAYER.unit = medP;
ctx.PLAYER.firing = false;
ctx.UI.pointer.x = ctx.w2sx(2200);
ctx.UI.pointer.y = ctx.w2sy(1200);
tick(0.4);
console.log("  不按左键时：锁定 " + ((medP.lockList || []).length) + " 个，弹匣 " + medP.mag);
chk((medP.lockList || []).length === 0, "不按左键不会自己锁人");
/* 准星放到离目标 110px 的地方（武装恐惧半径 130 之内），应该照样锁得上 */
ctx.UI.pointer.x = ctx.w2sx(2150 + 110);
ctx.UI.pointer.y = ctx.w2sy(1200);
ctx.PLAYER.firing = true;
tick(0.4);
console.log("  准星偏离目标 110px 时锁定 " + ((medP.lockList || []).length) + " 个");
chk((medP.lockList || []).length >= 1, "准星不用精准压在目标上，辅助半径内就能锁");
ctx.PLAYER.firing = false;
tick(0.05);
ctx.W.heals.length = 0;
medP.lockList = []; medP.mag = medP.magSize; medP.medCd = 0;
ctx.UI.pointer.x = ctx.w2sx(2200); ctx.UI.pointer.y = ctx.w2sy(1200);
/* 长按 */
ctx.PLAYER.firing = true;
tick(0.4);
const lockedN = (medP.lockList || []).length;
console.log("  长按左键 0.4 秒后：锁定 " + lockedN + " 个（准星在两只丧尸之间），弹匣 " + medP.mag);
chk(lockedN >= 1, "长按期间开始锁定");
chk(medP.mag === 12, "还在锁定，没有提前开枪");
chk(raw.indexOf("SFX.blip(") >= 0 && raw.indexOf('SFX.gate("medBlip"') >= 0, "每锁一个就播一声轻响");
/* 松开 */
ctx.PLAYER.firing = false;
tick(0.05);
console.log("  松开左键后：弹匣 " + medP.mag + "，治疗弹 " + ctx.W.heals.length + " 发");
chk(medP.mag < 12, "松手立刻把锁定的打出去");
chk((medP.lockList || []).length === 0, "发射后锁定清空");
tick(1.0);
console.log("  命中后两只丧尸掉血：" + Math.round(100 - pz1.hp) + "/" + Math.round(100 - pz2.hp));
chk(pz1.hp < 100 || pz2.hp < 100, "至少打中了一个");
ctx.PLAYER.on = false; ctx.PLAYER.unit = null; ctx.PLAYER.firing = false;

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));