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
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }

console.log("=== 一、视野范围远大于射程 ===");
console.log("  视野 " + CFG.fog.range + "px vs 步枪射程 " + CFG.far.r + "px");
chk(CFG.fog.range > CFG.far.r * 1.3, "视野明显远于射程");

console.log("=== 二、敌人被真正遮蔽 ===");
chk(raw.indexOf("if (CFG.fog.on && isZombieSide(u) && !u.fogVis) continue;") >= 0,
  "看不见的敌人直接跳过绘制（不是盖一层半透明）");
chk(raw.indexOf("function fogVisUpdate()") >= 0, "有可见性计算");
chk(raw.indexOf("HUMGRID.query(z.x, z.y, R, _fogOut)") >= 0, "只查附近的人类，不是全表扫");
chk(raw.indexOf("if (fogRay(u.x, u.y, ang, d) < d - 26) continue;") >= 0, "中间挡着实心墙就看不见");
chk(raw.indexOf("(R - d) / fd") >= 0, "视野边缘按距离淡入淡出");

console.log("=== 三、渐变：正前方长、侧边硬 ===");
chk(raw.indexOf('g.fillStyle = "#000000";') >= 0, "视野用纯色挖洞，重叠区不会互相干扰出阴影");
chk(raw.indexOf("var center = 1 - af / half;") >= 0, "边缘淡入按偏离视线的角度插值");
chk(raw.indexOf("u.fogAng += fd0 * CFG.fog.turnSmooth;") >= 0, "视野朝向平滑跟随转身，不会一跳一跳");
chk(raw.indexOf("fearRadiusOf(u) * CFG.fog.nearMul") >= 0, "恐惧半径内是全向感知");
console.log("  视野外压暗程度 " + CFG.fog.alpha + "，近身感知倍数 " + CFG.fog.nearMul);
chk(CFG.fog.alpha > 0.5 && CFG.fog.alpha < 0.8, "视野外的建筑压到「隐约可见」");

console.log("=== 四、行为：视野外看不见，视野内看得见 ===");
/* 迷雾现在是默认关闭的实验性功能，测试里要显式打开 */
ctx.CFG.fog.on = true;
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(3, 2);
ctx.W.over = false; ctx.W.paused = false;
/* 场上只留一个观察者：其他人也会"看见"这具丧尸，会掩盖我们想测的判定 */
for (const u of ctx.W.units) u.dead = true;
ctx.cleanup();
ctx.W.obstacles = [];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const hero = ctx.addUnit("rifle", 2000, 1200);
hero.faceAng = 0;                    /* 朝右 */
const near = ctx.addUnit("zombie", 2000 + 600, 1200);   /* 正前方 600px */
const behind = ctx.addUnit("zombie", 2000 - 600, 1200); /* 背后 600px */
ctx.rebuildGrids();
ctx.fogVisUpdate();
console.log("  正前方丧尸 fogVis=" + near.fogVis + "  fade=" + (near.fogFade || 0).toFixed(2));
console.log("  背后丧尸   fogVis=" + behind.fogVis + "  fade=" + (behind.fogFade || 0).toFixed(2));
chk(near.fogVis === 1, "正前方视野内的丧尸可见");
chk(behind.fogVis === 0, "背后的丧尸看不见");

console.log("=== 五、墙体遮挡 ===");
ctx.W.obstacles = [ ctx.makeObstacle(2200, 1100, 40, 300, "wall") ];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const walled = ctx.addUnit("zombie", 2400, 1200);
ctx.rebuildGrids();
ctx.fogVisUpdate();
console.log("  墙后丧尸 fogVis=" + walled.fogVis);
chk(walled.fogVis === 0, "实心墙后面的丧尸看不见");
ctx.W.obstacles = [ ctx.makeObstacle(2200, 1100, 40, 300, "low") ];
ctx.NAV.build(ctx.CFG.W ? ctx.CFG.world : ctx.CFG.world, ctx.W.obstacles, 9);
ctx.rebuildGrids();
ctx.fogVisUpdate();
console.log("  矮墙后丧尸 fogVis=" + walled.fogVis);
chk(walled.fogVis === 1, "矮墙挡不住视线，后面照样看得见");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
