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

ctx.buildScenario(999, 2);
for (const u of W().units) u.dead = true;
ctx.cleanup();
W().units.length = 0;

/* 一个封闭房子：内部 300x300，墙厚 24 —— 和游戏里建筑的厚度接近 */
const BX = 1300, BY = 850, BW = 348, BH = 348, T = 24;
function wall(x, y, w, h) { W().obstacles.push(ctx.makeObstacle(x, y, w, h, "wall")); }
wall(BX, BY, BW, T);
wall(BX, BY + BH - T, BW, T);
wall(BX, BY, T, BH);
wall(BX + BW - T, BY, T, BH);
ctx.NAV.build(CFG.world, W().obstacles, 9);

const inside = ctx.addUnit("civilian", BX + BW / 2, BY + BH / 2);
const zs = [];
for (let i = 0; i < 20; i++) {
  const a = Math.PI * 2 * i / 20;
  const z = ctx.addUnit("zombie", BX + BW / 2 + Math.cos(a) * 420, BY + BH / 2 + Math.sin(a) * 420);
  z.hp = 99999;
  zs.push(z);
}
ctx.rebuildGrids();
console.log("场景：封闭房间内 1 名平民，外面 20 只丧尸环绕 420px，墙厚 " + T);

console.log("\n=== 一、单只丧尸对封闭目标寻路会得到什么 ===");
const z0 = zs[0];
const p = ctx.astar(z0.x, z0.y, inside.x, inside.y, 1800);
if (p === null) console.log("  结果：null（完全找不到）");
else console.log("  结果：路径 " + p.length + " 个点，partial=" + (p.partial === true) +
  "，终点 (" + p[p.length - 1].x.toFixed(0) + "," + p[p.length - 1].y.toFixed(0) + ") 距目标 " +
  Math.hypot(p[p.length - 1].x - inside.x, p[p.length - 1].y - inside.y).toFixed(0) + "px");
if (p) {
  const end = p[p.length - 1];
  console.log("  终点到目标的视线: " + (ctx.NAV.los(end.x, end.y, inside.x, inside.y) ? "畅通（会被判成还能走！）" : "被墙挡住（会判为够不着）"));
}

console.log("\n=== 二、跑 30 秒，看丧尸到底在干什么 ===");
let gaveUpFrames = 0, targetNullFrames = 0, stuckAtWall = 0, sumFrames = 0;
const dists = [];
for (let i = 0; i < 60 * 30; i++) {
  ctx.stepSim(1 / 60);
  sumFrames++;
  for (const z of zs) {
    if (z.dead) continue;
    if (z.giveUpT > 0) gaveUpFrames++;
    if (!z.target) targetNullFrames++;
    const d = Math.hypot(z.x - (BX + BW / 2), z.y - (BY + BH / 2));
    if (d < 260) stuckAtWall++;
  }
  if (i % 300 === 0) {
    let s = 0, n = 0;
    for (const z of zs) if (!z.dead) { s += Math.hypot(z.x - (BX + BW / 2), z.y - (BY + BH / 2)); n++; }
    dists.push((s / Math.max(1, n)).toFixed(0));
  }
}
const total = sumFrames * zs.length;
console.log("  场均距房间中心（每 5 秒采样）: " + dists.join(" → "));
console.log("  处于放弃状态的帧占比: " + (gaveUpFrames / total * 100).toFixed(1) + "%");
console.log("  没有目标的帧占比: " + (targetNullFrames / total * 100).toFixed(1) + "%");
console.log("  贴到墙根 260px 以内的帧占比: " + (stuckAtWall / total * 100).toFixed(1) + "%");
chk(!inside.dead, "房间里的平民没被咬到");
chk(stuckAtWall / total < 0.35, "丧尸没有一直挤在墙根（实测 " + (stuckAtWall / total * 100).toFixed(1) + "%）");

console.log("\n=== 三之前的追加诊断：为什么有的丧尸不放弃 ===");
const zz = zs[0];
const pp = ctx.astar(zz.x, zz.y, inside.x, inside.y, 1800);
if (pp === null) {
  console.log("  丧尸0 当前(" + zz.x.toFixed(0) + "," + zz.y.toFixed(0) + ") 对目标的寻路结果：null（应当触发放弃）");
} else {
  const e2 = pp[pp.length - 1];
  const d2 = Math.hypot(e2.x - inside.x, e2.y - inside.y);
  const los2 = ctx.NAV.los(e2.x, e2.y, inside.x, inside.y);
  console.log("  丧尸0 当前(" + zz.x.toFixed(0) + "," + zz.y.toFixed(0) + ") 距目标 " + Math.hypot(zz.x - inside.x, zz.y - inside.y).toFixed(0) + "px");
  console.log("    路径 " + pp.length + " 点，partial=" + (pp.partial === true) + "，终点距目标 " + d2.toFixed(0) + "px，视线=" + (los2 ? "通畅" : "被挡"));
  console.log("    判定：partial=" + (pp.partial === true) + " 且 dd(" + d2.toFixed(0) + ")>42 且 视线被挡=" + (!los2) +
    "  → 触发放弃=" + (pp.partial === true && d2 > 42 && !los2));
}
console.log("  它卡在墙根的哪一侧：x=" + zz.x.toFixed(0) + "（房间 x 范围 " + BX + "~" + (BX + BW) + "），y=" + zz.y.toFixed(0) + "（房间 y " + BY + "~" + (BY + BH) + "）");
console.log("  内部状态：pathT=" + zz.pathT.toFixed(2) + "  path=" + (zz.path === null ? "null" : "数组(" + zz.path.length + "点)") +
  "  lastTx=" + (zz.lastTx === undefined ? "未定义" : zz.lastTx.toFixed(0)) + "  retargetT=" + zz.retargetT.toFixed(2) +
  "  giveUpCount=" + zz.giveUpCount + "  giveUpHold=" + (zz.giveUpHold || 0).toFixed(1));
let repathCalls = 0, giveUpCalls = 0;
const oR = ctx.repathTo, oG = ctx.giveUpOn;
ctx.repathTo = function () { repathCalls++; return oR.apply(this, arguments); };
ctx.giveUpOn = function () { giveUpCalls++; return oG.apply(this, arguments); };
for (let i = 0; i < 60 * 5; i++) ctx.stepSim(1 / 60);
ctx.repathTo = oR; ctx.giveUpOn = oG;
console.log("  再跑 5 秒：寻路调用 " + repathCalls + " 次，放弃判定 " + giveUpCalls + " 次（全场 20 只丧尸合计）");
console.log("  此时丧尸0：target=" + (zz.target ? zz.target.kind : "无") + "  giveUpTo=" + (zz.giveUpTo ? zz.giveUpTo.kind : "无") + "  giveUpT=" + zz.giveUpT.toFixed(1) + "  giveUpCount=" + zz.giveUpCount);

console.log("\n=== 三、丧尸当前状态抽样 ===");
for (let i = 0; i < 5; i++) {
  const z = zs[i];
  if (z.dead) { console.log("  丧尸" + i + " 已阵亡"); continue; }
  console.log("  丧尸" + i + "  状态=" + z.state + "  target=" + (z.target ? z.target.kind : "无") +
    "  追的是不是够不着的目标=" + (z.target === inside ? "是（不该出现）" : "否") +
    "  giveUpTo=" + (z.giveUpTo ? z.giveUpTo.kind : "无") + "  giveUpT=" + z.giveUpT.toFixed(1) +
    "  距目标=" + (z.target ? Math.hypot(z.x - z.target.x, z.y - z.target.y).toFixed(0) : "-") +
    "  速度=" + Math.hypot(z.vx, z.vy).toFixed(0));
}
console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
