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

ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(3, 2); ctx.W.over = false; ctx.W.paused = false;
const rifle = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
const mg = ctx.W.units.find(u => !u.dead && u.kind === "mg");

console.log("=== 一、选中但不接管 ===");
ctx.PLAYER.on = true;
ctx.PLAYER.unit = null;
ctx.UI.peek = rifle;
ctx.W.resources = 1000;
chk(typeof ctx.gearTarget === "function", "有统一的配装对象判定");
chk(ctx.gearTarget() === rifle, "仅查看时，配装对象就是被选中的那个人");
ctx.showMarket();
chk(ctx.MARKET_OPEN === true, "商店能打开");
chk(els["panel"].innerHTML.indexOf("先点选一名士兵") < 0, "不再提示「先接管」");
chk(els["panel"].innerHTML.indexOf("AI 操控中") >= 0, "标明这是仅查看状态但照样能配装");

console.log("=== 二、这时候真能买 ===");
const before = ctx.W.resources;
ctx.buyGear("reddot");
console.log("  买红点瞄具：资源 " + before + " → " + ctx.W.resources + "，瞄具=" + (rifle.gearStats && rifle.gearStats.sight));
chk(ctx.gearOf(rifle).sight === "reddot", "配件装到了被选中的人身上");
chk(rifle.gearStats && rifle.gearStats.sight === "cross", "准星样式也跟着换成了红点");
chk(ctx.W.resources === before - 25, "正常扣钱");
const before2 = ctx.W.resources;
ctx.buyGear("suit2");
console.log("  买二级防护服：资源 " + before2 + " → " + ctx.W.resources + "，护甲=" + Math.round(rifle.suitHp || 0));
chk((rifle.suitHp || 0) > 0, "升级类道具同样生效（不需要接管）");
chk(ctx.W.resources === before2 - 350, "升级也正常扣钱");

console.log("=== 三、接管之后仍然以被接管的为准 ===");
ctx.PLAYER.unit = mg;
chk(ctx.gearTarget() === mg, "接管了就配接管的那个人");
ctx.UI.peek = rifle;
chk(ctx.gearTarget() === mg, "即使同时有选中，接管优先");
ctx.buyGear("spd10");
chk(mg.gearStats && mg.gearStats.speedMul > 1, "买给了接管中的人");
chk(!(rifle.gearStats && rifle.gearStats.speedMul > 1), "没有误装到被选中的人身上");

console.log("=== 四、都没有的时候仍然挡住 ===");
ctx.PLAYER.unit = null;
ctx.UI.peek = null;
chk(ctx.gearTarget() === null, "没有对象就返回 null");
const r0 = ctx.W.resources;
ctx.buyGear("spd10");
chk(ctx.W.resources === r0, "没有对象时不扣钱");
ctx.showMarket();
chk(els["panel"].innerHTML.indexOf("先点选一名士兵") >= 0, "空手时提示先选人");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));