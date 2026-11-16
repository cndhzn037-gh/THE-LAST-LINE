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

ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0; ctx.W.flashes.length = 0;
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const z = ctx.addUnit("zombie", 2000, 1200);
const r = ctx.addUnit("rifle", 1850, 1200);
ctx.rebuildGrids();

let calls = { seg: 0, segTrue: 0, first: 0, firstHit: 0, dmg: 0, dmgAmount: 0 };
const origSeg = ctx.segBlockedByWall, origFirst = ctx.firstZombieOnSegment, origDmg = ctx.damageZombie;
ctx.segBlockedByWall = function (a, b, cc, d) { calls.seg++; const v = origSeg(a, b, cc, d); if (v) calls.segTrue++; return v; };
ctx.firstZombieOnSegment = function (a, b, cc, d) { calls.first++; const v = origFirst(a, b, cc, d); if (v) calls.firstHit++; return v; };
ctx.damageZombie = function (v, d) { calls.dmg++; calls.dmgAmount += d; return origDmg(v, d); };

ctx.W.bullets.length = 0;
ctx.fireBullet(r, z, 0, 1, 1);
console.log("手动子弹:", JSON.stringify(ctx.W.bullets[0]));
calls = { seg: 0, segTrue: 0, first: 0, firstHit: 0, dmg: 0, dmgAmount: 0 };
ctx.stepBullets(1 / 60);
console.log("stepBullets 一次调用统计:", JSON.stringify(calls));
console.log("丧尸 hp =", z.hp, " 子弹 =", ctx.W.bullets.length);

console.log("--- 再跑 5 次 stepBullets ---");
for (let i = 0; i < 5; i++) ctx.stepBullets(1 / 60);
console.log("丧尸 hp =", z.hp, " dead =", z.dead, " 子弹 =", ctx.W.bullets.length, " 统计:", JSON.stringify(calls));

console.log("--- 用 stepSim 跑 60 帧（手动补子弹来源：步枪兵自行开火）---");
for (let i = 0; i < 60; i++) ctx.stepSim(1 / 60);
console.log("丧尸 hp =", z.hp, " dead =", z.dead, " 击杀 =", ctx.W.kills, " 统计:", JSON.stringify(calls));
