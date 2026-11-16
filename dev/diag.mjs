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

function snap(tag) {
  const w = ctx.W;
  const zs = w.units.filter((u) => ctx.isZombie(u));
  const hs = w.units.filter((u) => ctx.isHuman(u));
  const avg = (a, f) => (a.length ? a.reduce((s, u) => s + f(u), 0) / a.length : 0);
  const spd = avg(zs, (u) => Math.hypot(u.vx, u.vy));
  const stuck = zs.filter((u) => Math.hypot(u.vx, u.vy) < 5).length;
  const noPath = zs.filter((u) => !u.path || u.path.length === 0).length;
  const pouncing = zs.filter((u) => u.pounceT > 0).length;
  console.log(tag.padEnd(8) + " 丧尸x=" + avg(zs, (u) => u.x).toFixed(0) + " [" + Math.min(...zs.map((u) => u.x)).toFixed(0) + "~" + Math.max(...zs.map((u) => u.x)).toFixed(0) + "]" +
    " 平均速度=" + spd.toFixed(1) + " 近乎静止=" + stuck + " 无路径=" + noPath + " 猛扑中=" + pouncing +
    " | 人类x=" + avg(hs, (u) => u.x).toFixed(0) + " 人类=" + hs.length + " 丧尸=" + zs.length +
    " 击杀=" + w.kills + " 感染=" + w.infected + " 子弹=" + w.bullets.length + " 资源=" + Math.floor(w.resources));
}
snap("t=0");
const t0 = Date.now();
for (let s = 1; s <= 40; s++) {
  for (let i = 0; i < 300; i++) { ctx.stepSim(1 / 60); if (ctx.W.over) break; }
  if (s <= 12 || s % 4 === 0 || ctx.W.over) snap("t=" + (s * 5) + "s");
  if (ctx.W.over) { console.log("对局结束：" + ctx.W.result + " 用时 " + ctx.W.t.toFixed(0) + "s"); break; }
}
console.log("40 段模拟总耗时 " + (Date.now() - t0) + "ms，平均 " + ((Date.now() - t0) / (ctx.W.t * 60)).toFixed(3) + "ms/步");
const zs = ctx.W.units.filter((u) => ctx.isZombie(u));
console.log("\n样本丧尸状态：");
for (let i = 0; i < 5; i++) {
  const u = zs[i];
  console.log("  id=" + u.id + " (" + u.x.toFixed(0) + "," + u.y.toFixed(0) + ") v=" + Math.hypot(u.vx, u.vy).toFixed(1) +
    " 路径点=" + (u.path ? u.path.length : -1) + (u.path && u.path.partial ? "(部分)" : "") +
    " pathT=" + u.pathT.toFixed(2) + " 目标=" + (u.target ? "有" : "无") + " 状态=" + u.state);
}
const hs = ctx.W.units.filter((u) => ctx.isHuman(u));
console.log("样本人类状态：");
for (let i = 0; i < 3; i++) {
  const u = hs[i];
  console.log("  " + u.kind + " (" + u.x.toFixed(0) + "," + u.y.toFixed(0) + ") 状态=" + u.state + " 岗位=" + (u.post ? "有" : "无") + " 感染累积=" + u.infectT.toFixed(2));
}
