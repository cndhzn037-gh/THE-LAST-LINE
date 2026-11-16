import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
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
  ctx.cleanup();
  if (ctx.W.heals) ctx.W.heals.length = 0;
  ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
}

console.log("=== 一、狙击手脱战后主动锁敌 ===");
console.log("  huntAfter = " + CFG.sniper.huntAfter + " 秒");
chk(CFG.sniper.huntAfter === 4.0, "由 10 秒缩短到脱战后 4 秒");
freshScene();
const sn = ctx.addUnit("sniper", 2000, 1200);
ctx.rebuildGrids();
tick(3.6);
chk(!sn.hunting, "3.6 秒时还没出发（" + (sn.hunting ? "已出发" : "仍在游走找位") + "）");
tick(0.6);
chk(sn.hunting === 1, "满 4 秒后开始主动出击");

console.log("=== 二、自爆丧尸爆炸后的减速 ===");
console.log("  slowT = " + CFG.bomber.slowT + " 秒，slowMul = " + CFG.bomber.slowMul);
chk(CFG.bomber.slowT === 1.0, "减速持续 1 秒（原 0.5）");
chk(Math.abs(CFG.bomber.slowMul - 0.2) < 1e-9, "只剩两成速度，即减速 80%（原 70%）");
freshScene();
const bm = ctx.addUnit("bomber", 2000, 1200);
const vic = ctx.addUnit("rifle", 2050, 1200);
ctx.rebuildGrids();
bm.armT = 0.02;
tick(0.5);
console.log("  爆炸后：人类 slowT = " + (vic.slowT || 0).toFixed(2) + "，slowMul = " + (vic.slowMul || 0).toFixed(2));
chk((vic.slowT || 0) > 0.4, "被波及的人类确实被减速了");
chk(Math.abs((vic.slowMul || 0) - 0.2) < 1e-9, "减速幅度是 80%");

console.log("=== 三、医疗兵治疗弹颜色更绿更亮 ===");
const col = CFG.medic.color;
const rr = parseInt(col.slice(1, 3), 16), gg = parseInt(col.slice(3, 5), 16), bb = parseInt(col.slice(5, 7), 16);
console.log("  " + col + " → R" + rr + " G" + gg + " B" + bb);
chk(gg > 240, "绿通道拉满");
chk(gg > rr + 150 && gg > bb + 100, "明显偏绿，不再发白");
const draws = (html.match(/CTX\.strokeStyle = CFG\.medic\.color;/g) || []).length;
chk(draws >= 1, "绘制治疗弹时直接读这个颜色（以后调色只改一处）");

console.log("=== 四、医疗兵升格为英雄 ===");
chk(CFG.hero.medicMagMul === 3 && CFG.hero.medicLockMul === 3, "倍率配成 3 倍 / 3 倍");
freshScene();
const med = ctx.addUnit("medic", 2000, 1200);
const sickList = [];
for (let i = 0; i < 14; i++) {
  const v = ctx.addUnit("civilian", 2100 + (i % 5) * 40, 1150 + Math.floor(i / 5) * 40);
  v.infectLocked = true; v.incubT = 0;
  sickList.push(v);
}
ctx.rebuildGrids();
console.log("  升格前：弹匣 " + med.magSize + "，可锁 " + ctx.medicLockCap(med) + " 个");
chk(med.magSize === 12, "普通医疗兵弹匣 12");
chk(ctx.medicLockCap(med) === 4, "普通医疗兵一次锁 4 个");
ctx.promoteHero(med, "armed", true);
console.log("  升格后：弹匣 " + med.magSize + "，可锁 " + ctx.medicLockCap(med) + " 个，附加武器 " +
  (med.guns ? med.guns.length + " 把" : "没有"));
chk(med.magSize === 36, "弹匣扩到 36 发");
chk(med.mag === 36, "当前弹匣也是满的 36 发");
chk(ctx.medicLockCap(med) === 12, "一次能锁 12 个目标");
chk(!med.guns || med.guns.length === 0, "不再额外挂武器");
med.gearStats = { sight: true };
console.log("  买到瞄准镜后：可锁 " + ctx.medicLockCap(med) + " 个");
chk(ctx.medicLockCap(med) === 15, "瞄准镜再乘三倍，能锁 15 个");
med.gearStats = null;

console.log("=== 五、真打一轮看看 ===");
tick(1.4);
console.log("  读满出手后：弹匣 " + med.mag + "，飞行中的治疗弹 " + ctx.W.heals.length + " 发，锁定名单 " +
  ((med.lockList || []).length));
chk(med.mag <= 36 - 12, "一次齐射把 12 发额度打出去了（弹匣剩 " + med.mag + "）");
chk(sickList.filter(v => !v.infectLocked).length >= 10, "至少治好了 10 个人（共 " +
  sickList.filter(v => !v.infectLocked).length + " 人）");
/* 换弹补满用的是新的上限：换到干净场景单独验证，免得被场上残余目标干扰 */
freshScene();
const med2 = ctx.addUnit("medic", 2000, 1200);
ctx.rebuildGrids();
ctx.promoteHero(med2, "armed", true);
med2.mag = 0; med2.reloading = true; med2.reloadT = CFG.medic.reload;
tick(CFG.medic.reload + 0.5);
console.log("  换弹完成后：弹匣 " + med2.mag + " / " + med2.magSize);
chk(med2.mag === 36, "换弹补满还是 36 发，不会缩回 12");
chk(med2.magSize === 36, "上限没有被改回 12");

console.log("");
console.log(bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ===");
