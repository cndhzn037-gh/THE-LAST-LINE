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

console.log("=== 一、兵种数值：改了立刻生效，恢复默认能拉回去 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 20;
ctx.buildScenario(5, 20);
const u1 = ctx.W.units.filter(x => !x.dead && x.kind === "rifle")[0];
const hp0 = CFG.unit.rifle.hp, vmax0 = CFG.unit.rifle.vmax, dmg0 = CFG.far.dmg;
console.log("  预设：步枪兵 血量 " + hp0 + "  速度 " + vmax0 + "  步枪伤害 " + dmg0);
ctx.cfgPathSet("unit.rifle.hp", hp0 * 2);
ctx.cfgPathSet("unit.rifle.vmax", vmax0 * 2);
ctx.cfgPathSet("far.dmg", dmg0 * 3);
ctx.applyUnitTune("rifle");
console.log("  改后：CFG 血量 " + CFG.unit.rifle.hp + "，场上单位 maxHp " + u1.maxHp + "，弹匣 " + u1.magSize);
chk(Math.abs(CFG.unit.rifle.hp - hp0 * 2) < 0.01, "配置里的血量翻倍");
chk(Math.abs(u1.maxHp - hp0 * 2) < 0.01, "场上已有单位的上限同步翻倍");
chk(Math.abs(u1.vmax - vmax0 * 2) < 0.01, "场上已有单位的速度同步翻倍");
chk(Math.abs(CFG.far.dmg - dmg0 * 3) < 0.01, "枪械伤害同步改动");
const nu = ctx.addUnit("rifle", 1500, 1000);
chk(Math.abs(nu.maxHp - hp0 * 2) < 0.01, "之后新投放的单位也按新数值来");

ctx.unitTuneResetAll();
const u2 = ctx.W.units.filter(x => !x.dead && x.kind === "rifle")[0];
console.log("  恢复后：CFG 血量 " + CFG.unit.rifle.hp + "，场上 " + u2.maxHp + "，伤害 " + CFG.far.dmg);
chk(Math.abs(CFG.unit.rifle.hp - hp0) < 0.01, "血量回到预设");
chk(Math.abs(CFG.unit.rifle.vmax - vmax0) < 0.01, "速度回到预设");
chk(Math.abs(CFG.far.dmg - dmg0) < 0.01, "伤害回到预设");
chk(Math.abs(u2.maxHp - hp0) < 0.01, "场上单位的上限也回到预设");

console.log("=== 二、兵种数据不会写进任何存储 ===");
const keysBefore = Object.keys(store).sort().join(",");
ctx.cfgPathSet("unit.zombie.hp", 99);
ctx.applyUnitTune("zombie");
chk(Object.keys(store).sort().join(",") === keysBefore, "改数值没有在 localStorage 里留下任何东西");

console.log("=== 三、开战设置恢复默认 ===");
ctx.START.waveMode = true; ctx.START.waveCount = 33; ctx.START.heroMode = true;
ctx.START.reinforce = true; ctx.START.postDuty = true; ctx.START.mode = "mult"; ctx.START.mult = 20;
ctx.START.gameMode = "chaos"; ctx.START.chaosCiv = 300; ctx.START.civCount = 20;
let err = null;
try { ctx.resetStartSettings(); } catch (e) { err = e; }
chk(!err, "调用不报错" + (err ? "：" + err.message : ""));
console.log("  重置后：波次=" + ctx.START.waveMode + " 波数=" + ctx.START.waveCount +
  " 英雄=" + ctx.START.heroMode + " 支援=" + ctx.START.reinforce + " 岗位=" + ctx.START.postDuty +
  " 规模=" + (ctx.START.mode || "默认") + " 模式=" + ctx.START.gameMode);
chk(ctx.START.waveMode === false && ctx.START.waveCount === 5, "波次设置回到默认");
chk(ctx.START.heroMode === false && ctx.START.reinforce === false && ctx.START.postDuty === false, "英雄/支援/岗位都关掉");
chk(ctx.START.mode === "" && ctx.START.mult === 1 && ctx.START.add === 0, "丧尸规模回到默认");
chk(ctx.START.gameMode === "chaos", "当前玩法的选择被保留，没有把人踢回别的模式");

console.log("=== 四、键位恢复默认 ===");
ctx.KEYMAP.pause = "p";
ctx.KEYMAP.garrison = "z";
ctx.saveBinds();
chk(ctx.KEYMAP.pause === "p", "先改了两个键");
ctx.resetBinds();
chk(ctx.KEYMAP.pause === " ", "暂停键回到空格");
chk(ctx.KEYMAP.garrison === "g", "坚守键回到 G");
const saved = JSON.parse(store["zombieSandbox.keys.v2"] || "{}");
chk(saved.pause === " ", "重置结果也写回了本地存储（下次打开仍是默认键）");

console.log("=== 五、一键恢复全部默认 ===");
ctx.START.heroMode = true;
ctx.cfgPathSet("unit.rifle.hp", 999);
ctx.KEYMAP.pause = "p";
err = null;
try { ctx.resetAllDefaults(); } catch (e) { err = e; }
chk(!err, "调用不报错" + (err ? "：" + err.message : ""));
console.log("  一键之后：英雄=" + ctx.START.heroMode + " 血量=" + CFG.unit.rifle.hp +
  " 暂停键=" + JSON.stringify(ctx.KEYMAP.pause) + " 音量=" + ctx.SFX.volume);
chk(ctx.START.heroMode === false, "开战设置被重置");
chk(Math.abs(CFG.unit.rifle.hp - hp0) < 0.01, "兵种数值被重置");
chk(ctx.KEYMAP.pause === " ", "键位被重置");
chk(Math.abs(ctx.SFX.volume - 0.95) < 0.01, "音量回到默认");
chk(!("zombieSandbox.vol" in store), "音量设置从本地存储里清掉了");

console.log("=== 六、各设置页都有恢复默认入口 ===");
const raw = html;
chk(raw.indexOf("startReset") >= 0, "开战设置有「恢复默认设置」");
chk(raw.indexOf("utReset") >= 0, "兵种数据有「恢复默认」");
chk(raw.indexOf("bindReset") >= 0, "键位设置有「恢复默认」");
chk(raw.indexOf("eReset") >= 0, "地形编辑器有「恢复默认」");
chk(raw.indexOf("bResetAll") >= 0, "菜单里有「恢复全部默认设置」");
chk(!("zombieSandbox.tune" in store), "兵种数值没有被写进本地存储（永远以代码预设为准）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
