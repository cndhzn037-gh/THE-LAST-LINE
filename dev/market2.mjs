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

console.log("=== 一、新配件与散布 ===");
const ext = ctx.gearItemById("extend");
console.log("  枪口延展器：" + (ext ? ext.name + " " + ext.price : "无"));
chk(ext && ext.price === 150, "延展器 150 块");
chk(ext && ext.slot === "muzzle", "占枪口槽（和制退器/收束器互斥）");
chk(raw.indexOf('if (g.sight === "reddot") { s.sight = "cross"; s.spreadMul *= 0.9; }') >= 0,
  "瞄具额外 -10% 散布");
chk(raw.indexOf('["激发威力"') >= 0, "柱状图用「激发威力」而不是「伤害」");

console.log("=== 二、准星样式真的会变 ===");
chk(raw.indexOf('var sight = (playerUnitValid() && PLAYER.unit.gearStats) ? PLAYER.unit.gearStats.sight : "";') >= 0,
  "绘制准星时读取瞄具");
chk(raw.indexOf('if (sight === "cross" || sight === "bracket")') >= 0, "两种瞄具各有一套画法");
chk(raw.indexOf('CTX.fillStyle = "rgba(255,70,70,0.98)";') >= 0, "中心是红点");

console.log("=== 三、市场键再按一次关闭 ===");
chk(raw.indexOf("if (MARKET_OPEN) { MARKET_OPEN = false; hideOverlay(); return true; }") >= 0,
  "同一个键再按一下即关闭");

console.log("=== 四、迷雾默认按模式 ===");
chk(raw.indexOf("if (START.fogMode === undefined) CFG.fog.on = (GAME_MODE === \"escort\");") >= 0,
  "防线关、护送开");
chk(raw.indexOf("id='optFog'") >= 0, "开局面板里有开关");
chk(raw.indexOf("（实验性功能）") >= 0, "标注了实验性功能");

console.log("=== 五、效果验证 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 3;
ctx.buildScenario(3, 3);
ctx.W.over = false; ctx.W.paused = false;
const u = ctx.addUnit("rifle", 2000, 1200);
ctx.rebuildGrids();
u.gear = {}; ctx.applyGear(u);
const sp0 = u.gearStats.spreadMul, dm0 = u.gearStats.dmgMul;
u.gear.sight = "reddot"; ctx.applyGear(u);
console.log("  装红点后：散布倍率 " + u.gearStats.spreadMul + "，威力倍率 " + u.gearStats.dmgMul);
chk(Math.abs(u.gearStats.spreadMul - 0.9) < 0.01, "瞄具压 10% 散布");
u.gear = {}; u.gear.muzzle = "extend"; ctx.applyGear(u);
console.log("  装延展器后：威力倍率 " + u.gearStats.dmgMul);
chk(Math.abs(u.gearStats.dmgMul - 1.25) < 0.01, "延展器抬 25% 激发威力");
u.gear = {}; u.gear.muzzle = "choke"; u.gear.sight = "hollow"; ctx.applyGear(u);
console.log("  收束器 + 快速瞄具：散布倍率 " + u.gearStats.spreadMul.toFixed(3));
chk(Math.abs(u.gearStats.spreadMul - 0.45 * 0.9) < 0.01, "两件叠乘（0.405）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
