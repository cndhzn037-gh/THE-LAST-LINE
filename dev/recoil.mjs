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
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
CFG.glow.sightPad = 1e9;      /* 测试里不做视野裁剪，保证边缘闪光能被观察到 */
CFG.postDuty = false;         /* 关掉岗位分配，避免士兵自己跑去站岗干扰观测 */
function cleanScene() {
  ctx.buildScenario(555, 2);
  for (const u of W().units) if (ctx.isHuman(u) || ctx.isZombie(u)) u.dead = true;
  ctx.stepSim(1 / 60);
  return W();
}

console.log("=== 一、后坐力倍率（开火瞬间沿射击反方向的速度增量）===");
cleanScene();
const dummy = ctx.addUnit("zombie", 4000, 2250);
dummy.hp = 99999;
function shot(kind) {
  const u = ctx.addUnit(kind, 1000, 1000);
  u.vx = 0; u.vy = 0; u.ax = 0; u.ay = 0;
  const ang = Math.atan2(dummy.y - u.y, dummy.x - u.x);
  ctx.fireBullet(u, dummy, 0, 2, 1, false, false);
  const along = u.vx * Math.cos(ang) + u.vy * Math.sin(ang);
  const out = { along, boost: u.vmaxBoost, boostT: u.boostT, undo: u.recoilT };
  u.dead = true;
  return out;
}
const rf = shot("rifle"), mg = shot("mg"), sn = shot("sniper"), sh = shot("shield");
console.log("  步枪 " + rf.along.toFixed(1) + "px/s  机枪 " + mg.along.toFixed(1) + "px/s  狙击 " + sn.along.toFixed(1) + "px/s  破盾手枪 " + sh.along.toFixed(1) + "px/s");
chk(Math.abs(rf.along + 42) < 0.6, "步枪后坐力 = 1 单位（" + Math.abs(rf.along).toFixed(1) + "px/s）");
chk(Math.abs(Math.abs(mg.along) / Math.abs(rf.along) - 1.5) < 0.02, "机枪 = 1.5 倍步枪");
chk(Math.abs(Math.abs(sn.along) / Math.abs(rf.along) - 3) < 0.02, "狙击 = 3 倍步枪");
chk(sn.along < 0 && rf.along < 0, "方向是射击方向的反向");
chk(Math.abs(sn.boost + sn.along) < 0.6 && sn.boostT > 0, "同时给出允许短暂超速的速度余量 " + sn.boost.toFixed(1) + "px/s");
chk(sh.undo > 0, "开火后进入抵消计时（" + sh.undo + "s）");

console.log("\n=== 二、恐惧半径内没有丧尸 -> 抵消后坐力 / 有丧尸 -> 退得更快 ===");
function run(threat) {
  cleanScene();
  const sol = ctx.addUnit("rifle", 1000, 1000);
  sol.vx = 0; sol.vy = 0;
  const far = ctx.addUnit("zombie", 1600, 1000);
  far.hp = 99999;
  let near = null;
  if (threat) { near = ctx.addUnit("zombie", 1090, 1000); near.hp = 99999; }
  ctx.fireBullet(sol, far, 0, 2, 1, false, false);
  const v0 = sol.vx;
  let overVmax = 0;
  for (let i = 0; i < 30; i++) {
    if (near) { near.x = 1090; near.y = 1000; near.vx = 0; near.vy = 0; }
    ctx.stepSim(1 / 60);
    if (sol.dead) break;
    const sp = Math.hypot(sol.vx, sol.vy);
    if (sp > sol.vmaxCur * 1.02) overVmax = Math.max(overVmax, sp - sol.vmaxCur);
  }
  return { v0, vx: sol.vx, speed: Math.hypot(sol.vx, sol.vy), overVmax, vmax: sol.vmaxCur };
}
const quiet = run(false);
const hot = run(true);
console.log("  无丧尸在恐惧圈内：开火瞬间 vx=" + quiet.v0.toFixed(1) + " -> 0.5s 后 vx=" + quiet.vx.toFixed(1) + "（速度 " + quiet.speed.toFixed(1) + "）");
console.log("  有丧尸在恐惧圈内：开火瞬间 vx=" + hot.v0.toFixed(1) + " -> 0.5s 后 vx=" + hot.vx.toFixed(1) + "（速度 " + hot.speed.toFixed(1) + "）");
chk(quiet.vx > 0, "没有威胁时被抵消：速度重新指向射击方向（vx=" + quiet.vx.toFixed(1) + " > 0）");
chk(hot.vx < 0, "身边有丧尸时不抵消：一边后退一边开火（vx=" + hot.vx.toFixed(1) + " < 0）");
chk(hot.overVmax > 0.5, "边退边打时速度超过了平时上限（超出 " + hot.overVmax.toFixed(1) + "px/s）");

console.log("\n=== 三、命中抖动 ===");
cleanScene();
const gunner = ctx.addUnit("rifle", 1000, 1000);
const victim = ctx.addUnit("zombie", 1300, 1000);
victim.hp = 99999;
W().shakeT = 0; W().shakeMag = 0;
ctx.damageZombie(victim, 1, gunner);
console.log("  我方命中 -> shakeT=" + W().shakeT.toFixed(3) + "s 幅度=" + W().shakeMag.toFixed(2) + "px");
chk(W().shakeT > 0 && W().shakeMag > 0, "我方士兵命中丧尸时触发极轻微抖动");
W().shakeT = 0; W().shakeMag = 0;
ctx.damageZombie(victim, 1, null);
chk(W().shakeT === 0, "非我方来源的伤害不触发抖动");

console.log("\n=== 四、边缘闪光 ===");
W().glowG = 0;
ctx.killZombie(victim);
console.log("  丧尸阵亡 -> 绿光计时 " + W().glowG.toFixed(3) + "s");
chk(W().glowG > 0, "丧尸阵亡触发绿光闪烁");
const g0 = W().glowG;
for (let i = 0; i < 40; i++) ctx.stepSim(1 / 60);
chk(W().glowG <= 0, "绿光在 " + CFG.glow.greenLife + " 秒内衰减完毕（起始 " + g0.toFixed(2) + "s）");

cleanScene();
const civ = ctx.addUnit("civilian", 1000, 1000);
const biter = ctx.addUnit("zombie", 1010, 1000);
biter.hp = 99999;
W().glowP = 0;
for (let i = 0; i < 6; i++) { biter.x = 1010; biter.y = 1000; biter.vx = 0; biter.vy = 0; ctx.stepSim(1 / 60); }
console.log("  平民被感染 -> infectLocked=" + civ.infectLocked + "  紫光计时 " + W().glowP.toFixed(3) + "s");
chk(civ.infectLocked === true, "平民确实被感染");
chk(W().glowP > 0, "我方单位被感染触发紫光闪烁");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
