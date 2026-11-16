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
const raw = html;
const CFG = ctx.CFG;

console.log("=== 一、商品清单 ===");
const items = ctx.GEAR_ITEMS;
console.log("  共 " + items.length + " 件");
const want = { brake: 50, choke: 150, mag15: 50, mag45: 100, fast: 75, fast15: 125, fast45: 175,
  reddot: 25, hollow: 25, spd10: 120, spd30: 300, suit1: 75, suit2: 350, suit3: 700, antidote: 3000 };
for (const id in want) {
  const it = ctx.gearItemById(id);
  chk(it && it.price === want[id], (it ? it.name : id) + " 售价 " + want[id]);
}
chk(!!ctx.gearItemById("bless"), "赐福也在市场里");

console.log("=== 二、同类互斥 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 3;
ctx.buildScenario(3, 3);
ctx.W.over = false; ctx.W.paused = false;
const u = ctx.addUnit("rifle", 2000, 1200);
ctx.rebuildGrids();
u.gear = {};
ctx.PLAYER.on = true; ctx.PLAYER.unit = u;
ctx.W.resources = 999999;
const baseMag = ctx.magOf(u.kind);
ctx.buyGear("mag15");
console.log("  基础弹匣 " + baseMag + " → 装 +15 扩容后 " + u.magSize);
chk(u.gear.mag === "mag15" && u.magSize === baseMag + 15, "扩容 +15 是在本体容量上叠加");
ctx.buyGear("fast45");
console.log("  再买快速弹鼓 +45：弹匣槽 = " + u.gear.mag + "，弹匣 " + u.magSize + " 发");
chk(u.gear.mag === "fast45", "同槽位被顶掉，没有并存");
chk(u.magSize === baseMag + 45, "弹匣跟着变成 " + (baseMag + 45));
ctx.buyGear("spd10");
const v10 = u.vmax;
ctx.buyGear("spd30");
const v30 = u.vmax;
console.log("  +10% 移速 " + v10.toFixed(0) + " → 换成 +30% 后 " + v30.toFixed(0));
chk(Math.abs(v10 / u.gearBaseVmax - 1.1) < 0.02, "+10% 生效且不叠加");
chk(Math.abs(v30 / u.gearBaseVmax - 1.3) < 0.02, "+30% 顶掉了 +10%");

console.log("=== 三、效果确实落到战斗上 ===");
u.gear = {}; ctx.applyGear(u);
const r0 = ctx.recoilOf(u);
u.gear.muzzle = "brake"; ctx.applyGear(u);
const r1 = ctx.recoilOf(u);
console.log("  制退器：后坐力 " + r0.toFixed(0) + " → " + r1.toFixed(0));
chk(r1 < r0 * 0.6, "后坐力明显下降");
u.gear = {}; u.gear.mag = "fast45"; ctx.applyGear(u);
chk(Math.abs(u.gearStats.reloadMul - 0.55) < 0.01, "快速弹匣把换弹时间压到 55%");
u.gear = {}; u.gear.suit = "suit3"; ctx.applyGear(u);
chk(Math.abs(u.suitHp - 8) < 0.01, "三级防护服给 8 秒抗接触");

console.log("=== 四、拆卸 ===");
u.gear = {}; ctx.applyGear(u);
ctx.buyGear("mag15");
chk(u.gear.mag === "mag15", "先装上");
ctx.buyGear("mag15");
chk(!u.gear.mag, "再点一次已装的配件会卸下");
chk(u.magSize === u.gearBaseMag, "弹匣容量回到本体值（" + u.magSize + "）");

console.log("=== 五、入口 ===");
chk(raw.indexOf('id="bMarket"') >= 0, "菜单里有「装备市场」");
const mk = ctx.KEY_ACTS.filter(a => a.id === "market")[0];
chk(!!mk, "市场按键可自定义（默认 " + (mk ? mk.def : "-") + "）");
chk(raw.indexOf("function showMarket()") >= 0, "有市场界面");
chk(raw.indexOf("换装后立刻把数值刷到单位身上") >= 0 || raw.indexOf("function applyGear") >= 0, "换装立刻生效");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
