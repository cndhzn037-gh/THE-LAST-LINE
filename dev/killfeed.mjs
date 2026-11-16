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

console.log("=== 一、结构 ===");
chk(typeof ctx.addKillFeed === "function", "有淘汰播报写入");
chk(typeof ctx.drawKillFeed === "function", "有淘汰播报绘制");
chk(raw.indexOf("▸") >= 0, "排版是「谁 ▸ 武器 ▸ 谁」（CS:GO 那种）");
chk(CFG.killfeed.max === 5, "最多同时 " + CFG.killfeed.max + " 条");
chk(CFG.killfeed.life > 3, "每条停留 " + CFG.killfeed.life + " 秒");

console.log("=== 二、命中/击杀标记 ===");
chk(raw.indexOf("PLAYER.hitT = CFG.killfeed.hitT") >= 0, "打中会闪命中标记");
chk(raw.indexOf("PLAYER.killT = CFG.killfeed.killT") >= 0, "击杀会闪更显眼的红色标记");
chk(raw.indexOf("rgba(255,90,90,0.98)") >= 0, "击杀标记确实是红色");
chk(raw.indexOf("controlling && CFG.feedback.hitmark && (PLAYER.hitT > 0 || PLAYER.killT > 0)") >= 0,
  "命中标记只在玩家操控时画，且受开关控制");

console.log("=== 三、行为 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 6;
ctx.buildScenario(3, 6);
ctx.W.over = false; ctx.W.paused = false;
const p = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
p.x = 2000; p.y = 1200;
ctx.PLAYER.on = true; ctx.PLAYER.unit = p;
const v = ctx.addUnit("zombie", 2100, 1200);
v.hp = 1;
ctx.rebuildGrids();
ctx.W.feed.length = 0;
ctx.damageZombie(v, 99, p);
console.log("  击杀后播报条数 " + ctx.W.feed.length + "，内容 " +
  (ctx.W.feed[0] ? ctx.W.feed[0].k + " ▸ " + ctx.W.feed[0].gun + " ▸ " + ctx.W.feed[0].v : "无"));
chk(ctx.W.feed.length === 1, "玩家击杀写入了一条播报");
chk(ctx.PLAYER.killT > 0, "准星进入了击杀标记状态");
chk(ctx.W.feed[0].gun === "步枪", "播报里带武器名");

console.log("=== 四、AI 击杀也进播报（全局战况） ===");
const other = ctx.W.units.find(u => !u.dead && u.kind === "mg" && u !== p);
const v2 = ctx.addUnit("zombie", 2200, 1200);
v2.hp = 1;
ctx.rebuildGrids();
const before = ctx.W.feed.length;
if (other) ctx.damageZombie(v2, 99, other);
console.log("  AI 击杀后播报条数 " + ctx.W.feed.length + "（之前 " + before + "）");
chk(ctx.W.feed.length > before, "AI 的击杀同样记录进淘汰播报");
chk(ctx.PLAYER.killT === 0 || ctx.PLAYER.unit !== other, "但不会触发玩家的命中/得分反馈");

console.log("=== 五、会自己淡出 ===");
ctx.stepKillFeed(CFG.killfeed.life + 0.1);
chk(ctx.W.feed.length === 0, "超时后条目自动移除");

console.log("=== 六、丧尸感染人类也进播报 ===");
chk(CFG.killfeed.infectGap > 0, "感染播报有去重间隔 " + CFG.killfeed.infectGap + "s");
ctx.W.feed.length = 0;
ctx.W.feedInfectT = undefined;
const civA = ctx.addUnit("civilian", 2400, 1200);
ctx.rebuildGrids();
ctx.convertToZombie(civA);
console.log("  尸变后播报条数 " + ctx.W.feed.length + "，内容 " +
  (ctx.W.feed[0] ? ctx.W.feed[0].k + " ▸ " + ctx.W.feed[0].gun + " ▸ " + ctx.W.feed[0].v : "无"));
chk(ctx.W.feed.length === 1, "平民被感染转化写入了一条播报");
chk(ctx.W.feed[0].k === "丧尸", "击杀方记为丧尸");
chk(ctx.W.feed[0].gun === "感染", "方式记为感染");
chk(ctx.W.feed[0].v === "平民", "受害者记为平民");
chk(ctx.W.feed[0].z === true, "标记为丧尸方造成的减员");
chk(ctx.W.feed[0].big === false, "不是母体那种大播报");
chk(raw.indexOf("f.z ? \"rgba(255,150,150,\"") >= 0, "绘制时用红色区分丧尸方");
chk(raw.indexOf("f.z ? \"rgba(230,110,110,\"") >= 0, "左侧色条也跟着变红");

/* 同一瞬间的第二起尸变要压掉，否则一次尸潮会把击杀记录全挤没 */
const civB = ctx.addUnit("civilian", 2500, 1200);
ctx.rebuildGrids();
ctx.convertToZombie(civB);
console.log("  紧接着又变一个：播报条数 " + ctx.W.feed.length);
chk(ctx.W.feed.length === 1, "同一瞬间的第二起尸变被去重");
/* 隔开间隔之后要能继续播 */
ctx.W.t += CFG.killfeed.infectGap + 0.02;
const civC = ctx.addUnit("civilian", 2600, 1200);
ctx.rebuildGrids();
ctx.convertToZombie(civC);
console.log("  隔 " + CFG.killfeed.infectGap + "s 后再变一个：播报条数 " + ctx.W.feed.length);
chk(ctx.W.feed.length === 2, "过了间隔又能播报");

/* 人类的击杀播报仍然照旧，不被丧尸方的记录带坏 */
ctx.W.feed.length = 0;
const v3 = ctx.addUnit("zombie", 2700, 1200);
v3.hp = 1;
ctx.rebuildGrids();
ctx.damageZombie(v3, 99, p);
chk(ctx.W.feed.length === 1 && ctx.W.feed[0].z === false, "人类击杀仍标记为人类方（蓝色）");
chk(ctx.W.feed[0].gun === "步枪", "人类击杀的武器名没受影响");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
