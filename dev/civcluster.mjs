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
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }
function freshScene() {
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 2;
  ctx.buildScenario(3, 2); ctx.W.over = false; ctx.W.paused = false;
  for (const u of ctx.W.units) u.dead = true;
  ctx.cleanup();
  if (ctx.W.heals) ctx.W.heals.length = 0;
  ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
  ctx.W.armedN = 0; ctx.W.medicArmed = 0; ctx.W.clusterOn = 0;
}
function maxPairDist(list) {
  let m = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const d = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y);
    if (d > m) m = d;
  }
  return m;
}

console.log("=== 一、只剩平民：会自己抱团，而不是原地发呆 ===");
freshScene();
const civs = [];
for (let i = 0; i < 6; i++) civs.push(ctx.addUnit("civilian", 1900 + i * 150, 1100 + (i % 3) * 120));
ctx.rebuildGrids();
ctx.rebalanceGuards();
console.log("  开局：能打的 " + ctx.W.armedN + " 人，医疗兵顶上=" + ctx.W.medicArmed + "，抱团=" + ctx.W.clusterOn);
chk(ctx.W.armedN === 0, "场上确实没有任何武装单位");
chk(ctx.W.clusterOn === 1, "进入抱团状态");
const d0 = maxPairDist(civs);
console.log("  开局最远两人相距 " + d0.toFixed(0) + "px");
tick(6);
const d1 = maxPairDist(civs);
const moved = civs.filter(c => c.state === "cluster").length;
console.log("  6 秒后最远两人相距 " + d1.toFixed(0) + "px，处于抱团状态的 " + moved + "/6 人");
chk(d1 < d0 * 0.75, "彼此明显靠拢（" + d0.toFixed(0) + " → " + d1.toFixed(0) + "px）");
chk(d1 < ctx.CFG.cluster.r * 2.6, "聚成一圈的尺度，不再是撒在地图上");
chk(moved >= 4, "多数人在执行抱团走位，不是原地待命");
chk(civs.every(c => isFinite(c.x) && isFinite(c.y)), "没有 NaN");

console.log("=== 二、只剩医疗兵：它顶上武装单位 ===");
freshScene();
const med = ctx.addUnit("medic", 2000, 1200);
const c1 = ctx.addUnit("civilian", 2150, 1200);
const c2u = ctx.addUnit("civilian", 2200, 1280);
ctx.rebuildGrids();
ctx.rebalanceGuards();
console.log("  能打的 " + ctx.W.armedN + " 人，医疗兵顶上=" + ctx.W.medicArmed);
chk(ctx.W.medicArmed === 1, "医疗兵被扶正");
chk(ctx.isCombatUnit(med), "医疗兵按武装单位参与寻路");
chk(!ctx.isArmed(med), "但它本身仍然不是真武装（不会拿普通枪开火）");
console.log("  医疗兵名下护卫 " + ((med.guards || []).length) + " 人，平民的 guardOf 是 " +
  [c1.guardOf ? c1.guardOf.kind : "无", c2u.guardOf ? c2u.guardOf.kind : "无"].join(" / "));
chk((med.guards || []).length === 2, "两名平民都归到医疗兵名下");
chk(c1.guardOf === med && c2u.guardOf === med, "平民跟着医疗兵走");
chk(ctx.W.clusterOn === 0, "有医疗兵顶着，就不必走平民抱团那一条");

console.log("=== 三、医疗兵顶上后确实按武装单位走位 ===");
freshScene();
const med2 = ctx.addUnit("medic", 2000, 1200);
/* 丧尸放在感知半径之外（840）但仍在主动索敌范围内（2600）：
   这样测的是"武装单位主动出击找目标"那一条，而不是"射程内站定对射" */
const zz = ctx.addUnit("zombie", 3200, 1200);
zz.hp = 99999;
ctx.rebuildGrids();
ctx.rebalanceGuards();
const dx0 = Math.hypot(zz.x - med2.x, zz.y - med2.y);
for (let i = 0; i < 240; i++) { zz.x = 3200; zz.y = 1200; zz.vx = 0; zz.vy = 0; ctx.stepSim(1 / 60); }
const dx1 = Math.hypot(zz.x - med2.x, zz.y - med2.y);
console.log("  与丧尸距离 " + dx0.toFixed(0) + " → " + dx1.toFixed(0) + "px，状态 " + med2.state);
chk(dx1 < dx0 - 60, "它朝丧尸方向压上去了（武装单位的走位）");
chk(med2.state !== "guard" && med2.state !== "cluster", "走的是交战/推进那一套，不是平民待命");

console.log("=== 四、医疗兵顶上之后也不会拿治疗弹当普通子弹打 ===");
freshScene();
const med3 = ctx.addUnit("medic", 2000, 1200);
const zz2 = ctx.addUnit("zombie", 2200, 1200);
zz2.hp = 99999;
ctx.rebuildGrids();
ctx.rebalanceGuards();
let normalShots = 0;
for (let i = 0; i < 300; i++) {
  zz2.x = 2200; zz2.y = 1200; zz2.vx = 0; zz2.vy = 0;
  ctx.stepSim(1 / 60);
  for (const b of ctx.W.bullets) if (b.owner === med3) normalShots++;
}
console.log("  医疗兵打出的普通子弹 " + normalShots + " 发，治疗弹 " + (ctx.W.heals || []).length + " 发在飞");
chk(normalShots === 0, "没有任何普通子弹出自医疗兵");

console.log("=== 五、有真武装在场时，一切照旧 ===");
freshScene();
const rifle = ctx.addUnit("rifle", 2000, 1200);
const med4 = ctx.addUnit("medic", 2100, 1200);
const c4 = ctx.addUnit("civilian", 2200, 1200);
ctx.rebuildGrids();
ctx.rebalanceGuards();
console.log("  能打的 " + ctx.W.armedN + " 人，医疗兵顶上=" + ctx.W.medicArmed);
chk(ctx.W.armedN === 1, "有步枪兵在");
chk(ctx.W.medicArmed === 0, "医疗兵不越位");
chk(!ctx.isCombatUnit(med4), "医疗兵仍按平民逻辑走位");
chk(c4.guardOf === rifle, "平民跟的是步枪兵，不是医疗兵");

console.log("");
console.log(bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ===");
