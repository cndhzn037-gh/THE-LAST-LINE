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

/* 一开始就把丧尸清空，免得它们互相干扰 */
ctx.buildScenario(999, 2);
for (const u of W().units) u.dead = true;
ctx.cleanup();
W().units.length = 0;

/* 一个四面封死的盒子 */
function sealedBox(x, y, w, h) {
  const t = 32;
  W().obstacles.push(ctx.makeObstacle(x, y, w, t, "wall"));
  W().obstacles.push(ctx.makeObstacle(x, y + h - t, w, t, "wall"));
  W().obstacles.push(ctx.makeObstacle(x, y, t, h, "wall"));
  W().obstacles.push(ctx.makeObstacle(x + w - t, y, t, h, "wall"));
  ctx.NAV.build(CFG.world, W().obstacles, 9);
}
sealedBox(1200, 800, 260, 260);
ctx.NAV.build(CFG.world, W().obstacles, 9);

const trapped = ctx.addUnit("civilian", 1330, 930);   /* 关在盒子里，永远够不着 */
const free = ctx.addUnit("civilian", 2200, 930);      /* 盒子外，够得着 */
const z = ctx.addUnit("zombie", 1600, 930);           /* 离 trapped 更近，会先盯上它 */
z.hp = 99999;
ctx.rebuildGrids();

console.log("=== 一、先确认目标是够不着的那个 ===");
console.log("  丧尸到密闭平民 " + Math.hypot(z.x - trapped.x, z.y - trapped.y).toFixed(0) +
  "px，到外面平民 " + Math.hypot(z.x - free.x, z.y - free.y).toFixed(0) + "px（会先选近的）");
chk(ctx.nearestHuman(z) === trapped, "丧尸优先锁定了更近的、但关在密闭空间里的目标");
const direct = ctx.astar(z.x, z.y, trapped.x, trapped.y, 1800);
console.log("  直接对密闭目标寻路：" + (direct === null ? "完全找不到路径" :
  "返回部分路径，终点距目标 " + Math.hypot(direct[direct.length - 1].x - trapped.x, direct[direct.length - 1].y - trapped.y).toFixed(0) + "px"));
chk(direct === null || direct.partial === true, "对密闭目标只能给出部分路径或直接失败");

console.log("\n=== 二、跑起来：是否会放弃够不着的目标 ===");
let gaveUp = false, gaveUpTrapped = false, sawTargetFree = false, gaveUpFrames = 0;
for (let i = 0; i < 60 * 12; i++) {
  ctx.stepSim(1 / 60);
  if (z.giveUpTo === trapped && z.giveUpT > 0) { gaveUpTrapped = true; gaveUpFrames++; }
  if (z.giveUpTo) gaveUp = true;
  if (z.target === free) sawTargetFree = true;
}
console.log("  12 秒里：触发过放弃=" + gaveUp + "（针对密闭目标=" + gaveUpTrapped + "，" + gaveUpFrames + " 帧）" +
  "  转向可达目标=" + sawTargetFree);
console.log("  当前：target=" + (z.target ? z.target.kind : "无") + "  giveUpT=" + z.giveUpT.toFixed(2) +
  "  pathT=" + z.pathT.toFixed(2));
chk(gaveUpTrapped, "识别出密闭空间里的目标够不着，并把它暂时放弃");
chk(sawTargetFree, "放弃之后转去追够得着的目标");
chk(!trapped.dead, "密闭空间里的平民始终没被咬到（确实进不去）");

console.log("\n=== 三、放弃会一直保持，直到有理由重新评估 ===");
const cooldown = CFG.giveUp.time;
let maxT = 0;
for (let i = 0; i < 60 * 12; i++) { ctx.stepSim(1 / 60); if (z.giveUpT > maxT) maxT = z.giveUpT; }
chk(maxT <= cooldown * CFG.giveUp.maxMul + 0.01, "放弃计时被限制在设定上限内（峰值 " + maxT.toFixed(1) + "s）");

/* 目标不动、地形不变的情况下，冷却走完也不再自动解除 */
z.giveUpTo = trapped; z.giveUpT = 0.05; z.giveUpRev = ctx.NAV.rev;
z.giveUpX = trapped.x; z.giveUpY = trapped.y; z.giveUpHold = 0;
z.target = trapped;
tick(6);
console.log("  冷却走完后：giveUpTo=" + (z.giveUpTo ? z.giveUpTo.kind : "无") + "  giveUpT=" + z.giveUpT.toFixed(2) +
  "  target=" + (z.target ? z.target.kind : "无"));
chk(z.giveUpTo === trapped, "地形和目标都没变时保持放弃（再试多少次结果都一样）");
chk(z.target !== trapped, "不会再去追那个够不着的目标");

/* 目标动了 -> 立刻重新评估 */
trapped.x += 260;
tick(1);
console.log("  目标挪走 260px 后：giveUpTo=" + (z.giveUpTo ? z.giveUpTo.kind : "无"));
chk(z.giveUpTo === null, "目标自己跑远之后解除放弃（位置变了，判断可能不再成立）");

/* 地形变了 -> 立刻重新评估 */
z.giveUpTo = trapped; z.giveUpT = 5; z.giveUpRev = ctx.NAV.rev; z.giveUpX = trapped.x; z.giveUpY = trapped.y;
const rev0 = ctx.NAV.rev;
ctx.NAV.build(CFG.world, W().obstacles, 9);     /* 模拟"门被打开/墙被拆" */
tick(1);
console.log("  地形版本 " + rev0 + " -> " + ctx.NAV.rev + " 后：giveUpTo=" + (z.giveUpTo ? z.giveUpTo.kind : "无"));
chk(z.giveUpTo === null, "地形改动之后解除放弃（门开了就该重新考虑）");

console.log("\n=== 四、没有这个机制时会白烧多少寻路 ===");
let calls = 0;
const orig1 = ctx.repathTo;
ctx.repathTo = function () { calls++; return orig1.apply(this, arguments); };
z.giveUpTo = null; z.giveUpT = 0; z.target = trapped; z.path = null; z.pathT = 0;
z.x = 1600; z.y = 930;
tick(60 * 12);
const withGiveUp = calls;
console.log("  开启放弃（实测）: " + withGiveUp + " 次寻路");

/* 直接把放弃动作换成一个空函数，等于关掉这个机制，再跑一遍同样时长 */
const saveGiveUp = ctx.giveUpOn;
ctx.giveUpOn = function () {};
W().units.length = 0;
W().obstacles = W().obstacles.filter(o => !(o.x >= 1200 && o.x <= 1460 && o.y >= 800 && o.y <= 1060));
sealedBox(1200, 800, 260, 260);
const tr2 = ctx.addUnit("civilian", 1330, 930);
const fr2 = ctx.addUnit("civilian", 2200, 930);
const z2 = ctx.addUnit("zombie", 1600, 930);
z2.hp = 99999;
ctx.rebuildGrids();
calls = 0;
tick(60 * 12);
const withoutGiveUp = calls;
ctx.giveUpOn = saveGiveUp;
console.log("  关掉放弃（对照）: " + withoutGiveUp + " 次寻路");
chk(withoutGiveUp === 0 || withGiveUp <= withoutGiveUp, "开启后寻路次数没有变多（" + withGiveUp + " ≤ " + withoutGiveUp + "）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
