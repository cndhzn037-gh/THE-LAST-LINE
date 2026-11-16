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
const W = () => ctx.W;
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function tick(n) { for (let i = 0; i < n; i++) ctx.stepSim(1 / 60); }
function scene() {
  ctx.buildScenario(999, 2);
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
  const sh = ctx.addUnit("shield", 1500, 1000);
  const z = ctx.addUnit("zombie", 1600, 1000);
  z.hp = 99999; z.vx = 0; z.vy = 0;
  ctx.rebuildGrids();
  return { sh: sh, z: z };
}
console.log("设定：初速度 " + CFG.shield.blastVel + "px/s，失控 " + CFG.shield.stunT + "s，失控期间加速度 ×" + CFG.shield.stunAccMul);

console.log("\n=== 一、被推走之后不会当场停住 ===");
let s = scene();
const z = s.z, x0 = z.x;
ctx.shieldBlast(s.sh);
const vBlast = Math.hypot(z.vx, z.vy);
const xAfterPush = z.x;
console.log("  冲击瞬间：位移到 x=" + xAfterPush.toFixed(0) + "（推了 " + (xAfterPush - x0).toFixed(0) + "px），速度 " + vBlast.toFixed(0) + "px/s");
chk(vBlast > 150, "被推出后有初速度（" + vBlast.toFixed(0) + "px/s），不是当场静止");
chk(z.stunT > 0, "进入失控状态 " + z.stunT.toFixed(2) + "s");

/* 冲击之后会先播一段抛飞动画，这期间物理积分是暂停的，
   所以采样窗口要比以前更长才能看到速度回落 */
const marks = [];
for (let i = 1; i <= 6; i++) { tick(15); marks.push({ t: i * 0.25, x: z.x, v: Math.hypot(z.vx, z.vy) }); }
console.log("  之后每 0.25 秒：" + marks.map(m => m.t.toFixed(2) + "s x=" + m.x.toFixed(0) + " v=" + m.v.toFixed(0)).join("  |  "));
chk(marks[0].x > xAfterPush + 8, "推完之后还在继续滑（0.25 秒内又滑了 " + (marks[0].x - xAfterPush).toFixed(0) + "px）");

console.log("\n=== 二、滑行距离有节制，不会乱飞 ===");
const last = marks[marks.length - 1];
const glide = last.x - xAfterPush;
console.log("  1.5 秒内额外滑行 " + glide.toFixed(0) + "px，速度从 " + vBlast.toFixed(0) + " 降到 " + last.v.toFixed(0) + "px/s");
chk(glide < 200, "滑行距离被压住（" + glide.toFixed(0) + "px < 200px）");
chk(last.v <= CFG.unit.zombie.vmax + 1, "落地后速度回到正常上限以内");

console.log("\n=== 三、惯性会自己消失 ===");
const xAt1s = z.x;
tick(180);
console.log("  再过 3 秒：x=" + z.x.toFixed(0) + "，速度 " + Math.hypot(z.vx, z.vy).toFixed(0) + "px/s，失控剩余 " + Math.max(0, z.stunT).toFixed(2) + "s");
chk(z.stunT <= 0, "失控计时早已结束");
chk(Math.abs(z.x - xAt1s) < 420, "没有一路飞出地图（3 秒位移 " + Math.abs(z.x - xAt1s).toFixed(0) + "px，属于正常追击移动）");

console.log("\n=== 四、多只丧尸同时被推，没有一个飞出去 ===");
s = scene();
const crowd = [];
for (let i = 0; i < 24; i++) {
  const zz = ctx.addUnit("zombie", 1520 + (i % 6) * 22, 950 + Math.floor(i / 6) * 26);
  zz.hp = 99999; zz.vx = 0; zz.vy = 0;
  crowd.push(zz);
}
ctx.rebuildGrids();
const startX = crowd.map(zz => zz.x);
ctx.shieldBlast(s.sh);
let maxDrift = 0;
for (let i = 0; i < 90; i++) ctx.stepSim(1 / 60);
crowd.forEach((zz, i2) => { if (!zz.dead) maxDrift = Math.max(maxDrift, Math.abs(zz.x - startX[i2])); });
console.log("  24 只里最远的位移 " + maxDrift.toFixed(0) + "px");
chk(maxDrift < 300, "最远的也没飞过 300px（" + maxDrift.toFixed(0) + "px）");

console.log("\n=== 五、惯性不会让单位穿墙 ===");
ctx.buildScenario(999, 2);
for (const u of W().units) u.dead = true;
ctx.cleanup();
W().units.length = 0;
W().obstacles.length = 0;
W().obstacles.push(ctx.makeObstacle(1620, 600, 20, 800, "wall"));
ctx.NAV.build(CFG.world, W().obstacles, 9);
const sh5 = ctx.addUnit("shield", 1500, 1000);
const z5 = ctx.addUnit("zombie", 1590, 1000);
z5.hp = 99999; z5.vx = 0; z5.vy = 0;
ctx.rebuildGrids();
ctx.shieldBlast(sh5);
tick(90);
console.log("  墙在 x=1620~1640，丧尸最终 x=" + z5.x.toFixed(1));
chk(z5.x < 1620, "惯性滑行没有把它带过那堵墙");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
