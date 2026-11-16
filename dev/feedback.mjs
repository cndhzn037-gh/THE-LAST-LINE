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
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }
const CFG = ctx.CFG;
const raw = html;

console.log("=== 一、经济 ×10 ===");
console.log("  开局资源 " + CFG.econ.start + "，每秒 " + CFG.econ.perSec +
  "，击杀丧尸 +" + CFG.econ.killZombie + "，母体 +" + CFG.econ.killMother);
chk(CFG.econ.start === 300, "开局 300");
chk(CFG.econ.killZombie === 10, "击杀 +10");
chk(CFG.econ.cost.rifle === 250, "步枪兵成本 250");
chk(CFG.hero.cost === 15000, "赐福 15000");
chk(CFG.escort.econPerCivilian === 600, "护送经济同步");

console.log("=== 二、三个反馈开关 ===");
chk(!!CFG.feedback, "有 feedback 配置");
for (const k of ["feed", "hitmark", "killSfx"]) {
  chk(typeof ctx.FB[k] === "boolean", k + " 默认 " + ctx.FB[k]);
}
chk(typeof ctx.toggleFB === "function", "有切换函数");
ctx.toggleFB("feed");
console.log("  切换后 FB.feed = " + ctx.FB.feed + "，CFG.feedback.feed = " + CFG.feedback.feed);
chk(ctx.FB.feed === false && CFG.feedback.feed === false, "开关同时改 FB 与 CFG");
ctx.toggleFB("feed");
chk(ctx.FB.feed === true, "能切回来");

console.log("=== 三、击杀音效 ===");
chk(typeof ctx.SFX.kill === "function", "有击杀确认音");
chk(raw.indexOf("SFX.kill()") >= 0, "击杀时会调用");
chk(raw.indexOf("CFG.feedback.killSfx") >= 0, "受开关控制");

console.log("=== 四、飘分 ===");
chk(typeof ctx.addScorePop === "function", "有飘分");
chk(raw.indexOf("CFG.econ.killZombie") >= 0, "飘的分数取自经济配置");
ctx.W.pops = [];
ctx.addScorePop(10);
chk(ctx.W.pops.length === 1, "能压入一条飘分");
ctx.stepPops(2);
chk(ctx.W.pops.length === 0, "会自己消失");

console.log("=== 五、UI 不重叠 ===");
chk(raw.indexOf("Math.round(VH - 212)") >= 0, "换弹提示贴近占比条上方");
  chk(raw.indexOf('CTX.fillText(L.text, lx, y);') >= 0, "剧情提示挪到左上角，不再和右上角的 UI 打架");
  chk(raw.indexOf("if (W.waves && W.waves.left > 0) {") >= 0, "有波次倒计时时，剧情提示让到它下面");
  chk(raw.indexOf("var lx = 26;") >= 0, "击杀得分挪到左下角");
  chk(raw.indexOf('CTX.fillText("KILL", lx, y);') >= 0, "有往上飘的 KILL +N 文本");
  chk(raw.indexOf("sc.shown += gapv") >= 0, "累积总分是滚动逼�近，不是瞬间跳");
  chk(raw.indexOf('CTX.fillText("换弹中", VW / 2, Math.round(VH - 212))') >= 0,
    "换弹提示水平居中、贴在占比条上方");
  chk(raw.indexOf("rgba(255,255,255,") >= 0 && raw.indexOf("不变红") >= 0, "命中标记是白色斜叉，不变红");
  chk(raw.indexOf("if (attacker && isHuman(attacker)) addKillFeed(attacker, v);") >= 0,
    "淘汰播报对所有击杀生效，不再限于玩家操控");
chk(raw.indexOf("VH - (BOTBAR_H || 0) - 56") < 0, "不再固定在屏幕下方（会和占比条重叠）");
chk(raw.indexOf("hasTimer ? 196 : 64") >= 0, "淘汰播报会避开右上角的增援倒计时");

console.log("=== 六、关闭开关后真的不播 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 6;
ctx.buildScenario(3, 6);
ctx.W.over = false; ctx.W.paused = false;
const p = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
ctx.PLAYER.on = true; ctx.PLAYER.unit = p;
ctx.W.feed.length = 0;
ctx.W.pops.length = 0;
ctx.CFG.feedback.feed = false;
ctx.CFG.feedback.hitmark = false;
const v = ctx.addUnit("zombie", 2100, 1200);
v.hp = 1;
ctx.rebuildGrids();
ctx.damageZombie(v, 99, p);
console.log("  全关之后：播报 " + ctx.W.feed.length + " 条，飘分 " + ctx.W.pops.length + " 条");
chk(ctx.W.feed.length === 0, "关掉播报就不再记录");
chk(ctx.W.pops.length === 0, "关掉命中标记就不飘分");
ctx.CFG.feedback.feed = true;
ctx.CFG.feedback.hitmark = true;

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
