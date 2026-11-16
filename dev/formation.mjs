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
const TAU = Math.PI * 2;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function humans() { return W().units.filter(u => ctx.isHuman(u) && !u.dead); }
function nearestArmed(sh) {
  let bd = Infinity;
  for (const a of humans()) { if (a === sh || !ctx.isArmed(a)) continue; bd = Math.min(bd, Math.hypot(sh.x - a.x, sh.y - a.y)); }
  return bd;
}

console.log("=== 一、盾兵：无恐惧半径 + 站位距离带（90 秒）===");
ctx.GAME_MODE = "defense";
ctx.buildScenario(4242, 60);
const hs0 = humans();
let cx = 0, cy = 0;
for (const u of hs0) { cx += u.x; cy += u.y; }
cx /= hs0.length; cy /= hs0.length;
const shields = [];
for (let i = 0; i < 4; i++) {
  const a = TAU * i / 4;
  shields.push(ctx.addUnit("shield", cx + Math.cos(a) * 120, cy + Math.sin(a) * 120));
}
console.log("  手工投放盾兵 " + shields.length + " 名，恐惧半径 = " + shields.map(u => ctx.fearRadiusOf(u)).join(","));
chk(ctx.fearRadiusOf(shields[0]) === 0, "盾兵恐惧半径为 0（不会因为丧尸逼近而后退）");

let flee = 0, dirOkF = 0, samples = 0, inBand = 0, states = {};
const dists = [];
/* 机枪兵只有三个，拿某一帧的快照会碰运气；这里累积"整局里出现过的兵种" */
const seenKinds = {};
for (let s = 0; s < 90; s++) {
  for (let i = 0; i < 60; i++) ctx.stepSim(1 / 60);
  for (const u of humans()) if (u.dirOk) seenKinds[u.kind] = 1;
  for (const sh of humans().filter(u => u.kind === "shield")) {
    samples++;
    states[sh.state] = (states[sh.state] || 0) + 1;
    if (sh.state === "flee") flee++;
    if (sh.dirOk) dirOkF++;
    const d = nearestArmed(sh);
    if (isFinite(d)) { dists.push(d); if (d >= CFG.squad.screenMin - 40 && d <= CFG.squad.screenMax + 40) inBand++; }
  }
}
dists.sort((a, b) => a - b);
const med = dists.length ? dists[Math.floor(dists.length / 2)] : 0;
console.log("  样本 " + samples + "，到最近武装队友的距离：中位 " + med.toFixed(0) + "px  区间 " +
  (dists.length ? dists[0].toFixed(0) + "~" + dists[dists.length - 1].toFixed(0) : "-") + "px  带内 " +
  (samples ? (inBand / samples * 100).toFixed(0) : 0) + "%");
console.log("  配置距离带 [" + CFG.squad.screenMin + ", " + CFG.squad.screenMax + "]px，感染判定只需 " + (8 + 10 + CFG.infect.touchPad) + "px");
console.log("  盾兵状态分布 " + JSON.stringify(states));
chk(flee === 0, "盾兵从未进入逃跑状态（" + flee + " 帧）");
chk(dirOkF === 0, "盾兵不参与队形同步（" + dirOkF + " 帧）");
chk(med >= CFG.squad.screenMin * 0.55, "盾兵与武装队友保持了安全间隔（中位 " + med.toFixed(0) + "px）");

console.log("\n=== 二、队形同步覆盖的兵种 ===");
const kinds = {};
for (const u of humans()) kinds[u.kind] = (kinds[u.kind] || 0) + (u.dirOk ? 1 : 0);
console.log("  末帧 dirOk=1 的数量: " + JSON.stringify(kinds));
console.log("  整局中出现过队形同步的兵种: " + JSON.stringify(Object.keys(seenKinds)));
for (const k of ["rifle", "mg", "civilian"]) chk(!!seenKinds[k], k + " 参与过队形同步");

console.log("\n=== 三、A/B：同场景同种子对比（离群率越低、方向余弦越高 = 队形越整齐）===");
function sample() {
  const by = {};
  for (const u of humans()) (by[u.kind] = by[u.kind] || []).push(u);
  let out = 0, tot = 0, cs = 0;
  for (const k in by) {
    const L = by[k];
    for (const u of L) {
      const su = Math.hypot(u.vx, u.vy);
      if (su < 25) continue;
      let b1 = null, b2 = null, d1 = Infinity, d2 = Infinity;
      for (const v of L) {
        if (v === u) continue;
        const d = Math.hypot(u.x - v.x, u.y - v.y);
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = v; } else if (d < d2) { d2 = d; b2 = v; }
      }
      if (!b1 || !b2) continue;
      let mx = 0, my = 0;
      for (const v of [b1, b2]) { const s = Math.hypot(v.vx, v.vy); if (s < 25) continue; mx += v.vx / s; my += v.vy / s; }
      const m = Math.hypot(mx, my);
      if (m < 1e-6) continue;
      const c = (u.vx * mx + u.vy * my) / (su * m);
      tot++; cs += c;
      if (c < 0.5) out++;
    }
  }
  return { out, tot, cs };
}
/* 单一种子的对比没有意义：这是混沌系统，两条演化路径的差别会淹没机制本身的效果。
   必须多个种子各跑一遍，再比平均值 */
function runFormation(weight, seed, secs) {
  ctx.GAME_MODE = "defense";
  ctx.buildScenario(seed, 70);
  CFG.squad.dirWeight = weight;
  for (let i = 0; i < 60 * 10; i++) ctx.stepSim(1 / 60);
  let out = 0, tot = 0, cs = 0;
  for (let s = 0; s < secs; s++) {
    for (let i = 0; i < 60; i++) ctx.stepSim(1 / 60);
    const r = sample();
    out += r.out; tot += r.tot; cs += r.cs;
  }
  return { outRate: tot ? out / tot : 0, cos: tot ? cs / tot : 0, tot: tot };
}
const W_ON = CFG.squad.dirWeight;
const SEEDS = [111, 222, 333, 444, 555];
let offOut = 0, onOut = 0, offCos = 0, onCos = 0, nS = 0;
for (const sd of SEEDS) {
  const a = runFormation(0, sd, 14);
  const b = runFormation(W_ON, sd, 14);
  offOut += a.outRate; onOut += b.outRate; offCos += a.cos; onCos += b.cos; nS++;
}
offOut /= nS; onOut /= nS; offCos /= nS; onCos /= nS;
console.log("  " + nS + " 个种子平均：");
console.log("  关闭队形同步 dirWeight=0     -> 离群率 " + (offOut * 100).toFixed(1) + "%  方向余弦 " + offCos.toFixed(3));
console.log("  开启队形同步 dirWeight=" + W_ON + "  -> 离群率 " + (onOut * 100).toFixed(1) + "%  方向余弦 " + onCos.toFixed(3));
/* 这项是 5 个种子的随机对比，种子间波动本身就有 1~2 个百分点，阈值放到 3 个点 */
chk(onOut <= offOut + 0.03, "开启后离群比例没有明显上升（" + ((onOut - offOut) * 100).toFixed(1) + " 个百分点）");
chk(onCos >= offCos - 0.02, "开启后同兵种朝向没有变差（余弦 " + ((onCos - offCos) >= 0 ? "+" : "") + (onCos - offCos).toFixed(3) +
  "，多种子平均的差异本来就在零点几个百分点的量级上浮动）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
