import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const ZN = Number(process.argv[3] || 300);
const SEC = Number(process.argv[4] || 60);
const SEED = 20240607;

const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
function makeCtx() {
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
  vm.runInContext(gcode, ctx, { filename: "game-in.js" });
  return ctx;
}
function fnv(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function hashWorld(ctx) {
  const us = ctx.W.units;
  let live = 0, a = [];
  for (let i = 0; i < us.length; i++) {
    const u = us[i];
    if (u.dead) continue;
    live++;
    a.push(u.id, u.x, u.y, u.vx, u.vy, u.hp);
  }
  let b = [];
  for (let i = 0; i < ctx.W.bullets.length; i++) {
    const bd = ctx.W.bullets[i];
    b.push(bd.x, bd.y, bd.vx);
  }
  return { live, h: fnv(a.join(",")), hb: fnv(b.join(",")),
    res: ctx.W.resources, kills: ctx.W.kills, inf: ctx.W.infected,
    nB: ctx.W.bullets.length, nH: (ctx.W.heals || []).length, nT: (ctx.W.tongues || []).length };
}
function start(ctx) {
  ctx.GAME_MODE = "defense";
  ctx.W.mode = "defense";
  ctx.buildScenario(SEED, ZN);
  ctx.W.over = false; ctx.W.paused = false;
  ctx.W.resources = 99999;      /* 让后面的投放一定买得起，排除经济波动干扰 */
}
/* 两侧完全相同的"玩家操作表"：同一帧执行同一件事 */
const INPUTS = [
  { f: 60,   name: "投放 3 名步枪兵", fn: (c) => c.doPlace("rifle", 1500, 1200, 3) },
  { f: 180,  name: "投放 5 只普通丧尸", fn: (c) => c.doPlace("zombie", 2600, 1200, 5) },
  { f: 300,  name: "投放 2 名医疗兵", fn: (c) => c.doPlace("medic", 1560, 1240, 2) },
  { f: 420,  name: "投放 3 只自爆丧尸", fn: (c) => c.doPlace("bomber", 2650, 1150, 3) },
  { f: 540,  name: "投放 2 只舔舐者", fn: (c) => c.doPlace("licker", 2700, 1300, 2) },
  { f: 660,  name: "投放 1 只母体", fn: (c) => c.doPlace("mother", 2750, 1100, 1) }
];
function applyInputs(ctx, frame) {
  for (let i = 0; i < INPUTS.length; i++) {
    if (INPUTS[i].f === frame) { try { INPUTS[i].fn(ctx); } catch (e) {} }
  }
  /* 900~1080 帧：接管一名步枪兵并按住开火，模拟玩家真实输入 */
  if (frame === 900) {
    const u = ctx.W.units.find(x => !x.dead && x.kind === "rifle");
    if (u) { ctx.PLAYER.on = true; ctx.PLAYER.unit = u; ctx.PLAYER.firing = true; }
  }
  if (frame === 1080) { ctx.PLAYER.firing = false; ctx.PLAYER.unit = null; }
}

console.log("规模 " + ZN + " 只初始丧尸，跑 " + SEC + " 秒，种子 " + SEED);
console.log("中途注入 " + (INPUTS.length + 1) + " 次玩家操作（投放与开火）");
const A = makeCtx(), B = makeCtx();
start(A); start(B);
const MARKS = [1, 2, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120];
let bad = 0, firstBad = null;
const frames = Math.round(SEC * 60);
const ha0 = hashWorld(A), hb0 = hashWorld(B);
console.log("开局：" + (ha0.h === hb0.h ? "一致" : "分叉") + "（" + ha0.live + " 单位）");
for (let f = 1; f <= frames; f++) {
  applyInputs(A, f);
  applyInputs(B, f);
  A.stepSim(1 / 60);
  B.stepSim(1 / 60);
  const sec = f / 60;
  if (MARKS.indexOf(Math.round(sec)) >= 0 && Math.abs(sec - Math.round(sec)) < 1e-9) {
    const ha = hashWorld(A), hb = hashWorld(B);
    const ok = ha.h === hb.h && ha.hb === hb.hb;
    console.log("  " + String(Math.round(sec)).padStart(3) + "s " + (ok ? "一致" : "分叉") +
      "  存活 " + ha.live + "/" + hb.live +
      "  子弹 " + ha.nB + "/" + hb.nB +
      "  治疗弹 " + ha.nH + "/" + hb.nH +
      "  舌头 " + ha.nT + "/" + hb.nT +
      "  击杀 " + ha.kills + "/" + hb.kills +
      "  感染 " + ha.inf + "/" + hb.inf +
      "  资源 " + ha.res.toFixed(2) + "/" + hb.res.toFixed(2));
    if (!ok) { bad++; if (firstBad === null) firstBad = Math.round(sec); }
  }
}
console.log("");
console.log(bad === 0 ? "=== 带玩家输入全程严格一致 ===" : ("=== 第 " + firstBad + " 秒开始分叉，共 " + bad + " 个采样点不一致 ==="));
if (bad > 0) {
  for (let i = 0; i < A.W.units.length; i++) {
    const ua = A.W.units[i], ub = B.W.units[i];
    if (!ua || !ub || ua.dead || ub.dead) continue;
    if (ua.x !== ub.x || ua.y !== ub.y) {
      console.log("  首个差异单位 #" + ua.id + " " + ua.kind + " (" + ua.state + ") 位置差 " +
        Math.hypot(ua.x - ub.x, ua.y - ub.y).toExponential(3));
      break;
    }
  }
}