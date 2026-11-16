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

ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0;
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const z = ctx.addUnit("zombie", 2000, 1200);
const r = ctx.addUnit("rifle", 1850, 1200);
ctx.rebuildGrids();
console.log("网格内单位数:", ctx.ALLGRID.query(2000, 1200, 400, []).length);

ctx.fireBullet(r, z, 0, 1, 1);
console.log("开火后子弹数 =", ctx.W.bullets.length);
const b = ctx.W.bullets[0];
console.log("子弹:", JSON.stringify(b));
const dt = 1 / 60;
const ex = b.x + b.vx * dt, ey = b.y + b.vy * dt;
const arr = [];
ctx.ALLGRID.queryBox(b.x, b.y, ex, ey, arr);
console.log("queryBox 候选数 =", arr.length, "内容:", arr.map(u => u.kind + "@" + u.x.toFixed(0)));
console.log("firstZombieOnSegment =", (function(){ const v = ctx.firstZombieOnSegment(b.x, b.y, ex, ey); return v ? ("命中 " + v.kind + " id=" + v.id) : "null"; })());
console.log("segBlockedByWall =", ctx.segBlockedByWall(b.x, b.y, ex, ey));
console.log("子弹终点 =", ex.toFixed(0), ey.toFixed(0), " 世界宽 =", ctx.CFG.world.w);
console.log("--- 跑一帧 stepSim ---");
ctx.stepSim(dt);
console.log("丧尸 hp =", z.hp, " dead =", z.dead, " 存活子弹 =", ctx.W.bullets.length, " 击杀 =", ctx.W.kills);
for (let i = 0; i < 30; i++) ctx.stepSim(dt);
console.log("30 帧后：丧尸 hp =", z.hp, " dead =", z.dead, " 击杀 =", ctx.W.kills, " 子弹 =", ctx.W.bullets.length, " 特效 =", ctx.W.flashes.length);
console.log("步枪兵状态:", r.state, " mag =", r.mag, " reloading =", r.reloading, " fireNearT =", r.fireNearT.toFixed(3));
const s = ctx.senseZombies(r, ctx.CFG.far.r);
console.log("感知: near =", s.near, " far =", s.far, " nearest =", s.nearest ? s.nearest.kind : "null");
