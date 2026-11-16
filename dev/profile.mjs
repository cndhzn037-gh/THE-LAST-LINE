import fs from "node:fs";
import vm from "node:vm";

const file = process.argv[2];
const html = fs.readFileSync(file, "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
function ctxStub() {
  const base = {};
  return new Proxy(base, { get(t, p) { if (p in t) return t[p]; return noop; }, set(t, p, v) { t[p] = v; return true; } });
}
const c2 = ctxStub();
function makeEl() {
  return { style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [], width: 800, height: 600,
    addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
    getAttribute: function () { return null; }, click: noop,
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 800, height: 600 }; },
    getContext: function () { return c2; }, querySelectorAll: function () { return []; } };
}
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat,
  Infinity, NaN, Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop,
  requestAnimationFrame: function () { return 1; },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720;
sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });

function bench(name, fn, n) {
  for (let i = 0; i < 20; i++) fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log("  " + name.padEnd(22) + " x" + n + "  " + ms.toFixed(1) + "ms   " + (ms / n).toFixed(3) + "ms/次");
  return ms / n;
}

// 预热 + 记录慢步
for (let i = 0; i < 600; i++) ctx.stepSim(1 / 60);
let slow = [], sum = 0, n = 900;
for (let i = 0; i < n; i++) {
  const t0 = process.hrtime.bigint();
  ctx.stepSim(1 / 60);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  sum += ms;
  if (ms > 20) slow.push([i, +ms.toFixed(1)]);
}
console.log("stepSim 平均 " + (sum / n).toFixed(3) + "ms/步   >20ms 的步数=" + slow.length + " " + JSON.stringify(slow.slice(0, 8)));
const w = ctx.W;
console.log("当前 单位=" + w.units.length + " 丧尸=" + ctx.countUnits().z + " 人类=" + ctx.countUnits().h);

console.log("--- 分项 ---");
bench("rebuildGrids", () => ctx.rebuildGrids(), 900);
bench("aiZombie(全部)", () => { const u = ctx.W.units; for (let i = 0; i < u.length; i++) if (ctx.isZombie(u[i])) ctx.aiZombie(u[i], 1 / 60); }, 300);
bench("aiHuman(全部)", () => { const u = ctx.W.units; for (let i = 0; i < u.length; i++) if (ctx.isHuman(u[i])) ctx.aiHuman(u[i], 1 / 60); }, 300);
bench("integrate", () => ctx.integrate(1 / 60), 900);
bench("collideObstacles", () => { const u = ctx.W.units; for (let i = 0; i < u.length; i++) ctx.collideObstacles(u[i]); }, 300);
bench("separateUnits", () => ctx.separateUnits(), 300);
bench("stepBullets", () => ctx.stepBullets(1 / 60), 900);
bench("stepInfection", () => ctx.stepInfection(1 / 60), 300);
const zs = w.units.filter((u) => ctx.isZombie(u));
const hs = w.units.filter((u) => ctx.isHuman(u));
bench("nearestHuman", () => { for (let i = 0; i < zs.length; i++) ctx.nearestHuman(zs[i]); }, 300);
bench("herdSample", () => { for (let i = 0; i < zs.length; i++) ctx.herdSample(zs[i]); }, 300);
bench("nearestZombie", () => { for (let i = 0; i < hs.length; i++) ctx.nearestZombie(hs[i]); }, 300);
bench("senseZombies(步枪)", () => { for (let i = 0; i < hs.length; i++) if (hs[i].kind === "rifle") ctx.senseZombies(hs[i], ctx.CFG.far.r); }, 300);
const z0 = zs[0], h0 = hs[0];
bench("astar 远距离", () => ctx.astar(z0.x, z0.y, h0.x, h0.y, 5000), 60);
bench("astar 近距离", () => ctx.astar(z0.x, z0.y, z0.x + 200, z0.y + 100, 5000), 200);
