import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const ZN = Number(process.argv[3] || 500);
const SEC = Number(process.argv[4] || 30);
const SEED = 20240607;

const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { const el = { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null };
  return el; }
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
  vm.runInContext(gcode, ctx, { filename: "game-a.js" });
  return ctx;
}

function fnv(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
/* strict = 原始浮点；loose = 量化到 0.01，用来区分"差一点点"和"真的分叉" */
function hashWorld(ctx, strict) {
  const us = ctx.W.units;
  let live = 0, a = [], b = [];
  for (let i = 0; i < us.length; i++) {
    const u = us[i];
    if (u.dead) continue;
    live++;
    if (strict) a.push(u.id, u.x, u.y, u.vx, u.vy, u.hp);
    else b.push(u.id, u.x.toFixed(2), u.y.toFixed(2), u.hp.toFixed(2));
  }
  const s = strict ? a.join(",") : b.join(",");
  return {
    live,
    h: fnv(s),
    res: ctx.W.resources,
    kills: ctx.W.kills,
    inf: ctx.W.infected,
    bullets: ctx.W.bullets.length,
    tongues: (ctx.W.tongues || []).length,
    heals: (ctx.W.heals || []).length
  };
}
function start(ctx) {
  ctx.GAME_MODE = "defense";
  ctx.W.mode = "defense";
  ctx.buildScenario(SEED, ZN);
  ctx.W.over = false; ctx.W.paused = false;
}

console.log("规模 " + ZN + " 只初始丧尸，跑 " + SEC + " 秒，种子 " + SEED);
const A = makeCtx(), B = makeCtx();
start(A); start(B);
const a0 = hashWorld(A, true), b0 = hashWorld(B, true);
console.log("开局一致：" + (a0.h === b0.h) + "（" + a0.live + " 单位）");

const MARKS = [1, 2, 5, 10, 20, 30, 45, 60, 90, 120, 180, 240, 300];
let bad = 0, firstDiverge = null;
const frames = Math.round(SEC * 60);
for (let f = 1; f <= frames; f++) {
  A.stepSim(1 / 60);
  B.stepSim(1 / 60);
  const sec = f / 60;
  if (MARKS.indexOf(Math.round(sec)) >= 0 && Math.abs(sec - Math.round(sec)) < 1e-9) {
    const ha = hashWorld(A, true), hb = hashWorld(B, true);
    const la = hashWorld(A, false), lb = hashWorld(B, false);
    const okStrict = ha.h === hb.h, okLoose = la.h === lb.h;
    console.log("  " + String(Math.round(sec)).padStart(3) + "s 严格=" + (okStrict ? "一致" : "分叉") +
      " 量化=" + (okLoose ? "一致" : "分叉") +
      "  存活 " + ha.live + "/" + hb.live +
      "  击杀 " + ha.kills + "/" + hb.kills +
      "  感染 " + ha.inf + "/" + hb.inf +
      "  资源 " + ha.res.toFixed(2) + "/" + hb.res.toFixed(2));
    if (!okStrict && firstDiverge === null) firstDiverge = Math.round(sec);
    if (!okStrict) bad++;
  }
}
const fa = hashWorld(A, true), fb = hashWorld(B, true);
console.log("");
console.log(bad === 0 ? "=== 全程严格一致 ===" : ("=== 从第 " + firstDiverge + " 秒开始分叉，共 " + bad + " 个采样点不一致 ==="));
if (bad > 0) {
  /* 找出第一个不同的单位，看看差多少 */
  for (let i = 0; i < A.W.units.length; i++) {
    const ua = A.W.units[i], ub = B.W.units[i];
    if (!ua || !ub || ua.dead || ub.dead) continue;
    if (ua.x !== ub.x || ua.y !== ub.y) {
      console.log("  首个差异单位 #" + ua.id + " " + ua.kind +
        " 位置 (" + ua.x + "," + ua.y + ") vs (" + ub.x + "," + ub.y + ")" +
        " 差 " + Math.hypot(ua.x - ub.x, ua.y - ub.y).toExponential(3));
      break;
    }
  }
}