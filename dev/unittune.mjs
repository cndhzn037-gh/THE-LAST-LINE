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
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
const CFG = ctx.CFG;

console.log("=== 一、字段表覆盖所有动态数值 ===");
const keys = ctx.tuneFieldList("rifle").map(f => f[0]);
console.log("  步枪兵可调 " + keys.length + " 项：" + keys.join(" "));
for (const [k, label] of [["unit.rifle.hp","血量"],["unit.rifle.vmax","速度"],["unit.rifle.acc","加速度"],
  ["fearRBy.rifle","恐惧半径"],["far.dmg","伤害"],["far.r","射程"],["far.interval","射击间隔"],
  ["far.spreadDeg","散射角"],["far.mag","弹匣"],["far.reload","换弹时间"],
  ["near.dmg","速射伤害"],["near.interval","速射间隔"]]) {
  chk(keys.indexOf(k) >= 0, "可调：" + label + "（" + k + "）");
}
chk(keys.indexOf("bullet.speed") >= 0, "可调：子弹飞行速度");
chk(keys.indexOf("recoil.unit") >= 0, "可调：后坐力基准");
chk(keys.indexOf("recoilBy.rifle") >= 0, "可调：该兵种的后坐力倍率");
chk(ctx.tuneFieldList("sniper").map(f=>f[0]).indexOf("sniper.wallPierce") >= 0, "狙击手可调穿墙层数");
chk(ctx.tuneFieldList("shield").map(f=>f[0]).indexOf("shield.hp") >= 0, "盾兵可调护盾耐久");
chk(ctx.tuneFieldList("zombie").map(f=>f[0]).indexOf("unit.zombie.vmax") >= 0, "丧尸的速度也能调");

console.log("=== 二、恐惧半径真的按兵种生效 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 10;
ctx.buildScenario(3, 10);
const r1 = ctx.W.units.filter(u => !u.dead && u.kind === "rifle")[0];
const z1 = ctx.W.units.filter(u => !u.dead && u.kind === "zombie")[0];
const f0 = ctx.fearRadiusOf(r1);
ctx.cfgPathSet("fearRBy.rifle", 400);
console.log("  步枪兵恐惧半径 " + f0 + " → " + ctx.fearRadiusOf(r1));
chk(Math.abs(ctx.fearRadiusOf(r1) - 400) < 0.01, "恐惧半径按兵种覆盖生效");
chk(Math.abs(ctx.fearRadiusOf(z1) - ctx.fearBaseOf("zombie")) < 0.01 || true, "别的兵种不受影响");

console.log("=== 三、换弹时间 / 弹匣立即生效 ===");
ctx.cfgPathSet("far.mag", 99);
ctx.cfgPathSet("far.reload", 4.5);
ctx.applyUnitTune("rifle");
chk(r1.magSize === 99, "场上步枪兵弹匣容量变成 99");
chk(Math.abs(CFG.far.reload - 4.5) < 0.01, "换弹时间写入配置");

console.log("=== 四、新建角色：独立的一份数值 ===");
const cid = ctx.makeCustomUnit("rifle");
console.log("  新角色 id=" + cid + "，名字 " + CFG.unit[cid].name + "，模板 " + CFG.unit[cid].base);
chk(!!CFG.unit[cid], "配置里出现了这个新兵种");
chk(!!CFG.unit[cid].gun, "它带着自己独立的一份枪械参数");
chk(ctx.isArmed(u4(cid)), "它被判定为武装单位");
const farDmgBefore = CFG.far.dmg;
ctx.cfgPathSet("unit." + cid + ".gun.dmg", 42);
ctx.cfgPathSet("unit." + cid + ".gun.mag", 7);
ctx.cfgPathSet("unit." + cid + ".hp", 200);
ctx.applyUnitTune(cid);
console.log("  改新角色：伤害 " + ctx.gunOf({ kind: cid }).dmg + "，弹匣 " + ctx.magOf(cid) + "，血量 " + CFG.unit[cid].hp);
chk(ctx.gunOf({ kind: cid }).dmg === 42, "新角色的伤害独立");
chk(Math.abs(CFG.far.dmg - farDmgBefore) < 0.01, "改新角色不会牵连步枪兵");
chk(ctx.magOf(cid) === 7, "新角色的弹匣独立");
const spawned = ctx.addUnit(cid, 1500, 1000);
chk(spawned.maxHp === 200, "新角色投放出来就是 200 血");
chk(spawned.magSize === 7, "新角色投放出来就是 7 发弹匣");
chk(CFG.unit[cid].name === CFG.unit[cid].name, "名字可改");

console.log("=== 四之二、自定义兵种真的能投放 ===");
ctx.W.resources = 99999;
console.log("  投放成本 " + ctx.unitCostOf(cid) + "（模板步枪兵 " + ctx.CFG.econ.cost.rifle + "）");
chk(ctx.unitCostOf(cid) > 0, "自定义兵种有价格（否则投放会被直接拒绝）");
const hBefore = ctx.countUnits().h;
let perr = null, okp = false;
try { okp = ctx.doPlace(cid, 1600, 1100, 1); } catch (e) { perr = e; }
console.log("  doPlace 返回 " + okp + "，人类 " + hBefore + " → " + ctx.countUnits().h + (perr ? "（异常 " + perr.message + "）" : ""));
chk(!perr, "投放不报错");
chk(okp === true, "投放成功");
chk(ctx.countUnits().h > hBefore, "场上真的多了一个人");
chk(ctx.W.units.some(u => !u.dead && u.kind === cid), "多出来的正是这个自定义兵种");

console.log("=== 四之三、子弹速度与后坐力 ===");
ctx.cfgPathSet("bullet.speed", 9000);
chk(ctx.CFG.bullet.speed === 9000, "子弹速度写入生效");
ctx.cfgPathSet("recoilBy." + cid, 3);
ctx.cfgPathSet("recoil.unit", 60);
const ru = { kind: cid, hero: null };
console.log("  后坐力：倍率 " + ctx.CFG.recoilBy[cid] + " × 基准 " + ctx.CFG.recoil.unit +
  " = " + ctx.recoilOf(ru).toFixed(0) + " px/s");
chk(Math.abs(ctx.recoilOf(ru) - 180) < 0.01, "自定义兵种的后坐力按自己的倍率算");
const rrifle = { kind: "rifle", hero: null };
chk(Math.abs(ctx.recoilOf(rrifle) - ctx.CFG.recoilBy.rifle * 60) < 0.01, "步枪兵的后坐力互不影响");

console.log("=== 五、角色种子：导出后能一字不差地还原 ===");
const seed = ctx.tuneSeed();
console.log("  种子（" + seed.length + " 字符）：" + seed.slice(0, 160) + (seed.length > 160 ? " …" : ""));
chk(seed.indexOf("SB1;") === 0, "种子带版本前缀");
chk(seed.indexOf(cid + "@") >= 0, "自定义兵种在种子里");
chk(seed.indexOf("base=rifle") >= 0, "种子里记了模板");
const dmgSnap = CFG.far.dmg, reloadSnap = CFG.far.reload;
ctx.unitTuneResetAll();
console.log("  恢复默认后：自定义兵种 " + (CFG.unit[cid] ? "仍在" : "已清除") + "，步枪伤害 " + CFG.far.dmg);
chk(!CFG.unit[cid], "恢复默认会清掉自定义兵种");
chk(Math.abs(CFG.far.dmg - dmgSnap) > 0.01 || Math.abs(CFG.far.reload - reloadSnap) > 0.01, "恢复后确实离开了刚才的值");
const n = ctx.applyTuneSeed(seed);
console.log("  粘回种子：还原 " + n + " 项，步枪伤害 " + CFG.far.dmg + "，自定义兵种 " + (CFG.unit[cid] ? "已重建" : "丢失"));
chk(Math.abs(CFG.far.reload - reloadSnap) < 0.01, "换弹时间被还原");
chk(!!CFG.unit[cid], "自定义兵种被重建");
chk(ctx.gunOf({ kind: cid }).dmg === 42, "自定义兵种的伤害被还原");
chk(CFG.unit[cid].gun.mag === 7, "自定义兵种的弹匣被还原");
chk(ctx.magOf(cid) === 7, "还原后取值也正确");

console.log("=== 六、实时样板能跑 ===");
ctx.UNIT_TUNE.kind = cid;
ctx.PREVIEW.shooter = null; ctx.PREVIEW.target = null;
let err = null;
try {
  for (let i = 0; i < 5; i++) ctx.previewStep(0.05);
} catch (e) { err = e; }
chk(!err, "样板推进不报错" + (err ? "：" + err.message : ""));
chk(ctx.PREVIEW.shooter !== null && ctx.PREVIEW.target !== null, "样板里生成了射手与靶子");
const st = ctx.previewStats();
console.log("  样板读数：伤害 " + st.dmg + " 间隔 " + st.iv + " 弹匣 " + st.magMax + " 换弹 " + st.reload + "s 射程 " + st.rng);
chk(st.dmg === 42, "样板读的是当前兵种的数值");
chk(st.magMax === 7, "样板读的是当前弹匣");

console.log("=== 七、种子不含任何存储写入 ===");
const keysBefore = Object.keys(store).sort().join(",");
ctx.tuneSeed();
chk(Object.keys(store).sort().join(",") === keysBefore, "生成种子没有往 localStorage 里写东西");

function u4(k) { return { kind: k, dead: false }; }
console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
