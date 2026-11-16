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

const NAV = ctx.NAV;
function reachable(fx, fy, tx, ty) {
  const s = [Math.floor(fx / NAV.tile), Math.floor(fy / NAV.tile)];
  const t = [Math.floor(tx / NAV.tile), Math.floor(ty / NAV.tile)];
  if (NAV.b(s[0], s[1])) return "起点被堵";
  if (NAV.b(t[0], t[1])) return "终点被堵";
  const seen = new Uint8Array(NAV.cols * NAV.rows);
  const q = [s]; let head = 0;
  seen[s[1] * NAV.cols + s[0]] = 1;
  const D = [[1,0],[-1,0],[0,1],[0,-1]];
  while (head < q.length) {
    const cur = q[head++];
    if (cur[0] === t[0] && cur[1] === t[1]) return "可达";
    for (const d of D) {
      const nx = cur[0] + d[0], ny = cur[1] + d[1];
      if (NAV.b(nx, ny)) continue;
      const i = ny * NAV.cols + nx;
      if (seen[i]) continue;
      seen[i] = 1; q.push([nx, ny]);
    }
  }
  return "不可达";
}
console.log("障碍数=" + ctx.W.obstacles.length + " 门数=" + ctx.W.doors.length + " 岗位=" + ctx.W.posts.length);
console.log("连通性 丧尸出生点(400,1150) -> 人类大屋(3500,1150): " + reachable(400, 1150, 3500, 1150));
console.log("连通性 丧尸出生点(400,400) -> 人类大屋(3500,1150): " + reachable(400, 400, 3500, 1150));
console.log("连通性 人类大屋内部(3300,900) -> 外部(2000,1150): " + reachable(3300, 900, 2000, 1150));

function snap(tag) {
  const w = ctx.W;
  const zs = w.units.filter((u) => ctx.isZombie(u));
  const hs = w.units.filter((u) => ctx.isHuman(u));
  const armed = hs.filter((u) => ctx.isArmed(u));
  const avg = (a, f) => (a.length ? a.reduce((s, u) => s + f(u), 0) / a.length : 0);
  const stuck = zs.filter((u) => Math.hypot(u.vx, u.vy) < 6).length;
  const rel = armed.filter((u) => u.reloading).length;
  const cov = armed.filter((u) => u.coverKind).length;
  const escort = hs.filter((u) => u.kind === "civilian" && u.guardOf).length;
  console.log(tag.padEnd(7) + " 丧尸x=" + avg(zs, (u) => u.x).toFixed(0) + "[" + (zs.length ? Math.min(...zs.map(u=>u.x)).toFixed(0) : "-") + "~" + (zs.length ? Math.max(...zs.map(u=>u.x)).toFixed(0) : "-") + "]" +
    " 速=" + avg(zs, (u) => Math.hypot(u.vx, u.vy)).toFixed(0) + " 静止=" + stuck +
    " | 人x=" + avg(hs, (u) => u.x).toFixed(0) + " 人=" + hs.length + " 尸=" + zs.length +
    " 换弹=" + rel + " 有掩体=" + cov + " 护卫中=" + escort +
    " 击杀=" + w.kills + " 感染=" + w.infected + " 子弹=" + w.bullets.length + " 特效=" + w.flashes.length);
}
snap("t=0");
const t0 = Date.now();
for (let s = 1; s <= 30; s++) {
  for (let i = 0; i < 300; i++) { ctx.stepSim(1 / 60); if (ctx.W.over) break; }
  if (s % 2 === 1 || ctx.W.over) snap("t=" + (s * 5) + "s");
  if (ctx.W.over) { console.log("结束：" + ctx.W.result + " 用时 " + ctx.W.t.toFixed(0) + "s"); break; }
}
console.log("平均 " + ((Date.now() - t0) / (ctx.W.t * 60)).toFixed(3) + "ms/步");
