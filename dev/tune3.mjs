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

console.log("=== 一、制动加速度 ===");
console.log("  制动 " + CFG.humanBrake + " px/s² vs 起步 " + CFG.unit.rifle.acc + " px/s²");
chk(CFG.humanBrake > CFG.unit.rifle.acc * 3, "制动加速度明显高于起步加速度");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 6;
ctx.buildScenario(5, 6);
ctx.W.over = false; ctx.W.paused = false;
const r1 = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
r1.x = 2000; r1.y = 1200; r1.mateOk = 1;
/* 让它的速度正朝右，而指令方向朝左 —— 这一帧应该是在刹车 */
r1.vx = 150; r1.vy = 0;
r1.ax = 0; r1.ay = 0;
const oldX = r1.x;
r1.x = 2000;
ctx.PLAYER = ctx.PLAYER || { on: false };
ctx.aiHuman(r1, 1 / 60);
console.log("  逆行掉头时 ax = " + r1.ax.toFixed(0) + "（起步加速度是 " + r1.acc + "）");
chk(Math.abs(r1.ax) > r1.acc * 1.5, "逆行时用的是制动加速度");

console.log("=== 二、起步仍用原加速度 ===");
const r2 = ctx.W.units.filter(u => !u.dead && u.kind === "rifle" && u !== r1)[0];
if (r2) {
  r2.x = 2000; r2.y = 1400; r2.mateOk = 1;
  r2.vx = 0; r2.vy = 0; r2.ax = 0; r2.ay = 0;
  ctx.aiHuman(r2, 1 / 60);
  console.log("  静止起步时 |ax| = " + Math.abs(r2.ax).toFixed(0));
  chk(Math.abs(r2.ax) <= r2.acc + 1.5 || Math.abs(r2.ax) === 0, "起步没有被套上制动加速度");
}

console.log("=== 三、子弹长度可调 ===");
const keys = ctx.tuneFieldList("rifle").map(f => f[0]);
chk(keys.indexOf("bullet.len") >= 0, "面板里有「子弹长度」");
console.log("  当前子弹长度 " + CFG.bullet.len);
ctx.cfgPathSet("bullet.len", 160);
chk(CFG.bullet.len === 160, "改了立刻生效");

console.log("=== 四、全局速度比例 ===");
chk(keys.indexOf("speedScale") >= 0, "面板里有「全局速度比例」");
chk(Math.abs(CFG.speedScale - 1) < 0.001, "默认是 1.0");
const v0 = r1.vmax;
ctx.cfgPathSet("speedScale", 1.5);
ctx.applySpeedScale();
console.log("  比例 1 → 1.5：步枪兵最高速 " + v0.toFixed(0) + " → " + r1.vmax.toFixed(0) +
  "（期望 " + (CFG.unit.rifle.vmax * 1.5).toFixed(0) + "）");
chk(Math.abs(r1.vmax - CFG.unit.rifle.vmax * 1.5) < 0.5, "场上已有单位的速度同步放大");
const z1 = ctx.W.units.find(u => !u.dead && ctx.isZombie(u));
if (z1) chk(Math.abs(z1.vmax - CFG.unit[z1.kind].vmax * 1.5) < 0.5, "丧尸也跟着放大（全场生效）");
const nu = ctx.addUnit("rifle", 1700, 1200);
chk(Math.abs(nu.vmax - CFG.unit.rifle.vmax * 1.5) < 0.5, "之后新投放的单位同样按比例来");
ctx.cfgPathSet("speedScale", 1);
ctx.applySpeedScale();
chk(Math.abs(r1.vmax - CFG.unit.rifle.vmax) < 0.5, "调回 1.0 也立刻还原");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
