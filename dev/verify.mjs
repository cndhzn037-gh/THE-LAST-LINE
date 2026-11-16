import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [] }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });

function check(n, seconds) {
  ctx.buildScenario(undefined, n);
  const t0 = Date.now();
  let steps = 0;
  for (let i = 0; i < seconds * 60; i++) { ctx.stepSim(1 / 60); steps++; }
  const ms = (Date.now() - t0) / steps;
  const w = ctx.W, c = ctx.countUnits();
  const zs = w.units.filter(u => ctx.isZombie(u));
  const avgX = zs.length ? zs.reduce((s, u) => s + u.x, 0) / zs.length : 0;
  // 卡死检测：位移持续为 0 的丧尸
  const stuck = zs.filter(u => Math.hypot(u.vx, u.vy) < 8).length;
  const hs = w.units.filter(u => ctx.isHuman(u));
  const armed = hs.filter(u => ctx.isArmed(u));
  console.log("开局 " + n + " 只 · " + seconds + "s：丧尸=" + c.z + " 人类=" + c.h +
    " 丧尸均x=" + avgX.toFixed(0) + " 近乎静止=" + stuck +
    " 击杀=" + w.kills + " 感染=" + w.infected +
    " 换弹中=" + armed.filter(a => a.reloading).length + "/" + armed.length +
    " 有掩体=" + armed.filter(a => a.coverKind).length +
    "  | " + ms.toFixed(2) + "ms/步");
}
check(80, 45);
check(400, 45);
check(900, 30);

// 判定逻辑仍能收敛
ctx.buildScenario(undefined, 30);
for (let i = 0; i < 60 * 300 && !ctx.W.over; i++) ctx.stepSim(1 / 60);
console.log("30 只小局：结果=" + (ctx.W.over ? ctx.W.result : "未结束") + " 用时 " + ctx.W.t.toFixed(0) + "s 击杀=" + ctx.W.kills + " 人类剩余=" + ctx.countUnits().h);
