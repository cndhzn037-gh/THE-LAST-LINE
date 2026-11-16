import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
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
const W = () => ctx.W;
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }

ctx.buildScenario(undefined, 40);
CFG.sniper.guards = 0;                       /* 狙击手不带平民，否则它会跑去回援掉队的平民 */
const sn = ctx.addUnit("sniper", 200, 2100);
let target = null;                           /* 测试用目标，需要排除在"冻结"之外 */
const FARX = 3980, FARY = 2260;
function tick(sec) {
  const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) {
    for (const z of W().units) {              /* 把其他丧尸按在远角，保证场上只有测试目标可被狙击手发现 */
      if (z === target || z.dead || !ctx.isZombie(z)) continue;
      z.x = FARX; z.y = FARY; z.vx = 0; z.vy = 0;
    }
    ctx.stepSim(1 / 60);
  }
}
console.log("=== 一、无目标时的出击计时（huntAfter=" + CFG.sniper.huntAfter + " 秒）===");
tick(3.5);
console.log("  t=3.5s 未开火计时=" + sn.idleFireT.toFixed(1) + "s  出击中=" + sn.hunting + "  状态=" + sn.state);
chk(!sn.hunting, "3.5 秒时尚未出击");
tick(1.0);
console.log("  t=4.5s 未开火计时=" + sn.idleFireT.toFixed(1) + "s  出击中=" + sn.hunting + "  状态=" + sn.state);
chk(!!sn.hunting, "脱战满 " + CFG.sniper.huntAfter + " 秒后进入主动出击");

console.log("\n=== 二、出击时主动接近感知范围外的丧尸 ===");
target = ctx.addUnit("zombie", sn.x + 2300, sn.y);   /* 2300px：在 nearestZombie(2600) 内，但超出感知半径 2000 */
target.hp = 99999;
const x0 = sn.x, d0 = Math.hypot(target.x - sn.x, target.y - sn.y);
/* 目标也要钉住：它自己会朝人类跑，跑着跑着就改变了距离，
   那样测到的就不是"狙击手是否在主动接近"了 */
const tgtX = target.x, tgtY = target.y;
for (let i = 0; i < 60 * 4; i++) { target.x = tgtX; target.y = tgtY; target.vx = 0; target.vy = 0; ctx.stepSim(1 / 60); }
const d1 = Math.hypot(target.x - sn.x, target.y - sn.y);
console.log("  狙击手 x: " + x0.toFixed(0) + " -> " + sn.x.toFixed(0) + "   与目标距离 " + d0.toFixed(0) + " -> " + d1.toFixed(0));
chk(sn.x > x0 + 80, "狙击手朝目标主动前进 " + (sn.x - x0).toFixed(0) + "px");
chk(d1 < d0 - 80, "目标距离确实在缩短");

console.log("\n=== 三、打出一枪后立刻回到原机制 ===");
target.x = sn.x + 400; target.y = sn.y;
/* 上一段结束时狙击手已经走近到感知范围内、开过枪了，hunting 早就归零。
   这里先把"长时间没开火"的状态复原，才能测到"开火解除出击"这件事本身 */
sn.hunting = 1; sn.idleFireT = CFG.sniper.huntAfter + 1;
let fired = 0, cleared = 0;
const origFB = ctx.fireBullet;
ctx.fireBullet = function (from) { if (from === sn) fired++; return origFB.apply(this, arguments); };
for (let i = 0; i < 60 * 7; i++) {
  target.x = sn.x + 400; target.y = sn.y; target.hp = 99999;
  const was = sn.hunting;
  ctx.stepSim(1 / 60);
  if (was === 1 && sn.hunting === 0) cleared++;
}
ctx.fireBullet = origFB;
console.log("  7 秒内开枪 " + fired + " 次，其中 " + cleared + " 次是在出击状态下打出一枪后当场解除；当前 出击中=" + sn.hunting + " 状态=" + sn.state + " 未开火计时=" + sn.idleFireT.toFixed(2) + "s");
chk(fired >= 2, "狙击手在目标进入射程后连续开火（" + fired + " 次）");
chk(sn.hunting === 0 && sn.state !== "hunt", "开火后解除出击状态");
chk(cleared >= 1, "出击状态是在开火当帧被清除的（" + cleared + " 次）");
chk(sn.idleFireT < CFG.sniper.huntAfter, "未开火计时已被重置（" + sn.idleFireT.toFixed(2) + "s < " + CFG.sniper.huntAfter + "s）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
