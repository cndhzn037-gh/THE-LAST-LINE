import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720;
sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(gcode, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }

ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(3, 2); ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) u.dead = true;
ctx.cleanup();
ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;

console.log("=== 一、爆炸给波及的人加上抛飞 ===");
const near = ctx.addUnit("civilian", 2100, 1200);   /* 圈内 */
const far = ctx.addUnit("civilian", 2000 + 900, 1200); /* 圈外 */
const bomb = ctx.addUnit("bomber", 2000, 1200);
ctx.rebuildGrids();
bomb.hp = 1;
ctx.damageZombie(bomb, 99, null);
chk(!bomb.dead, "先进入蓄爆（不立刻消失）");
tick(1.05);
console.log("  爆炸后：近处 flyT=" + (near.flyT || 0).toFixed(2) + " 峰值高 " + (near.flyPeak || 0).toFixed(0) + "px");
chk((near.flyT || 0) > 0, "圈内的人飞起来了");
chk((far.flyT || 0) === 0, "圈外的人没被带动");
chk((near.flyPeak || 0) > 0, "有明确的腾空高度");

console.log("=== 二、纯动画：位置和状态不受影响 ===");
const px = near.x, py = near.y;
const slowBefore = near.slowT;
chk(slowBefore > 0, "减速状态照常生效（" + slowBefore.toFixed(2) + "s）");
tick(0.15);
console.log("  飞在半空时：flyHeightOf=" + ctx.flyHeightOf(near).toFixed(1) + "px，位置 " +
  Math.round(near.x) + "," + Math.round(near.y) + "（原 " + Math.round(px) + "," + Math.round(py) + "）");
chk(ctx.flyHeightOf(near) > 5, "确实离地了");
chk(Math.abs(near.x - px) < 40 && Math.abs(near.y - py) < 40, "位置没有被这根动画拽走");

console.log("=== 三、动画会自己结束 ===");
tick(1.0);
console.log("  1.2 秒后：flyT=" + (near.flyT || 0).toFixed(2) + "，高度 " + ctx.flyHeightOf(near).toFixed(1));
chk((near.flyT || 0) === 0, "动画结束了");
chk(ctx.flyHeightOf(near) === 0, "落回地面");

console.log("=== 四、抛物线形状正确 ===");
const h = ctx.addUnit("rifle", 2000, 1200);
h.flyDur = 1.0; h.flyT = 1.0; h.flyPeak = 40;
const hs = [];
for (let i = 0; i <= 10; i++) { hs.push(Math.round(ctx.flyHeightOf(h))); h.flyT -= 0.1; }
console.log("  高度采样：" + hs.join(" → "));
chk(hs[0] === 0 && hs[hs.length - 1] === 0, "两端贴地");
chk(Math.max(...hs) >= 35, "中段到达峰值");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));