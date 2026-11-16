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

console.log("=== 一、锁步框架存在 ===");
chk(typeof ctx.LOCK === "object", "LOCK 对象存在");
chk(typeof ctx.LOCK.hash === "function", "有世界指纹函数");
console.log("  输入延迟 " + ctx.LOCK.delay + " 帧（约 " + Math.round(ctx.LOCK.delay / 60 * 1000) + "ms）");
chk(ctx.LOCK.delay >= 4 && ctx.LOCK.delay <= 20, "延迟在合理区间");

console.log("=== 二、单机时照旧立即生效 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(3, 2); ctx.W.over = false; ctx.W.paused = false;
ctx.W.resources = 9999;
chk(ctx.LOCK.on === false, "单机默认不开锁步");
const before = ctx.W.units.filter(u => !u.dead).length;
const ok = ctx.doPlace("rifle", 1500, 1200, 2);
const after = ctx.W.units.filter(u => !u.dead).length;
console.log("  投放 2 个步枪兵：成功=" + ok + "，单位数 " + before + " → " + after);
chk(ok === true && after === before + 2, "单机当场落地，行为没变");

console.log("=== 三、锁步开启后，命令按帧执行 ===");
ctx.LOCK.reset();
ctx.LOCK.on = true;
const n0 = ctx.W.units.filter(u => !u.dead).length;
ctx.doPlace("rifle", 1600, 1200, 2);
const n1 = ctx.W.units.filter(u => !u.dead).length;
console.log("  下达投放后立刻检查：单位数 " + n0 + " → " + n1 + "，队列 " + ctx.LOCK.pending.length);
chk(n0 === n1, "命令没有当场落地");
chk(ctx.LOCK.pending.length === 1, "进了等待队列");
/* 跑满延迟帧数 */
for (let i = 0; i < ctx.LOCK.delay + 2; i++) ctx.stepSim(1 / 60);
const n2 = ctx.W.units.filter(u => !u.dead).length;
console.log("  跑满 " + (ctx.LOCK.delay + 2) + " 帧后：单位数 " + n2);
chk(n2 === n0 + 2, "到点后自动落地");
chk(ctx.LOCK.pending.length === 0, "队列已清空");

console.log("=== 四、世界指纹可用且稳定 ===");
const h1 = ctx.LOCK.hash();
const h2 = ctx.LOCK.hash();
chk(h1 === h2, "同一状态算两次得到同一个指纹");
console.log("  当前指纹 " + h1);
ctx.addUnit("zombie", 2000, 1400);
ctx.rebuildGrids();
const h3 = ctx.LOCK.hash();
chk(h3 !== h1, "世界变了指纹就变");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));