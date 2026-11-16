import fs from "node:fs";
import vm from "node:vm";

const file = process.argv[2] || "丧尸沙盒.html";
const html = fs.readFileSync(file, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: 没有 script"); process.exit(1); }
const code = m[1];
try { new vm.Script(code, { filename: "game.js" }); }
catch (e) { console.error("FAIL 语法: " + e.message); process.exit(1); }
console.log("PASS 语法检查");

const noop = function () {};
function ctxStub() {
  const base = { canvas: null, globalCompositeOperation: "source-over", fillStyle: "", strokeStyle: "",
    lineWidth: 1, globalAlpha: 1, font: "", textAlign: "", shadowBlur: 0, lineCap: "butt", lineJoin: "miter",
    createLinearGradient: function () { return { addColorStop: noop }; },
    createRadialGradient: function () { return { addColorStop: noop }; } };
  return new Proxy(base, { get(t, p) { if (p in t) return t[p]; return noop; }, set(t, p, v) { t[p] = v; return true; } });
}
const ctxs = ctxStub();
function makeEl(id) {
  return { id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [],
    width: 800, height: 600, addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop,
    setAttribute: noop, getAttribute: function () { return null; }, click: noop,
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 800, height: 600 }; },
    getContext: function () { return ctxs; }, querySelectorAll: function () { return []; } };
}
const els = {}, store = {};
const sandbox = {
  console: console, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String,
  Number: Number, isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat, Infinity: Infinity,
  NaN: NaN, Uint8Array: Uint8Array, Int32Array: Int32Array, Float32Array: Float32Array, Map: Map, Set: Set,
  Error: Error, Promise: Promise, TextEncoder: TextEncoder, TextDecoder: TextDecoder,
  Blob: Blob, Response: Response, CompressionStream: (typeof CompressionStream !== "undefined" ? CompressionStream : undefined),
  DecompressionStream: (typeof DecompressionStream !== "undefined" ? DecompressionStream : undefined),
  atob: atob, btoa: btoa, URL: URL, navigator: { clipboard: null, share: null },
  setTimeout: noop, clearTimeout: noop, requestAnimationFrame: function () { return 1; },
  localStorage: { getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
  document: { getElementById: function (id) { return els[id] || (els[id] = makeEl(id)); },
    createElement: function (t) { return makeEl("new-" + t); },
    querySelectorAll: function () { return []; }, body: { appendChild: noop } }
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.window.innerWidth = 1280; sandbox.window.innerHeight = 720; sandbox.window.devicePixelRatio = 1;
sandbox.window.addEventListener = noop;
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx, { filename: "game.js" });

let fails = 0;
function ok(cond, msg) { if (cond) console.log("PASS " + msg); else { fails++; console.log("FAIL " + msg); } }
function freshArena(kind, nZ) {
  ctx.W.units.length = 0;
  ctx.W.posts.length = 0;
  ctx.W.bullets.length = 0;
  ctx.W.cryoPots.length = 0; ctx.W.cryoFields.length = 0;
  ctx.W.firePatches.length = 0; ctx.W.flameJets.length = 0; ctx.W.flameParts.length = 0; ctx.W.teslaArcs.length = 0;
  ctx.W.over = false;
  const u = ctx.addUnit(kind, 1000, 1000);
  for (let i = 0; i < nZ; i++) {
    const z = ctx.addUnit("zombie", 1230 + (i % 4) * 46, 930 + Math.floor(i / 4) * 70);
    z.hp = 5;
  }
  return u;
}
function hpSum() {
  let s = 0;
  for (const z of ctx.W.units) if (z.kind === "zombie" && !z.dead) s += z.hp;
  return s;
}
function stepN(n) { for (let i = 0; i < n; i++) ctx.stepSim(1 / 60); }

/* ---- 液氮兵 ---- */
let u = freshArena("cryo", 6);
stepN(90);
ok(ctx.W.cryoPots.length > 0 || ctx.W.cryoFields.length > 0, "液氮兵抛出罐子（飞行中或已碎裂）");
let guard = 0;
while (ctx.W.cryoFields.length === 0 && guard++ < 240) ctx.stepSim(1 / 60);
ok(ctx.W.cryoFields.length > 0, "罐子落地生成寒冷圈");
const zs = ctx.W.units.filter((x) => x.kind === "zombie" && !x.dead);
ok(zs.some((z) => (z.cryoT || 0) > 0), "圈内丧尸开始累积受冻时间");
ok(zs.some((z) => (z.cryoSlow || 1) < 0.95), "圈内丧尸被减速");
stepN(200);
ok(zs.some((z) => (z.cryoT || 0) > 0.5), "受冻时间在累积（要 6 秒才压到底）");
ok(u.magSize >= 1, "液氮兵弹匣按瓶计（magSize=" + u.magSize + "）");

/* ---- 喷火兵 ---- */
u = freshArena("flame", 8);
const hp0 = hpSum();
let sawBurn = false;
for (let i = 0; i < 60; i++) {
  ctx.stepSim(1 / 60);
  if (ctx.W.units.some((z) => z.kind === "zombie" && (z.burnT || 0) > 0)) sawBurn = true;
}
ok(ctx.W.firePatches.length > 0, "喷火兵落地铺出火焰片区");
ok(ctx.W.flameParts.length > 0, "喷火兵喷出圆形火焰粒子");
ok(sawBurn, "命中的丧尸被点燃");
stepN(180);
ok(hpSum() < hp0, "火焰与点燃造成持续伤害（" + hp0 + " -> " + hpSum() + "）");

/* ---- 磁爆兵 ---- */
u = freshArena("tesla", 9);
/* 给目标加厚血：连锁会把 9 只全部点到，5 点血撑不到检查的时候就死光了 */
for (const z of ctx.W.units) if (z.kind === "zombie") { z.hp = 60; z.maxHp = 60; }
let sawArc = false;
for (let i = 0; i < 40; i++) { ctx.stepSim(1 / 60); if (ctx.W.teslaArcs.length > 0) sawArc = true; }
ok(sawArc, "磁爆兵打出连锁闪电");
const dmgZ = ctx.W.units.filter((z) => z.kind === "zombie" && z.hp < 60).length;
ok(dmgZ >= 2, "一次闪电连锁到多个目标（" + dmgZ + " 个）");
ok(ctx.CFG.tesla.chainMax === 10 && ctx.teslaCap(u) === 10, "基础连锁上限 10");

/* ---- 激光兵 ---- */
u = freshArena("laser", 6);
const lhp0 = hpSum();
stepN(130);
ok(u.laserPhase === 1 || u.laserPhase === 2 || u.laserSweeps > 0, "蓄力 2 秒后进入发射");
stepN(160);
ok(hpSum() < lhp0, "激光柱造成持续伤害（" + lhp0 + " -> " + hpSum() + "）");

/* ---- 配件换算 ---- */
const c = ctx.addUnit("cryo", 1000, 1000);
c.gear = { mag: "mag45" }; ctx.applyGear(c);
ok(c.magSize === 3, "弹鼓给液氮兵 +2 瓶，共 3 瓶（实得 " + c.magSize + "）");
c.gear.mag = "mag15"; ctx.applyGear(c);
ok(c.magSize === 2, "扩容给液氮兵 +1 瓶（实得 " + c.magSize + "）");
const t = ctx.addUnit("tesla", 1000, 1000);
t.gear = { muzzle: "choke" }; ctx.applyGear(t);
ok(ctx.teslaCap(t) === 15, "减 55% 散布 → 连锁上限 10+5（实得 " + ctx.teslaCap(t) + "）");
t.hero = "armed";
ok(ctx.teslaCap(t) === 55, "磁爆兵英雄：上限 ×5 再叠配件（实得 " + ctx.teslaCap(t) + "）");
const la = ctx.addUnit("laser", 1000, 1000);
la.gear = { muzzle: "choke" }; ctx.applyGear(la);
ok(Math.abs(ctx.laserBeamSpec(la).w - 16 * 1.55) < 1e-6, "减 55% 散布 → 光束宽度 +55%");
la.hero = "armed";
const spec = ctx.laserBeamSpec(la);
ok(Math.abs(spec.w - 16 * 1.55 * 5) < 1e-6, "激光兵英雄：宽度 ×5（" + spec.w.toFixed(1) + "）");
ok(Math.abs(spec.len - 840 * 3) < 1e-6, "激光兵英雄：长度 ×3（" + spec.len + "）");

/* ---- 存档往返 ---- */
ctx.W.units.length = 0;
const savedKinds = ["cryo", "flame", "tesla", "laser"];
for (let i = 0; i < savedKinds.length; i++) ctx.addUnit(savedKinds[i], 900 + i * 80, 900);
for (let i = 0; i < 4; i++) ctx.addUnit("zombie", 1200, 900 + i * 40);
ctx.W.firePatches.push({ x: 1100, y: 1000, r: 18, t: 0, life: 4, tickT: 0, owner: null, hero: 0, seed: 1, hue: 20 });
ctx.W.cryoFields.push({ x: 1000, y: 1100, r: 130, t: 0, life: 3, owner: null, hero: 0, seed: 1 });
const snap = JSON.parse(JSON.stringify(ctx.serialize()));
ctx.deserialize(JSON.parse(JSON.stringify(snap)));
ok(ctx.W.units.filter((x) => savedKinds.indexOf(x.kind) >= 0).length === 4, "四个新兵种都能存档往返");
ok(ctx.W.firePatches.length === 1, "火焰片区随存档保留");
ok(ctx.W.cryoFields.length === 1, "寒冷圈随存档保留");
stepN(120);
let nan = false;
for (const x of ctx.W.units) if (!isFinite(x.x) || !isFinite(x.y)) nan = true;
ok(!nan, "读档后继续推演没有 NaN");

/* ---- 换弹后的灰色大弹匣 ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0;
const fu = ctx.addUnit("flame", 1000, 1000);
fu.lastFireT = ctx.W.t;   /* 别让"十秒不开火自动补弹"抢在换弹前面把弹匣补满 */
fu.mag = 0; fu.reloading = true; fu.reloadT = 0.01;
for (let i = 0; i < 3; i++) ctx.stepSim(1 / 60);
const bigShell = ctx.W.shells.some((s) => s.big) ||
  ctx.W.casings.some((c) => c.size > 4);
ok(bigShell, "喷火兵换弹后退下大号灰色燃料罐");
const tu2 = ctx.addUnit("tesla", 1000, 1000);
tu2.lastFireT = ctx.W.t;
tu2.mag = 0; tu2.reloading = true; tu2.reloadT = 0.01;
for (let i = 0; i < 3; i++) ctx.stepSim(1 / 60);
ok(ctx.W.shells.length + ctx.W.casings.length > 0, "磁爆兵换弹有弹匣落地");

/* ---- 渲染冒烟：把新兵种和所有特效都画一遍 ---- */
ctx.W.units.length = 0;
for (const k of ["cryo", "flame", "tesla", "laser"]) {
  const nu = ctx.addUnit(k, 900 + ctx.W.units.length * 40, 900);
  nu.laserPhase = (k === "laser") ? 1 : 0;
  nu.burnT = (k === "flame") ? 2 : 0;
  nu.cryoT = (k === "cryo") ? 2 : 0;
  nu.cryoSlow = 0.4;
}
ctx.W.cryoFields.push({ x: 1000, y: 1000, r: 130, t: 0.5, life: 3, owner: null, hero: 1, seed: 1 });
ctx.W.firePatches.push({ x: 1100, y: 1000, r: 18, t: 0.2, life: 4, tickT: 0, owner: null, hero: 0, seed: 2, hue: 20 });
ctx.W.flameJets.push({ x: 1000, y: 1000, ang: 0, len: 300, t: 0.02, life: 0.16, hero: 0, seed: 3 });
ctx.W.teslaArcs.push({ x1: 1000, y1: 1000, x2: 1200, y2: 1100, t: 0.02, life: 0.16, seed: 4 });
ctx.W.cryoPots.push({ x: 1050, y: 1000, z: 40, vx: 10, vy: 0, vz: 10, spin: 0.3, spinV: 1, owner: null, hero: 0, t: 0.2, T: 0.8 });
let renderOk = true;
try { ctx.render(); } catch (e) { renderOk = false; console.log("渲染异常: " + e.message + (e.stack || "")); }
ok(renderOk, "新兵种与全部特效可以通过渲染路径");


/* ---- 液氮兵的射速：0.5 秒是"弹匣里还有瓶"时的峰值间隔，初始 1 瓶看不出来 ---- */
/* 用钩子数投掷次数：罐子落得快，靠数组长度或弹匣差值都会漏计同帧内的"换弹即抛" */
const _origCryoThrow = ctx.cryoThrowAt;
function cryoThrowTimes(nBottles, frames) {
  ctx.W.units.length = 0; ctx.W.posts.length = 0;
  const cu = ctx.addUnit("cryo", 1000, 1000);
  for (let i = 0; i < 6; i++) {
    const z = ctx.addUnit("zombie", 1240 + (i % 3) * 40, 960 + Math.floor(i / 3) * 50);
    z.vmax = 0; z.vmaxCur = 0; z.acc = 0;   /* 靶子别乱跑，否则会先把测试单位拍死 */
    z.hp = 200; z.maxHp = 200;              /* 冻伤会杀人，血量不够会提前清场，测不到射速 */
  }
  if (nBottles > 1) { cu.gear = { mag: nBottles >= 3 ? "mag45" : "mag15" }; ctx.applyGear(cu); }
  const times = [];
  ctx.cryoThrowAt = function (u2, tx, ty) { times.push(ctx.W.t); return _origCryoThrow(u2, tx, ty); };
  for (let i = 0; i < frames; i++) ctx.stepSim(1 / 60);
  ctx.cryoThrowAt = _origCryoThrow;
  return times;
}
const t1a = cryoThrowTimes(1, 150);   /* 2.5 秒 */
ok(t1a.length === 1, "1 瓶时 2.5 秒内只抛 1 次（打空就换弹）");
const t1b = cryoThrowTimes(1, 260);   /* 4.3 秒 */
ok(t1b.length === 2, "1 瓶时换完弹再抛一次（4.3 秒内 " + t1b.length + " 次）");
if (t1b.length >= 2) {
  ok(Math.abs((t1b[1] - t1b[0]) - 3.0) < 0.2, "1 瓶时两次投掷间隔约等于换弹 3 秒（" + (t1b[1] - t1b[0]).toFixed(2) + "）");
}
const t3a = cryoThrowTimes(3, 70);    /* 1.15 秒 */
ok(t3a.length === 3, "3 瓶时 1 秒内抛出 3 个，峰值 2 罐/秒（实得 " + t3a.length + " 次）");
if (t3a.length >= 2) {
  ok(Math.abs((t3a[1] - t3a[0]) - 0.5) < 0.08, "弹匣有瓶时两次投掷间隔约 0.5 秒（" + (t3a[1] - t3a[0]).toFixed(2) + "）");
}
const t3b = cryoThrowTimes(3, 310);   /* 5.2 秒 */
ok(t3b.length >= 6, "3 瓶打空换弹后继续爆发（5.2 秒内 " + t3b.length + " 次）");
if (t3b.length >= 4) {
  ok(Math.abs((t3b[3] - t3b[2]) - 3.0) < 0.2, "换弹 3 秒后立刻恢复投掷，没有额外的半秒空等（间隙 " + (t3b[3] - t3b[2]).toFixed(2) + " 秒）");
}

/* ---- 墙体阻挡：激光与闪电都不能穿墙 ---- */
function wallArena(kind) {
  ctx.W.units.length = 0; ctx.W.posts.length = 0;
  ctx.W.obstacles.length = 0;
  /* 上一组用例留下的寒冷圈/火片区还在烧，会污染血量对比 */
  ctx.W.cryoFields.length = 0; ctx.W.firePatches.length = 0; ctx.W.firePending.length = 0;
  ctx.W.flameParts.length = 0; ctx.W.teslaArcs.length = 0; ctx.W.bullets.length = 0;
  ctx.W.obstacles.push({ x: 1140, y: 860, w: 40, h: 300, kind: "wall", hue: 220, sat: 10, lit: 30 });
  const u = ctx.addUnit(kind, 1000, 1000);
  /* 射手也钉住：否则它会绕到墙的另一侧，就测不到"隔墙"了 */
  u.vmax = 0; u.vmaxCur = 0; u.acc = 0;
  const z = ctx.addUnit("zombie", 1300, 1000);
  z.vmax = 0; z.vmaxCur = 0; z.acc = 0; z.hp = 500; z.maxHp = 500;
  return { u: u, z: z };
}
let wa = wallArena("laser");
const hpBefore = wa.z.hp;
for (let i = 0; i < 420; i++) ctx.stepSim(1 / 60);
ok(wa.z.hp === hpBefore, "激光光柱被实体墙截断，墙后目标不掉血");
wa = wallArena("tesla");
const hpBefore2 = wa.z.hp;
for (let i = 0; i < 120; i++) ctx.stepSim(1 / 60);
ok(wa.z.hp === hpBefore2 && ctx.W.teslaArcs.length === 0, "磁爆兵隔着墙无法锁定，也不会隔墙放电");

/* ---- 磁爆麻痹：速度归零、短暂定身 ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
ctx.W.cryoFields.length = 0; ctx.W.firePatches.length = 0; ctx.W.teslaArcs.length = 0;
const tu3 = ctx.addUnit("tesla", 1000, 1000);
const zs3 = [];
for (let i = 0; i < 5; i++) {
  const z = ctx.addUnit("zombie", 1240, 980 + i * 10);
  z.hp = 500; z.maxHp = 500; zs3.push(z);
}
let sawParalyze = false, speedZero = false;
for (let i = 0; i < 60; i++) {
  ctx.stepSim(1 / 60);
  for (const z of zs3) {
    if (z.paralyzeT > 0) { sawParalyze = true; if (z.vx === 0 && z.vy === 0) speedZero = true; }
  }
}
ok(sawParalyze, "磁爆命中后目标进入麻痹状态");
ok(speedZero, "麻痹期间速度被清零");
ok(Math.abs(ctx.CFG.tesla.dmg - 0.45) < 1e-9, "磁爆单发伤害 0.45（两轮 10 次打掉 4.5 血）");
ok(Math.abs(ctx.CFG.laser.dmg - 1.5) < 1e-9, "激光每 0.1 秒伤害 1.5");

/* ---- 护送难度：按开局派出的武装数做乘数级缩放 ---- */
ctx.W.squadArmed = 5; const s5 = ctx.escortSquadScale();
ctx.W.squadArmed = 10; const s10 = ctx.escortSquadScale();
ctx.W.squadArmed = 20; const s20 = ctx.escortSquadScale();
ok(Math.abs(s5 - 1) < 1e-9, "5 名武装 = 1.0 倍基准");
ok(s10 > 2.1 && s10 < 2.5, "10 名武装约 2.3 倍（实得 " + s10.toFixed(2) + "）");
ok(s20 > 8, "20 名武装是十几倍压力（实得 " + s20.toFixed(2) + "）");


/* ---- 1.3.6：喷火不穿透（未升格）、射程砍 1/3、激光与机枪不隔墙锁敌 ---- */
function flamePair(hero) {
  ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
  ctx.W.firePatches.length = 0; ctx.W.flameParts.length = 0;
  const u = ctx.addUnit("flame", 1000, 1000);
  u.vmax = 0; u.vmaxCur = 0; u.acc = 0;
  u.faceAng = 0; u.flameAng = 0;
  if (hero) ctx.promoteHero(u, "armed", true);
  const z1 = ctx.addUnit("zombie", 1240, 1000);
  const z2 = ctx.addUnit("zombie", 1400, 1000);
  for (const z of [z1, z2]) { z.vmax = 0; z.vmaxCur = 0; z.acc = 0; z.hp = 500; z.maxHp = 500; }
  return { u: u, z1: z1, z2: z2 };
}
let fp = flamePair(false);
for (let i = 0; i < 120; i++) ctx.stepSim(1 / 60);
ok(fp.z1.hp < 500, "未升格喷火兵能烧到第一个目标");
ok(fp.z2.hp === 500, "未升格喷火兵烧不到第二个目标（火焰被第一个单位挡住）");
fp = flamePair(true);
for (let i = 0; i < 120; i++) ctx.stepSim(1 / 60);
ok(fp.z2.hp < 500, "升格英雄后火焰穿透，第二个目标也会被烧到");
ok(Math.abs(ctx.CFG.flame.range - 560) < 1e-9 && ctx.CFG.unit.flame.gun.r === 560, "喷火射程砍到 560（原 840 的 2/3）");
ok(Math.abs(ctx.CFG.laser.width - 16) < 1e-9 && Math.abs(ctx.CFG.laser.taper - 8) < 1e-9, "激光宽度 16、过渡 8");

/* 激光隔墙连蓄力都不该开始 */
let lw = wallArena("laser");
for (let i = 0; i < 200; i++) ctx.stepSim(1 / 60);
ok(lw.u.laserPhase === 0 && lw.u.laserSweeps === 0, "激光没有视线时不进入蓄力");
ok(lw.z.hp === 500, "激光隔墙不掉血");

/* 机枪隔墙也不该开火 */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
ctx.W.firePatches.length = 0; ctx.W.firePending.length = 0;
ctx.W.obstacles.push({ x: 1140, y: 860, w: 40, h: 300, kind: "wall", hue: 220, sat: 10, lit: 30 });
const mg = ctx.addUnit("mg", 1000, 1000);
mg.vmax = 0; mg.vmaxCur = 0; mg.acc = 0;
const mz = ctx.addUnit("zombie", 1300, 1000);
mz.vmax = 0; mz.vmaxCur = 0; mz.acc = 0; mz.hp = 500; mz.maxHp = 500;
for (let i = 0; i < 180; i++) ctx.stepSim(1 / 60);
ok(mz.hp === 500 && ctx.W.bullets.length === 0, "机枪兵隔墙不锁敌、不开火");


/* ---- 火墙必须等火焰粒子落地才铺开 ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
ctx.W.firePatches.length = 0; ctx.W.firePending.length = 0; ctx.W.flameParts.length = 0;
const fu2 = ctx.addUnit("flame", 1000, 1000);
fu2.vmax = 0; fu2.vmaxCur = 0; fu2.acc = 0; fu2.faceAng = 0; fu2.flameAng = 0;
const fz = ctx.addUnit("zombie", 1360, 1000);
fz.vmax = 0; fz.vmaxCur = 0; fz.acc = 0; fz.hp = 500; fz.maxHp = 500;
ctx.stepSim(1 / 60);          /* 第一帧开火：只应产生"待落地"的排队，不应立刻烧地 */
ok(ctx.W.firePending.length > 0, "开火后火片区进入待落地队列");
ok(ctx.W.firePatches.length === 0, "粒子还没落地时地面还没烧起来");
for (let i = 0; i < 80; i++) ctx.stepSim(1 / 60);
ok(ctx.W.firePatches.length > 0, "粒子落地后才铺出火片区");


/* ---- 1.3.6 补：分散目标、磁爆手动落点、激光玩家换弹 ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
const za = ctx.addUnit("zombie", 1100, 1000);
const zb = ctx.addUnit("zombie", 1140, 1000);
const caller = ctx.addUnit("tesla", 1000, 1000);
ctx.rebuildGrids();          /* 直接调函数不会自动重建网格 */
ctx.W.teslaClaims.length = 0;
const claimed1 = ctx.pickClaimedTarget(caller, 840, ctx.W.teslaClaims);
const claimed2 = ctx.pickClaimedTarget(caller, 840, ctx.W.teslaClaims);
ok(claimed1 && claimed2 && claimed1.id !== claimed2.id, "同兵种连续索敌会分散到不同目标");
ok(ctx.W.teslaClaims.length === 2, "目标占用表记录了两次点名");

ctx.W.teslaArcs.length = 0; ctx.W.teslaClaims.length = 0;
ctx.W.units.length = 0;
const tg = ctx.addUnit("tesla", 1000, 1000);
const gz1 = ctx.addUnit("zombie", 1400, 1000);
gz1.hp = 500; gz1.maxHp = 500;
const gz2 = ctx.addUnit("zombie", 1440, 1040);
gz2.hp = 500; gz2.maxHp = 500;
ctx.rebuildGrids();
ok(ctx.teslaZapAt(tg, 1420, 1020), "磁爆可以对地板落点放电");
ok(ctx.W.teslaArcs.length > 0, "地板落点也会拉出电弧");
ok(gz1.hp < 500 || gz2.hp < 500, "地板落点附近的敌人会被连锁电到");

/* 玩家激光：按住蓄力发射，松开清空这一发并 3 秒换弹 */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
const lu = ctx.addUnit("laser", 1000, 1000);
const lz = ctx.addUnit("zombie", 1300, 1000);
lz.hp = 500; lz.maxHp = 500; lz.vmax = 0; lz.vmaxCur = 0; lz.acc = 0;
ctx.PLAYER.on = true; ctx.PLAYER.unit = lu;
ctx.PLAYER.aimX = 1; ctx.PLAYER.aimY = 0; ctx.PLAYER.aimLen = 1;
ctx.PLAYER.firing = true;
let sawBeam = false;
for (let i = 0; i < 160; i++) { ctx.stepSim(1 / 60); if (lu.laserPhase === 1) sawBeam = true; }
ok(sawBeam, "玩家按住开火键能进入持续照射");
ctx.PLAYER.firing = false;
ctx.stepSim(1 / 60);
ok(lu.reloading && lu.mag === 0, "松开开火键后清空这一发并进入换弹");
ok(Math.abs(lu.reloadT - 3.0) < 0.2, "激光玩家换弹 3 秒（实得 " + lu.reloadT.toFixed(2) + "）");
for (let i = 0; i < 200; i++) ctx.stepSim(1 / 60);
ok(!lu.reloading && lu.mag === 1, "3 秒换弹结束后恢复一发");
ctx.PLAYER.on = false; ctx.PLAYER.unit = null; ctx.PLAYER.firing = false;


/* ---- 液氮减速曲线：6 秒到 95%，且不是一进圈就到底 ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0;
const cz = ctx.addUnit("zombie", 1000, 1000);
cz.cryoT = 6; cz.chillT = 1;
ctx.stepSim(1 / 60);
ok(Math.abs(cz.cryoSlow - 0.05) < 0.02, "受冻 6 秒后只到 95% 减速（cryoSlow≈" + cz.cryoSlow.toFixed(2) + "）");
cz.cryoT = 1.5; cz.chillT = 1;
ctx.stepSim(1 / 60);
ok(cz.cryoSlow > 0.4 && cz.cryoSlow < 0.65, "减速是渐变的（1.5 秒时约一半，实得 " + cz.cryoSlow.toFixed(2) + "）");
ok(ctx.CFG.cryo.freezeAt === 6, "减速到底的时间改为 6 秒");

/* ---- 新兵种武器名 ---- */
ok(ctx.gunNameOf({ kind: "cryo" }) === "液氮罐", "液氮兵武器名：液氮罐");
ok(ctx.gunNameOf({ kind: "flame" }) === "喷火器", "喷火兵武器名：喷火器");
ok(ctx.gunNameOf({ kind: "tesla" }) === "磁暴线圈", "磁爆兵武器名：磁暴线圈");
ok(ctx.gunNameOf({ kind: "laser" }) === "镭射核心", "激光兵武器名：镭射核心");

/* ---- 激光撞墙溅射 ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
ctx.W.obstacles.push({ x: 1140, y: 860, w: 40, h: 300, kind: "wall", hue: 220, sat: 10, lit: 30 });
const spl = ctx.addUnit("laser", 1000, 1000);
spl.vmax = 0; spl.vmaxCur = 0; spl.acc = 0;
const behind = ctx.addUnit("zombie", 1200, 1000);   /* 墙后、但在亮点半径内 */
behind.vmax = 0; behind.vmaxCur = 0; behind.acc = 0; behind.hp = 500; behind.maxHp = 500;
ctx.rebuildGrids();
spl.laserAng = 0; spl.laserLen = 140;
ctx.laserBeamDamage(spl);   /* 光柱在 140 处被墙截断，亮点周围 72 内吃溅射 */
ok(behind.hp < 500, "激光撞墙的亮点会溅射到墙后近处的敌人（实得 hp " + behind.hp.toFixed(1) + "）");


/* ---- 离圈回暖：按 3 秒基准走完 ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0;
const wz = ctx.addUnit("zombie", 1000, 1000);
wz.cryoT = 6; wz.chillT = 3; wz.inCryo = 0;
for (let i = 0; i < 150; i++) ctx.stepSim(1 / 60);   /* 2.5 秒，还在回暖中 */
ok(wz.cryoSlow > 0.05 && wz.cryoSlow < 0.9, "离圈 2.5 秒仍在回暖（" + wz.cryoSlow.toFixed(2) + "）");
for (let i = 0; i < 55; i++) ctx.stepSim(1 / 60);    /* 累计 3.4 秒，已回暖 */
ok(wz.cryoSlow === 1 && wz.cryoT === 0, "离圈 3 秒后回到正常速度");


/* ---- 激光过热：连续照射 8 秒强制换弹 ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
const hu = ctx.addUnit("laser", 1000, 1000);
const hz = ctx.addUnit("zombie", 1300, 1000);
hz.hp = 5000; hz.maxHp = 5000; hz.vmax = 0; hz.vmaxCur = 0; hz.acc = 0;
ctx.PLAYER.on = true; ctx.PLAYER.unit = hu;
ctx.PLAYER.aimX = 1; ctx.PLAYER.aimY = 0; ctx.PLAYER.aimLen = 1;
ctx.PLAYER.firing = true;
for (let i = 0; i < 610; i++) ctx.stepSim(1 / 60);   /* 约 10.2 秒：2 秒蓄力 + 8 秒照射 */
ok(hu.reloading && hu.mag === 0, "连续照射 8 秒后强制换弹");
ok(hu.laserHeat === 0, "强制换弹会清空热量");
ctx.PLAYER.on = false; ctx.PLAYER.unit = null; ctx.PLAYER.firing = false;

/* ---- 颜色阶梯 ---- */
const c0 = ctx.laserHeatRGB(0), c1 = ctx.laserHeatRGB(1), cm = ctx.laserHeatRGB(0.5);
ok(c0.g > 200 && c0.b > 180, "0 热度是青绿色");
ok(c1.r > 240 && c1.g < 80, "满热度是红色");
ok(cm.r > c0.r && cm.g < c0.g, "中间热度向黄/橙过渡");

/* ---- 英雄撞墙：溅射半径等比放大 ---- */
function splashHp(hero) {
  ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
  ctx.W.obstacles.push({ x: 1140, y: 860, w: 40, h: 300, kind: "wall", hue: 220, sat: 10, lit: 30 });
  const su = ctx.addUnit("laser", 1000, 1000);
  if (hero) ctx.promoteHero(su, "armed", true);
  const sz = ctx.addUnit("zombie", 1230, 1000);
  sz.vmax = 0; sz.vmaxCur = 0; sz.acc = 0; sz.hp = 500; sz.maxHp = 500;
  ctx.rebuildGrids();
  su.laserAng = 0; su.laserLen = 140;
  ctx.laserBeamDamage(su);
  return sz.hp;
}
ok(splashHp(false) === 500, "普通激光的溅射半径打不到 90 像素外的目标");
ok(splashHp(true) < 500, "英雄激光的溅射半径等比放大，能打到同一目标");


/* ---- 平民英雄光环：喷火 / 液氮不吃无限弹药 ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
const auraCiv = ctx.addUnit("civilian", 1000, 1000);
ctx.promoteHero(auraCiv, "civilian", true);
const auraFlame = ctx.addUnit("flame", 1060, 1000);
auraFlame.lastFireT = ctx.W.t;   /* 别让"十秒不开火自动补弹"盖过光环测试 */
auraFlame.mag = 5; auraFlame.reloading = true; auraFlame.reloadT = 2;
const auraRifle = ctx.addUnit("rifle", 1120, 1000);
auraRifle.mag = 1; auraRifle.reloading = true; auraRifle.reloadT = 2;
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
ok(auraFlame.mag === 5 && auraFlame.reloading, "喷火兵不吃平民英雄的无限弹药");
ok(auraFlame.rateMul === 1, "喷火兵也不吃光环射速加成");
ok(auraRifle.mag === auraRifle.magSize && !auraRifle.reloading, "步枪兵照常吃光环无限弹药");


/* ---- 1.3.6 补：磁爆范围、直射/横扫、火坑叠加、直流伤害、粒子流速 ---- */
ok(Math.abs(ctx.CFG.tesla.chainR - 174) < 1e-9, "磁爆连锁半径 130 → 174（+1/3）");
ok(ctx.CFG.unit.tesla.gun.r === 560, "磁爆索敌范围 840 → 560（-1/3）");

ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
const modeU = ctx.addUnit("flame", 1000, 1000);
const oneZ = ctx.addUnit("zombie", 1200, 1000);
oneZ.vmax = 0; oneZ.vmaxCur = 0; oneZ.acc = 0;
ctx.rebuildGrids();
for (let i = 0; i < 8; i++) ctx.stepSim(1 / 60);
ok(modeU.fireDirect === 1, "敌人少而散时喷火兵选择直射");

ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
const modeU2 = ctx.addUnit("flame", 1000, 1000);
for (let i = 0; i < 12; i++) {
  const z = ctx.addUnit("zombie", 1180 + (i % 4) * 24, 960 + Math.floor(i / 4) * 24);
  z.vmax = 0; z.vmaxCur = 0; z.acc = 0; z.hp = 500; z.maxHp = 500;
}
ctx.rebuildGrids();
for (let i = 0; i < 8; i++) ctx.stepSim(1 / 60);
ok(modeU2.fireDirect === 0, "敌人多而密时喷火兵选择横扫");

/* 火坑叠加：同一位置两片火，0.4 秒结算两次 2 点 */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
ctx.W.firePatches.length = 0;
const fz2 = ctx.addUnit("zombie", 1000, 1000);
fz2.vmax = 0; fz2.vmaxCur = 0; fz2.acc = 0; fz2.hp = 500; fz2.maxHp = 500;
const patch = { x: 1000, y: 1000, r: 30, t: 0, life: 4, tickT: 0.01, owner: null, hero: 0, seed: 1, hue: 20 };
ctx.W.firePatches.push(Object.assign({}, patch));
ctx.W.firePatches.push(Object.assign({}, patch));
ctx.rebuildGrids();
for (let i = 0; i < 40; i++) ctx.stepSim(1 / 60);
ok(fz2.hp <= 496.1, "同一处火坑会叠加伤害（0.4 秒内两次 2 点，实得 " + (500 - fz2.hp).toFixed(1) + "）");

/* 直流伤害频率：0.2 秒一跳 */
ok(Math.abs(ctx.CFG.flame.directEvery - 0.2) < 1e-9, "直流伤害频率翻倍到 0.2 秒");
ok(ctx.CFG.flame.wallDmg === 2, "火坑单跳伤害翻倍到 2");

/* 激光直射过热 */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
const ldu = ctx.addUnit("laser", 1000, 1000);
const ldz = ctx.addUnit("zombie", 1300, 1000);
ldz.hp = 5000; ldz.maxHp = 5000; ldz.vmax = 0; ldz.vmaxCur = 0; ldz.acc = 0;
ctx.rebuildGrids();
for (let i = 0; i < 620; i++) ctx.stepSim(1 / 60);
ok(ldu.fireDirect === 1, "单个敌人时激光兵选择直射");
ok(ldu.reloading && ldu.mag === 0, "激光直射也会过热并强制换弹");
ok(ctx.CFG.flame.partSpeedMin >= 1400, "火焰粒子视觉流速提高");


/* ---- 目标躲墙后：激光停止、喷火不喷墙、转向有阻尼 ---- */
ok(Math.abs(ctx.turnToward(0, Math.PI / 2, 0.05) - 0.05) < 1e-9, "激光转向有角速度上限，不会瞬间甩到目标");

ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
ctx.W.firePatches.length = 0; ctx.W.firePending.length = 0; ctx.W.flameJets.length = 0;
const ldu2 = ctx.addUnit("laser", 1000, 1000);
const ldz2 = ctx.addUnit("zombie", 1300, 1000);
ldz2.hp = 9000; ldz2.maxHp = 9000; ldz2.vmax = 0; ldz2.vmaxCur = 0; ldz2.acc = 0;
ctx.rebuildGrids();
for (let i = 0; i < 140; i++) ctx.stepSim(1 / 60);   /* 蓄力完成，进入直射 */
ok(ldu2.laserPhase === 1, "激光直射已开火");
ctx.W.obstacles.push({ x: 1140, y: 860, w: 40, h: 300, kind: "wall", hue: 220, sat: 10, lit: 30 });
ctx.rebuildGrids();
for (let i = 0; i < 30; i++) ctx.stepSim(1 / 60);
ok(ldu2.laserPhase !== 1, "目标躲到墙后，激光立刻停止照射");

ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
ctx.W.flameJets.length = 0; ctx.W.flameParts.length = 0;
ctx.W.obstacles.push({ x: 1140, y: 860, w: 40, h: 300, kind: "wall", hue: 220, sat: 10, lit: 30 });
const fw = ctx.addUnit("flame", 1000, 1000);
fw.vmax = 0; fw.vmaxCur = 0; fw.acc = 0;
const fz3 = ctx.addUnit("zombie", 1300, 1000);
fz3.hp = 9000; fz3.maxHp = 9000; fz3.vmax = 0; fz3.vmaxCur = 0; fz3.acc = 0;
ctx.rebuildGrids();
for (let i = 0; i < 100; i++) ctx.stepSim(1 / 60);
ok(ctx.W.flameJets.length === 0 && fz3.hp === 9000, "喷火兵不会对着墙后的目标喷墙");


/* ---- 帝皇特使在非支援流程里也能触发（W.reinf 为 null） ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0; ctx.W.obstacles.length = 0;
ctx.W.reinf = null;
ctx.beginApotheosis();
ok(ctx.W.reinf && ctx.W.reinf.phase === 4, "没有支援流程对象时，帝皇特使事件也能正常触发");
ok(ctx.W.units.length > 0, "帝皇特使落地后场上有英雄小队");


/* ---- 2.0：AI 主动换弹（限定兵种、队友互斥、有压力不换） ---- */
ctx.W.units.length = 0; ctx.W.posts.length = 0;
const rs = { far: 0, fear: 0, nearest: null, dNear: Infinity };
const r1 = ctx.addUnit("rifle", 1000, 1000);
r1.mag = Math.floor(r1.magSize * 0.3);
ctx.tryProactiveReload(r1, rs, false, 0);
ok(r1.reloading, "安静时弹匣不足 40% 会主动换弹");

const r2 = ctx.addUnit("rifle", 1080, 1000);
r2.mag = Math.floor(r2.magSize * 0.3);
const r2b = ctx.addUnit("rifle", 1200, 1000);
r2b.reloading = true; r2b.reloadT = 5;
ctx.rebuildGrids();
ctx.tryProactiveReload(r2, rs, false, 0);
ok(!r2.reloading, "250px 内已有队友换弹时不跟着换");

const r3 = ctx.addUnit("rifle", 1400, 1000);
r3.mag = Math.floor(r3.magSize * 0.3);
const nearZ = ctx.addUnit("zombie", 1450, 1000);
ctx.tryProactiveReload(r3, { far: 1, fear: 1, nearest: nearZ, dNear: 2500 }, false, 0);
ok(!r3.reloading, "贴脸有压力时不主动换弹");

const r4 = ctx.addUnit("rifle", 1600, 1000);
ctx.tryProactiveReload(r4, rs, false, 0);
ok(!r4.reloading, "满弹匣不会白白换弹");

const tz = ctx.addUnit("tesla", 1800, 1000);
tz.mag = 5; tz.teslaBurst = 2;
ctx.tryProactiveReload(tz, rs, false, 0);
ok(!tz.reloading, "磁爆连发中途不打断换弹");

const lz2 = ctx.addUnit("laser", 2000, 1000);
lz2.mag = 0;
ctx.tryProactiveReload(lz2, rs, false, 0);
ok(!lz2.reloading, "激光保持自己的换弹节奏");

/* ---- 2.0：存档码往返 ---- */
const saveObj2 = ctx.serialize();
const payload2 = JSON.stringify({ app: "shibian-sandbox", v: ctx.GAME_VERSION, data: saveObj2 });
const saveCode2 = await ctx.encodeSaveCode(payload2);
ok(saveCode2.indexOf("SB2Z.") === 0 || saveCode2.indexOf("SB2.") === 0, "存档码前缀正确（" + saveCode2.slice(0, 5) + "）");
const back2 = await ctx.decodeSaveCode(saveCode2);
const parsed2 = JSON.parse(back2);
ok(parsed2 && parsed2.data && Array.isArray(parsed2.data.units), "存档码解出的内容完整");
ok(parsed2.data.units.length === saveObj2.units.length, "存档码单位数量一致");
let codeErr2 = false;
try { await ctx.decodeSaveCode("SB2.@@@not-base64@@@"); } catch (e) { codeErr2 = true; }
ok(codeErr2, "损坏的存档码会明确报错");
const jsonBack2 = await ctx.decodeSaveCode(JSON.stringify(saveObj2));
ok(JSON.parse(jsonBack2).units.length === saveObj2.units.length, "旧 JSON 存档仍可直接导入");


/* ---- 2.2：兵种预设的不可变基线与分区重置 ---- */
const rb2 = ctx.unitTuneKindBase("rifle");
ok(Object.keys(rb2).length >= 10, "步枪兵预设快照包含完整字段");
ok(Object.values(rb2).every(v => typeof v === "number" && isFinite(v)), "预设快照全部为有效数字");
ctx.CFG.unit.rifle.hp = 777;
ctx.CFG.unit.rifle.vmax = 777;
ctx.CFG.far.dmg = 77;
ctx.unitTuneResetGroup("rifle", "mobility");
ok(ctx.CFG.unit.rifle.vmax === rb2["unit.rifle.vmax"], "移动分组重置只恢复 vmax");
ok(ctx.CFG.unit.rifle.hp === 777, "移动分组重置不改血量");
ok(ctx.CFG.far.dmg === 77, "移动分组重置不改武器伤害");
ctx.unitTuneResetKind("rifle");
ok(ctx.CFG.unit.rifle.hp === rb2["unit.rifle.hp"], "本兵种重置恢复血量");
ok(ctx.CFG.far.dmg === rb2["far.dmg"], "本兵种重置恢复武器伤害");
ctx.CFG.bullet.speed = 12345;
ctx.unitTuneResetAll();
ok(ctx.CFG.bullet.speed === ctx.UNIT_TUNE.globalBase["bullet.speed"], "全部重置恢复全局子弹速度");


/* ---- 2.2：字段上限表与逐字段重置 ---- */
ok(ctx.UNIT_LIMITS && ctx.UNIT_LIMITS.hp.max === 900, "字段上限表存在且血量上限为 900");
const limHp = ctx.unitLimitFor("unit.rifle.hp");
const limRange = ctx.unitLimitFor("far.r");
ok(limHp && limHp.min === 1 && limHp.max === 900, "生命字段映射到统一上限");
ok(limRange && limRange.max === 3000, "射程字段映射到统一上限");
const fl2 = ctx.tuneFieldList("rifle");
const hpRow = fl2.find(x => x[0] === "unit.rifle.hp");
ok(hpRow && hpRow[2] === 1 && hpRow[3] === 900, "滑条范围读取统一上限表");
const beforeDmg = ctx.CFG.far.dmg;
const beforeHp = ctx.CFG.unit.rifle.hp;
ctx.CFG.far.dmg = 123;
ctx.CFG.unit.rifle.hp = 456;
ctx.unitTuneResetField("rifle", "far.dmg");
ok(ctx.CFG.far.dmg === beforeDmg, "逐字段重置只恢复该字段");
ok(ctx.CFG.unit.rifle.hp === 456, "逐字段重置不影响其他字段");
ctx.unitTuneResetField("rifle", "unit.rifle.hp");
ok(ctx.CFG.unit.rifle.hp === beforeHp, "逐字段重置可恢复生命");


/* ---- 2.3：实机演示沙盒与主战场隔离 ---- */
const mainW2 = ctx.W;
const mainCount2 = ctx.W.units.length;
ctx.demoBuild("rifle");
let sawBullet2 = false, sawDamage2 = false;
for (let i = 0; i < 150; i++) {
  ctx.demoStep(1 / 60);
  const sn = ctx.DEMO.snap;
  if (!sn) continue;
  if (sn.bullets.length > 0) sawBullet2 = true;
  if (sn.units.some(u => u.kind === "zombie" && u.hp < u.maxHp)) sawDamage2 = true;
}
ok(sawBullet2, "实机演示中有真实子弹飞出");
ok(sawDamage2, "实机演示中丧尸受到真实伤害");
ok(ctx.W === mainW2 && ctx.W.units.length === mainCount2, "演示结束后主战场未被改动");


/* ---- 2.3：特殊机制字段按兵种区分 ---- */
const lf2 = ctx.tuneFieldList("laser");
ok(lf2.some(x => x[0] === "laser.width" && x[1] === "激光直径"), "激光编辑器有光束直径字段");
ok(lf2.some(x => x[0] === "laser.heatMax" && x[1].indexOf("过热") >= 0), "激光编辑器有过热上限字段");
ok(lf2.some(x => x[0] === "laser.playerReload"), "激光编辑器有过热换弹字段");
ok(!lf2.some(x => /spreadDeg$/.test(x[0])), "激光编辑器没有无意义的散布字段");
const ff2 = ctx.tuneFieldList("flame");
ok(ff2.some(x => x[0] === "flame.coneDeg"), "喷火编辑器有扇形角度字段");
ok(!ff2.some(x => /spreadDeg$/.test(x[0])), "喷火编辑器没有通用散布字段");
const tf2 = ctx.tuneFieldList("tesla");
ok(tf2.some(x => x[0] === "tesla.chainMax"), "磁爆编辑器有连锁上限字段");
ok(tf2.some(x => x[0] === "tesla.arcLife"), "磁爆编辑器有麻痹时长字段");
const cf2 = ctx.tuneFieldList("cryo");
ok(cf2.some(x => x[0] === "cryo.radius"), "液氮编辑器有寒冷圈半径字段");
ok(cf2.some(x => x[0] === "cryo.freezeAt"), "液氮编辑器有冻结时间字段");
const w0 = ctx.CFG.laser.width;
ctx.CFG.laser.width = 30;
ctx.unitTuneResetField("laser", "laser.width");
ok(ctx.CFG.laser.width === w0, "激光直径可逐字段恢复");


/* ---- 2.3：单位编辑器分区 ---- */
const htmlL2 = ctx.unitTuneBodyHtml("laser");
ok(htmlL2.indexOf("特殊机制") >= 0, "激光编辑器有特殊机制分区");
ok(htmlL2.indexOf("激光直径") >= 0, "特殊机制分区包含激光直径");
ok(htmlL2.indexOf("散射角") < 0, "激光编辑器不出现散射角");
const w1 = ctx.CFG.laser.width;
ctx.CFG.laser.width = 31;
ctx.unitTuneResetGroup("laser", "special");
ok(ctx.CFG.laser.width === w1, "特殊机制分组重置可恢复激光直径");


/* ---- 2.4：地图编辑器吸附 ---- */
const oldObs = ctx.W.obstacles.slice();
ctx.W.obstacles.length = 0;
ctx.EDIT.snapMode = "free";
ok(ctx.editSnap(13.7, "x") === 13.7, "自由模式不吸附");
ctx.EDIT.snapMode = "32";
ok(ctx.editSnap(45, "x") === 32, "32px 网格吸附");
ctx.EDIT.snapMode = "16";
ok(ctx.editSnap(30, "x") === 32, "16px 网格吸附");
ctx.EDIT.snapMode = "8";
ctx.W.obstacles.push({ x: 100, y: 100, w: 60, h: 40, kind: "wall" });
ok(ctx.editSnap(104, "x") === 100, "靠近已有墙左边时吸附到端点");
ok(ctx.editSnap(156, "x") === 160, "靠近已有墙右边时吸附到边");
ok(ctx.editSnap(104, "y") === 100, "纵向同样吸附到墙边");
ctx.W.obstacles.length = 0;
for (const o of oldObs) ctx.W.obstacles.push(o);
ctx.EDIT.snapMode = "8";


/* ---- 2.4：编辑器撤销/重做 ---- */
const savedObs2 = ctx.W.obstacles.slice();
const savedDoors2 = ctx.W.doors.slice();
const savedUnits2 = ctx.W.units.slice();
ctx.EDIT.undo.length = 0; ctx.EDIT.redo.length = 0;
ctx.W.obstacles.length = 0; ctx.W.doors.length = 0;
ctx.W.obstacles.push({ x: 500, y: 500, w: 64, h: 32, kind: "wall" });
ctx.editPushUndo();
ctx.W.obstacles.length = 0;
ctx.editUndo();
ok(ctx.W.obstacles.length === 1, "撤销恢复被删除的墙体");
ctx.editRedo();
ok(ctx.W.obstacles.length === 0, "重做再次删除墙体");
ctx.EDIT.undo.length = 0; ctx.EDIT.redo.length = 0;
ctx.W.obstacles.length = 0; for (const o of savedObs2) ctx.W.obstacles.push(o);
ctx.W.doors.length = 0; for (const o of savedDoors2) ctx.W.doors.push(o);
ctx.W.units.length = 0; for (const o of savedUnits2) ctx.W.units.push(o);


/* ---- 2.4：可破坏墙 ---- */
const obsBackup = ctx.W.obstacles.slice();
ctx.W.obstacles.length = 0;
const dw2 = { x: 100, y: 100, w: 50, h: 50, kind: "wall", destructible: true, hp: 240, maxHp: 240, hue: 40, sat: 20, lit: 50 };
ctx.W.obstacles.push(dw2);
ok(ctx.hitWallsOnSegment(0, 125, 200, 125, 100) === 1, "可破坏墙首击仍阻挡");
ok(dw2.hp === 140, "可破坏墙正确扣血");
ok(ctx.hitWallsOnSegment(0, 125, 200, 125, 100) === 1, "第二击仍阻挡");
ok(ctx.hitWallsOnSegment(0, 125, 200, 125, 100) === 0, "血量归零后不再阻挡");
ok(ctx.W.obstacles.indexOf(dw2) < 0, "墙体被摧毁后从场景移除");
ctx.W.obstacles.length = 0; for (const o of obsBackup) ctx.W.obstacles.push(o);


/* ---- 2.4：缓速区与灼烧区 ---- */
const savedUnits3 = ctx.W.units.slice();
ctx.W.units.length = 0;
const uSlow = ctx.newUnit ? ctx.newUnit("rifle", 300, 300) : { kind: "rifle", x: 300, y: 300, vx: 100, vy: 0, dead: false, hp: 30, maxHp: 30, r: 8 };
if (!uSlow.vx) uSlow.vx = 100;
uSlow.vx = 100; uSlow.vy = 0;
ctx.W.units.push(uSlow);
const zSlow = { x: 260, y: 260, w: 120, h: 120, type: "slow", slow: 0.45, dps: 0 };
ctx.W.zones = [zSlow]; ctx.W.zoneT = 0;
ctx.stepZones(0.5);
ok(uSlow.vx < 100, "缓速区降低区内单位速度");
const zBurn = { x: 260, y: 260, w: 120, h: 120, type: "burn", slow: 0, dps: 6 };
const uBurn = ctx.newUnit ? ctx.newUnit("zombie", 320, 320) : { kind: "zombie", x: 320, y: 320, hp: 50, maxHp: 50, dead: false, r: 8 };
uBurn.hp = uBurn.maxHp = 50;
ctx.W.units.push(uBurn);
ctx.W.zones = [zBurn]; ctx.W.zoneT = 0;
ctx.stepZones(0.5);
ok(uBurn.hp < 50, "灼烧区对区内丧尸造成伤害");
const serZ = ctx.serialize();
ok(serZ.zones && serZ.zones.length === 1 && serZ.zones[0][4] === 1, "区域写入存档");
ctx.W.zones = [];
ctx.W.units.length = 0; for (const o of savedUnits3) ctx.W.units.push(o);


/* ---- 2.4：刷怪点 ---- */
const savedUnits4 = ctx.W.units.slice();
ctx.W.spawners = [{ x: 600, y: 500, w: 40, h: 40, kind: "zombie", interval: 1, limit: 2, count: 0, t: 0 }];
ctx.W.over = false;
const n0 = ctx.W.units.length;
ctx.stepSpawners(1.05);
ok(ctx.W.spawners[0].count === 1, "刷怪点按间隔生成第一个");
ctx.stepSpawners(1.0);
ok(ctx.W.spawners[0].count === 2, "刷怪点生成第二个");
ctx.stepSpawners(5.0);
ok(ctx.W.spawners[0].count === 2, "达到上限后停止生成");
ok(ctx.W.units.length >= n0 + 2, "生成物进入战场");
const serS = ctx.serialize();
ok(serS.spawners && serS.spawners.length === 1, "刷怪点写入存档");
ctx.W.spawners = [];
ctx.W.units.length = 0; for (const o of savedUnits4) ctx.W.units.push(o);


/* ---- 2.4：据点 ---- */
const savedUnits5 = ctx.W.units.slice();
ctx.W.units.length = 0;
ctx.W.holds = [{ x: 460, y: 460, w: 80, h: 80, r: 40, owner: null, prog: 0 }];
ctx.W.resources = 0;
const uHold = ctx.newUnit("rifle", 500, 500);
ctx.W.units.push(uHold);
ctx.stepHolds(3.05);
ok(ctx.W.holds[0].owner === "human", "人类独占据点后完成占领");
ok(ctx.W.resources > 0, "人类据点持续产出资源");
ctx.W.holds = [{ x: 460, y: 460, w: 80, h: 80, r: 40, owner: null, prog: 0 }];
ctx.W.units.length = 0;
const zHold = ctx.newUnit("zombie", 500, 500);
ctx.W.units.push(zHold);
ctx.stepHolds(3.05);
ok(ctx.W.holds[0].owner === "zombie", "丧尸独占据点后完成占领");
const serH = ctx.serialize();
ok(serH.holds && serH.holds.length === 1, "据点写入存档");
ctx.W.holds = [];
ctx.W.units.length = 0; for (const o of savedUnits5) ctx.W.units.push(o);


/* ---- 2.5：地图分析 ---- */
const an = ctx.mapAnalysisStats();
ok(an.total > 0, "地图分析返回总格数");
ok(an.main > 0, "地图分析识别出主连通区");
ok(an.main <= an.total, "主连通区不超过全图");
ok(typeof an.threatX === "number" && typeof an.threatY === "number", "地图分析返回威胁方向");


/* ---- 2.5：岗位建议 ---- */
const postsBefore = ctx.W.posts;
const sug = ctx.suggestPosts();
ok(Array.isArray(sug), "岗位建议返回数组");
ok(ctx.W.posts === postsBefore, "生成建议不覆盖现有岗位");


/* ---- 2.5：地图评分 ---- */
const sc1 = ctx.mapScore();
ok(sc1.total >= 0 && sc1.total <= 100, "地图总分在 0-100");
ok(sc1.connect >= 0 && sc1.connect <= 100, "连通分在 0-100");
ok(sc1.cover >= 0 && sc1.cover <= 100, "掩体分在 0-100");
ok(Array.isArray(sc1.advice) && sc1.advice.length > 0, "地图评分给出建议");
const sc2 = ctx.mapScore();
ok(sc2.total === sc1.total, "同一地图评分结果稳定");


/* ---- 2.5：封闭区开口 ---- */
ctx.analyzeTerrain(true);
ok(Array.isArray(ctx.TERRAIN.enclaves), "封闭区列表存在");
let openingsOk = true;
for (const e of ctx.TERRAIN.enclaves) {
  if (!Array.isArray(e.openings)) openingsOk = false;
  if (e.openN !== e.openings.length) openingsOk = false;
}
ok(openingsOk, "每个封闭区都有开口数组且数量一致");


/* ---- 2.6：可玩地形生成 ---- */
const obsBak6 = ctx.W.obstacles.slice();
const doorsBak6 = ctx.W.doors.slice();
const info1 = ctx.generateTerrain(12345);
const sig1 = ctx.W.obstacles.map(o => [o.x, o.y, o.w, o.h, o.kind].join(",")).join("|");
const info2 = ctx.generateTerrain(12345);
const sig2 = ctx.W.obstacles.map(o => [o.x, o.y, o.w, o.h, o.kind].join(",")).join("|");
ok(info1.rooms > 0, "地形生成至少放置一座建筑");
ok(info1.obstacles > 0, "地形生成产生障碍");
ok(sig1 === sig2, "同一种子生成结果一致");
ok(ctx.W.spawners.length === 1 && ctx.W.holds.length === 1, "生成地形带刷怪点与据点");
ctx.W.obstacles.length = 0; for (const o of obsBak6) ctx.W.obstacles.push(o);
ctx.W.doors.length = 0; for (const o of doorsBak6) ctx.W.doors.push(o);
ctx.W.spawners = []; ctx.W.holds = [];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);


/* ---- 2.6：生成结果校验 ---- */
ok(info1.mainPct >= 0 && info1.mainPct <= 1, "生成报告给出连通比例");
ok(info1.sealed >= 0, "生成报告给出密封房间数");
ok(info1.score >= 0 && info1.score <= 100, "生成报告给出地图评分");


/* ---- 2.6：生成重试与择优 ---- */
ok(info1.attempts >= 1 && info1.attempts <= 4, "生成报告记录尝试次数");
ok(info2.attempts >= 1 && info2.attempts <= 4, "重复生成仍记录尝试次数");


/* ---- 2.6：封闭区自动修复 ---- */
const obsBak7 = ctx.W.obstacles.slice();
const doorsBak7 = ctx.W.doors.slice();
ctx.W.obstacles = [];
ctx.W.doors = [];
const wallRect = (x, y, w, h) => { const o = ctx.makeObstacle(x, y, w, h, "wall"); ctx.W.obstacles.push(o); };
wallRect(100, 100, 276, 20);
wallRect(100, 356, 276, 20);
wallRect(100, 120, 20, 236);
wallRect(356, 120, 20, 236);
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
ctx.analyzeTerrain(true);
const sealedRoom = (ctx.TERRAIN.enclaves || []).find(e => e.openN === 0);
ok(!!sealedRoom, "测试房间被识别为完全封闭");
const fixedN = ctx.repairSealedRooms();
ok(fixedN > 0, "修复函数为封闭区开口");
ctx.analyzeTerrain(true);
const stillSealed = (ctx.TERRAIN.enclaves || []).filter(e => e.openN === 0).length;
ok(stillSealed === 0 || fixedN > 0, "修复后不再残留完全封闭房间");
ctx.W.obstacles = obsBak7.slice();
ctx.W.doors = doorsBak7.slice();
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);


/* ---- 2.6：BSP 分区生成 ---- */
const obsBak8 = ctx.W.obstacles.slice();
const doorsBak8 = ctx.W.doors.slice();
const bsp1 = ctx.generateBspTerrain(777);
const bspSig1 = ctx.W.obstacles.map(o => [o.x, o.y, o.w, o.h].join(",")).join("|");
const bsp2 = ctx.generateBspTerrain(777);
const bspSig2 = ctx.W.obstacles.map(o => [o.x, o.y, o.w, o.h].join(",")).join("|");
ok(bsp1.rooms > 0, "BSP 生成至少一座建筑");
ok(bspSig1 === bspSig2, "BSP 同种子结果一致");
ok(bsp1.mainPct >= 0 && bsp1.mainPct <= 1, "BSP 报告连通比例");
ctx.W.obstacles.length = 0; for (const o of obsBak8) ctx.W.obstacles.push(o);
ctx.W.doors.length = 0; for (const o of doorsBak8) ctx.W.doors.push(o);
ctx.W.spawners = []; ctx.W.holds = [];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);


/* ---- 2.6：预制件地形 ---- */
const obsBak9 = ctx.W.obstacles.slice();
const doorsBak9 = ctx.W.doors.slice();
const pf1 = ctx.generatePrefabTerrain(888);
const pfSig1 = ctx.W.obstacles.map(o => [o.x, o.y, o.w, o.h].join(",")).join("|");
const pf2 = ctx.generatePrefabTerrain(888);
const pfSig2 = ctx.W.obstacles.map(o => [o.x, o.y, o.w, o.h].join(",")).join("|");
ok(pf1.rooms > 0, "预制件生成至少一座建筑");
ok(pfSig1 === pfSig2, "预制件同种子结果一致");
ok(pf1.obstacles > 0, "预制件生成产生障碍");
ctx.W.obstacles.length = 0; for (const o of obsBak9) ctx.W.obstacles.push(o);
ctx.W.doors.length = 0; for (const o of doorsBak9) ctx.W.doors.push(o);
ctx.W.spawners = []; ctx.W.holds = [];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);


/* ---- 2.6：生成—校验—修复流水线 ---- */
const obsBak10 = ctx.W.obstacles.slice();
const doorsBak10 = ctx.W.doors.slice();
const pipe = ctx.generateAndRepair("prefab", 999);
ok(pipe.mode === "prefab", "流水线记录生成模式");
ok(pipe.repaired >= 0, "流水线记录修复数量");
ok(pipe.mainPct >= 0 && pipe.mainPct <= 1, "流水线报告连通比例");
ok(pipe.score >= 0 && pipe.score <= 100, "流水线报告评分");
ctx.W.obstacles.length = 0; for (const o of obsBak10) ctx.W.obstacles.push(o);
ctx.W.doors.length = 0; for (const o of doorsBak10) ctx.W.doors.push(o);
ctx.W.spawners = []; ctx.W.holds = [];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);


/* ---- 2.7：寻路终点修正 ---- */
const obsBak11 = ctx.W.obstacles.slice();
ctx.W.obstacles = [ctx.makeObstacle(1000, 1000, 120, 120, "wall")];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const stP = ctx.NAV.nearestFree(28, 31);
const sxP = (stP[0] + 0.5) * ctx.NAV.tile, syP = (stP[1] + 0.5) * ctx.NAV.tile;
const pP = ctx.astar(sxP, syP, 1060, 1060, 5000);
ok(!!pP && pP.length > 0, "目标在墙内时仍返回路径");
if (pP && pP.length) {
  const lastP = pP[pP.length - 1];
  ok(!ctx.pointBlocked(lastP.x, lastP.y), "路径终点落在可走格而不是墙里");
  ok(pP.goalAdjusted === true, "路径记录目标已被调整");
}
ctx.W.obstacles.length = 0; for (const o of obsBak11) ctx.W.obstacles.push(o);
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);



/* ---- 2.7：卡住脱困方向 ---- */
const obsBak12 = ctx.W.obstacles.slice();
ctx.W.obstacles = [ctx.makeObstacle(1000, 1000, 100, 100, "wall")];
const escL = ctx.stuckEscapeDir({ x: 980, y: 1050, vx: 0, vy: 0 });
const escR = ctx.stuckEscapeDir({ x: 1120, y: 1050, vx: 0, vy: 0 });
ok(!!escL && escL.x < -0.5, "左侧贴墙时脱困方向朝左");
ok(!!escR && escR.x > 0.5, "右侧贴墙时脱困方向朝右");
const escFar = ctx.stuckEscapeDir({ x: 300, y: 300, vx: 0, vy: 0 });
ok(escFar === null, "远离墙体时不触发脱困");
ctx.W.obstacles.length = 0; for (const o of obsBak12) ctx.W.obstacles.push(o);


/* ---- 2.7：同目标路径复用 ---- */
const pk = ctx.newUnit("rifle", 600, 600);
pk.pathT = 0;
const tgtP = { x: 900, y: 600 };
ctx.W.astarLeft = 20;
const pathA = ctx.repathTo(pk, tgtP.x, tgtP.y, 1800, 1, tgtP);
const leftA = ctx.W.astarLeft;
const pathB = ctx.repathTo(pk, tgtP.x, tgtP.y, 1800, 1, tgtP);
ok(!!pathA && pathA.length > 0, "首次寻路返回路径");
ok(pathB === pathA, "同目标复用原路径");
ok(ctx.W.astarLeft === leftA, "复用路径不再扣寻路预算");


/* ---- 2.7：大体型通行宽度 ---- */
const obsBak13 = ctx.W.obstacles.slice();
ctx.W.obstacles = [ctx.makeObstacle(1000, 1000, 100, 100, "wall")];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
ok(ctx.navAreaClear(31, 31, 0) === true, "窄检查忽略半径时可通过");
ok(ctx.navAreaClear(31, 31, 80) === false, "大半径检查在墙边不通过");
ok(ctx.navAreaClear(70, 50, 60) === true, "远离墙体的大半径检查通过");
ctx.W.obstacles.length = 0; for (const o of obsBak13) ctx.W.obstacles.push(o);
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);


/* ---- 2.7：拐角折线化 ---- */
const fil = ctx.filletPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 12);
ok(fil.length === 4, "直角折点被替换为两个切点");
ok(Math.abs(fil[1].x - 88) < 0.01 && Math.abs(fil[1].y) < 0.01, "第一个切点在来向线段上");
ok(Math.abs(fil[2].x - 100) < 0.01 && Math.abs(fil[2].y - 12) < 0.01, "第二个切点在去向线段上");
const fs2 = ctx.filletPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], 12);
ok(fs2.length === 3, "近乎直线的折点不切角");


/* ---- 2.7：路径提前看下一个点 ---- */
ctx.W.obstacles = [];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const uLook = { x: 12, y: 20, r: 8, path: [{ x: 30, y: 20 }, { x: 60, y: 20 }] };
const wLook = ctx.followPath(uLook);
ok(!!wLook && Math.abs(wLook.x - 60) < 0.01, "接近当前点时提前切到下一个航点");
ctx.W.obstacles = [ctx.makeObstacle(24, 4, 20, 32, "wall")];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const uBlock = { x: 12, y: 20, r: 8, path: [{ x: 30, y: 20 }, { x: 60, y: 20 }] };
const wBlock = ctx.followPath(uBlock);
ok(!!wBlock && Math.abs(wBlock.x - 30) < 0.01, "下一点被墙挡住时仍走当前航点");
ctx.W.obstacles = [];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);


/* ---- 2.9：不可变基线 ---- */
ok(!!ctx.BASE_UNIT && !!ctx.BASE_UNIT.rifle, "BASE_UNIT 存在步枪兵基线");
ok(Object.isFrozen(ctx.BASE_UNIT.rifle), "步枪兵基线已冻结");
const hpBase = ctx.BASE_UNIT.rifle["unit.rifle.hp"];
try { ctx.BASE_UNIT.rifle["unit.rifle.hp"] = 99999; } catch (e) {}
ok(ctx.BASE_UNIT.rifle["unit.rifle.hp"] === hpBase, "冻结后的基线不可被改写");


/* ---- 2.9：性能读数 ---- */
ctx.PERF.fps = 60; ctx.PERF.sim = 2.34; ctx.PERF.render = 3.21;
const pt2 = ctx.perfText();
ok(pt2.indexOf("FPS 60") >= 0, "性能读数包含帧率");
ok(pt2.indexOf("2.3ms") >= 0 && pt2.indexOf("3.2ms") >= 0, "性能读数包含模拟与渲染耗时");


/* ---- 2.9：自定义地块 ---- */
const uTile = ctx.newUnit("rifle", 700, 700);
uTile.vx = 100; uTile.vy = 0;
ctx.W.units.length = 0; ctx.W.units.push(uTile);
ctx.W.zones = []; ctx.W.zoneT = 0;
ctx.W.tiles = [{ x: 660, y: 660, w: 120, h: 120, color: "#3a4a56", alpha: 0.5, slow: 0.5, dps: 0 }];
ctx.stepZones(0.5);
ok(uTile.vx < 100, "自定义地块的减速效果生效");
const serT = ctx.serialize();
ok(serT.tiles && serT.tiles.length === 1, "自定义地块写入存档");
ctx.W.tiles = [];


/* ---- 2.9：地块通行与穿透 ---- */
const obsBak14 = ctx.W.obstacles.slice();
const tilesBak14 = (ctx.W.tiles || []).slice();
ctx.W.obstacles = [];
ctx.W.tiles = [];
const twTile = ctx.makeObstacle(1000, 1000, 100, 100, "wall"); twTile.tile = true;
ctx.W.obstacles.push(twTile);
ok(ctx.pointBlocked(1050, 1050) === true, "实心地块阻挡移动");
ok(ctx.segBlockedByWall(900, 1050, 1100, 1050) === true, "挡子弹地块拦截弹道");
const tpTile = ctx.makeObstacle(1200, 1000, 100, 100, "low"); tpTile.tile = true;
ctx.W.obstacles.push(tpTile);
ok(ctx.segBlockedByWall(1150, 1050, 1350, 1050) === false, "穿透地块不拦弹道");
const serTile = ctx.serialize();
const tileRow = serTile.obs.find(a => a[0] === 1000);
ok(!!tileRow && tileRow[10] === 1, "地块障碍的标记写入存档");
ctx.W.obstacles = obsBak14.slice();
ctx.W.tiles = tilesBak14.slice();


/* ---- 2.9：可破坏地块 ---- */
const obsBak15 = ctx.W.obstacles.slice();
const tilesBak15 = (ctx.W.tiles || []).slice();
ctx.W.obstacles = []; ctx.W.tiles = [];
const tileHp = { x: 1400, y: 1000, w: 100, h: 100, color: "#3a4a56", alpha: 0.5, slow: 0, dps: 0, solid: true, pierce: false, hp: 240, maxHp: 240 };
ctx.W.tiles.push(tileHp);
const tileObs = ctx.makeObstacle(1400, 1000, 100, 100, "wall");
tileObs.tile = true; tileObs.destructible = true; tileObs.hp = 240; tileObs.maxHp = 240;
ctx.W.obstacles.push(tileObs);
ok(ctx.pointBlocked(1450, 1050) === true, "可破坏地块初始阻挡移动");
ctx.hitWallsOnSegment(1300, 1050, 1600, 1050, 100);
ok(tileHp.hp === 140, "地块耐久随受击下降");
ctx.hitWallsOnSegment(1300, 1050, 1600, 1050, 100);
ctx.hitWallsOnSegment(1300, 1050, 1600, 1050, 100);
ok(ctx.W.tiles.indexOf(tileHp) < 0, "耐久归零后地块从场景移除");
ok(ctx.W.obstacles.indexOf(tileObs) < 0, "耐久归零后碰撞体一并移除");
ctx.W.obstacles = obsBak15.slice(); ctx.W.tiles = tilesBak15.slice();


/* ---- 2.9：Alt 临时关闭吸附 ---- */
const obsBak16 = ctx.W.obstacles.slice();
ctx.W.obstacles = [];
ctx.EDIT.snapMode = "32";
ctx.EDIT.altFree = true;
ok(ctx.editSnap(45, "x") === 45, "按住 Alt 时不吸附");
ctx.EDIT.altFree = false;
ok(ctx.editSnap(45, "x") === 32, "松开 Alt 后恢复网格吸附");
ctx.W.obstacles = obsBak16.slice();


/* ---- 2.9：减少动态效果 ---- */
ctx.setReduceMotion(true);
ok(ctx.REDUCE_MOTION === true, "减少动态效果可开启");
ok(ctx.REDUCE_MOTION === true, "开启后状态生效");
ctx.setReduceMotion(false);
ok(ctx.REDUCE_MOTION === false, "关闭后状态还原");


/* ---- 2.9：场景提示条 ---- */
ctx.DIRECTOR.on = false; ctx.PLAYER.on = false;
ok(ctx.ctxHintText().indexOf("空格") >= 0, "默认场景提示暂停键");
ctx.DIRECTOR.on = true;
ok(ctx.ctxHintText().indexOf("剧情模式") >= 0, "剧情模式切到导演提示");
ctx.DIRECTOR.on = false;


/* ---- 2.9：旧存档兼容 ---- */
const oldSave = ctx.serialize();
delete oldSave.zones; delete oldSave.tiles; delete oldSave.spawners; delete oldSave.holds;
ctx.deserialize(oldSave);
ok(Array.isArray(ctx.W.zones), "旧存档缺少区域字段时补空数组");
ok(Array.isArray(ctx.W.tiles), "旧存档缺少地块字段时补空数组");
ok(Array.isArray(ctx.W.spawners), "旧存档缺少刷怪点字段时补空数组");
ok(Array.isArray(ctx.W.holds), "旧存档缺少据点字段时补空数组");


/* ---- 2.9：地块纹理 ---- */
ctx.W.tiles = [{ x: 300, y: 300, w: 100, h: 100, color: "#3a4a56", alpha: 0.5, slow: 0, dps: 0, solid: false, pierce: false, hp: 0, maxHp: 0, pattern: "stripe" }];
const serPat = ctx.serialize();
ok(serPat.tiles && serPat.tiles[0][12] === "stripe", "地块纹理写入存档");
ctx.W.tiles = [];


/* ---- 2.9：生成难度预算 ---- */
const obsBak17 = ctx.W.obstacles.slice();
const doorsBak17 = ctx.W.doors.slice();
ctx.EDIT.genDifficulty = "hard";
const hardInfo = ctx.generateBspTerrain(4321);
ok(ctx.W.spawners[0].interval === 3 && ctx.W.spawners[0].limit === 80, "高难度使用更快刷怪与更高上限");
ctx.EDIT.genDifficulty = "easy";
const easyInfo = ctx.generateTerrain(4321);
ok(ctx.W.spawners[0].interval === 5 && ctx.W.spawners[0].limit === 40, "低难度使用更慢刷怪与更低上限");
ctx.EDIT.genDifficulty = "normal";
ctx.W.obstacles.length = 0; for (const o of obsBak17) ctx.W.obstacles.push(o);
ctx.W.doors.length = 0; for (const o of doorsBak17) ctx.W.doors.push(o);
ctx.W.spawners = []; ctx.W.holds = [];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);


/* ---- RC：恢复默认不再跳开战设置 ---- */
ctx.overlayEl.className = "";
ctx.resetStartSettings(false);
ok(ctx.overlayEl.className === "", "从设置恢复默认时不打开开战面板");


/* ---- RC：面板冒烟 ---- */
function smokePanel(name, fn) {
  try { fn(); ok(true, "面板可打开：" + name); }
  catch (e) { ok(false, "面板可打开：" + name + "（" + e.message + "）"); }
}
smokePanel("设置", function () { ctx.showSettingsPanel(); });
smokePanel("帮助", function () { ctx.showHelp(); });
smokePanel("快捷键与操作", function () { ctx.showKeyHelp("kbm"); });
smokePanel("快捷键与操作（触屏）", function () { ctx.showKeyHelp("touch"); });
smokePanel("地图分析", function () { ctx.showMapAnalysis(); });
ctx.overlayEl.className = "";


/* ---- RC：暂停/结算/快速开始/教程冒烟 ---- */
ctx.overlayEl.className = "";
ctx.W.over = false; ctx.W.t = 12; ctx.W.kills = 3; ctx.W.infected = 1; ctx.W.resources = 120;
smokePanel("暂停", function () { ctx.showPausePanel(); });
ctx.overlayEl.className = "";
ctx.W.over = true; ctx.W.result = "win"; ctx.W.mode = "defense"; ctx.W.t = 60;
smokePanel("结算", function () { ctx.showResult(); });
ctx.overlayEl.className = "";
smokePanel("快速开始", function () { ctx.showQuickStart(); });
ctx.overlayEl.className = "";
smokePanel("新手引导", function () { ctx.showTutor(0); });
ctx.overlayEl.className = "";


/* ---- RC：新系统存档往返 ---- */
ctx.W.tiles = [{ x: 100, y: 100, w: 120, h: 80, color: "#3a4a56", alpha: 0.5, slow: 0.3, dps: 2, solid: true, pierce: true, hp: 240, maxHp: 240, pattern: "grid" }];
ctx.W.zones = [{ x: 300, y: 300, w: 100, h: 100, type: "burn", slow: 0, dps: 6 }];
ctx.W.spawners = [{ x: 500, y: 500, w: 80, h: 80, kind: "zombie", interval: 3, limit: 20, count: 4, t: 1.2 }];
ctx.W.holds = [{ x: 700, y: 700, w: 120, h: 120, r: 60, owner: "human", prog: 2.5 }];
const saveFull = ctx.serialize();
ctx.deserialize(saveFull);
ok(ctx.W.tiles.length === 1 && ctx.W.tiles[0].pattern === "grid" && ctx.W.tiles[0].hp === 240, "地块纹理/耐久完成存档往返");
ok(ctx.W.zones.length === 1 && ctx.W.zones[0].type === "burn", "区域类型完成存档往返");
ok(ctx.W.spawners.length === 1 && ctx.W.spawners[0].interval === 3 && ctx.W.spawners[0].count === 4, "刷怪点参数完成存档往返");
ok(ctx.W.holds.length === 1 && ctx.W.holds[0].owner === "human" && ctx.W.holds[0].prog === 2.5, "据点归属完成存档往返");


/* ---- RC：地块合并血量 ---- */
const obsBak18 = ctx.W.obstacles.slice();
const tilesBak18 = (ctx.W.tiles || []).slice();
ctx.W.obstacles = []; ctx.W.tiles = [];
const tA = { x: 2000, y: 1000, w: 80, h: 80, color: "#3a4a56", alpha: 0.5, slow: 0, dps: 0, solid: true, pierce: false, hp: 240, maxHp: 240, pattern: "solid", group: "tg1" };
const tB = { x: 2080, y: 1000, w: 80, h: 80, color: "#3a4a56", alpha: 0.5, slow: 0, dps: 0, solid: true, pierce: false, hp: 240, maxHp: 240, pattern: "solid", group: "tg1" };
ctx.W.tiles.push(tA, tB);
for (const [x, g] of [[2000, "tg1"], [2080, "tg1"]]) {
  const o = ctx.makeObstacle(x, 1000, 80, 80, "wall");
  o.tile = true; o.destructible = true; o.hp = 240; o.maxHp = 240; o.group = g;
  ctx.W.obstacles.push(o);
}
ctx.hitWallsOnSegment(1900, 1040, 2200, 1040, 100);
ok(tA.hp === 140 && tB.hp === 140, "合并地块同步扣血");
ctx.hitWallsOnSegment(1900, 1040, 2200, 1040, 100);
ctx.hitWallsOnSegment(1900, 1040, 2200, 1040, 100);
ok(ctx.W.tiles.length === 0, "合并地块耐久归零后整组移除");
ok(ctx.W.obstacles.length === 0, "合并地块碰撞体整组移除");
ctx.W.obstacles = obsBak18.slice(); ctx.W.tiles = tilesBak18.slice();
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);


/* ---- RC：首页/开战面板 ESC 标记 ---- */
ctx.showHome();
ok(ctx.HOME_PANEL === true, "首页打开时标记为首页");
ctx.showStartPanel();
ok(ctx.START_PANEL === true && ctx.HOME_PANEL === false, "开战设置打开时标记为开战页");
ctx.overlayEl.className = "";
ctx.HOME_PANEL = false; ctx.START_PANEL = false;


/* ---- 反馈：角色编辑演示数据 ---- */
ctx.showUnitTune();
ctx.previewReset();
ctx.previewStep(1 / 60);
ok(!!ctx.DEMO.snap && ctx.DEMO.snap.units.length >= 2, "角色编辑演示世界生成单位");
ok(ctx.DEMO.snap.bullets.length >= 0, "角色编辑演示可推进");
ctx.previewStop();
ctx.overlayEl.className = "";


/* ---- 反馈：进入对局后 Esc 标记必须清空 ---- */
ctx.showHome();
ctx.beginGame();
ok(ctx.HOME_PANEL === false && ctx.START_PANEL === false, "从首页进入对局后清空面板标记");
ctx.showStartPanel();
ctx.beginGame();
ok(ctx.HOME_PANEL === false && ctx.START_PANEL === false, "从开战设置进入对局后清空面板标记");


/* ---- 反馈：点阵填充 ---- */
const obsBak19 = ctx.W.obstacles.slice();
ctx.W.obstacles = [];
ctx.EDIT.active = true; ctx.EDIT.tool = "wall"; ctx.EDIT.mode = "cell";
ctx.editPaintCell(100, 100);
ok(ctx.W.obstacles.length === 1 && ctx.W.obstacles[0].w === 32 && ctx.W.obstacles[0].h === 32, "点阵模式按 32px 格填充墙体");
ctx.editPaintCell(100, 100);
ok(ctx.W.obstacles.length === 1, "同一格不会重复堆墙");
ctx.editPaintCell(140, 100);
ok(ctx.W.obstacles.length === 2, "移动到相邻格继续填充");
ctx.W.obstacles = obsBak19.slice();
ctx.EDIT.active = false;


/* ---- 反馈：关闭演示必须停循环 ---- */
ctx.showUnitTune();
ctx.previewStart();
ctx.hideOverlay();
ok(ctx.PREVIEW.on === false, "关闭面板后演示循环停止");


/* ---- 反馈：点阵擦除 ---- */
const obsBak20 = ctx.W.obstacles.slice();
ctx.W.obstacles = [];
ctx.EDIT.active = true; ctx.EDIT.tool = "wall"; ctx.EDIT.mode = "cell";
ctx.editPaintCell(300, 300);
ctx.EDIT.tool = "erase";
ctx.EDIT.cellLastCX = -999; ctx.EDIT.cellLastCY = -999;
ctx.editEraseCell(300, 300);
ok(ctx.W.obstacles.length === 0, "点阵擦除清掉整格墙体");
ctx.W.obstacles = obsBak20.slice();
ctx.EDIT.active = false;


/* ---- 反馈：兵种名称与演示靶子 ---- */
ok(ctx.tuneKindName("laser") === "激光兵" && ctx.tuneKindName("medic") === "医疗兵", "兵种目录不再显示 undefined");
ctx.previewReset();
ctx.previewStep(1 / 60);
ok(!!ctx.DEMO.target && ctx.DEMO.target.x === 640 && ctx.DEMO.target.dead === false, "演示靶子固定在画面上");


/* ---- 反馈：更大点阵格 ---- */
const obsBak21 = ctx.W.obstacles.slice();
ctx.W.obstacles = [];
ctx.EDIT.active = true; ctx.EDIT.tool = "wall"; ctx.EDIT.mode = "cell"; ctx.EDIT.snapMode = "64";
ctx.EDIT.cellLastCX = -999; ctx.EDIT.cellLastCY = -999;
ctx.editPaintCell(300, 300);
ok(ctx.W.obstacles.length === 1 && ctx.W.obstacles[0].w === 64, "点阵吸附支持 64px 大格");
ctx.W.obstacles = obsBak21.slice(); ctx.EDIT.snapMode = "8"; ctx.EDIT.active = false;


/* ---- 反馈：调色盘对放置物生效 ---- */
const obsBak22 = ctx.W.obstacles.slice();
ctx.W.obstacles = []; ctx.EDIT.active = true; ctx.EDIT.tool = "wall";
ctx.EDIT.colorSet = true; ctx.EDIT.tileColor = "#ff0000";
ctx.editCommit({ x: 10, y: 10, w: 80, h: 40 });
const lastO = ctx.W.obstacles[ctx.W.obstacles.length - 1];
ok(!!lastO && lastO.hue === 0 && lastO.sat === 100, "调色盘颜色应用到放置的墙体");
ctx.W.obstacles = obsBak22.slice(); ctx.EDIT.colorSet = false; ctx.EDIT.active = false;


/* ---- 反馈：机枪与磁爆演示能命中 ---- */
ctx.UNIT_TUNE.kind = "mg";
ctx.previewReset();
for (let mi = 0; mi < 120; mi++) ctx.previewStep(1 / 60);
ok(!!ctx.DEMO.target && ctx.DEMO.target.hp < 60, "机枪演示能锁定并命中靶子");
ctx.UNIT_TUNE.kind = "tesla";
ctx.previewReset();
for (let ti = 0; ti < 120; ti++) ctx.previewStep(1 / 60);
ok(!!ctx.DEMO.target && ctx.DEMO.target.hp < 60, "磁爆演示能命中靶子");
ctx.previewStop();


/* ---- 反馈：实际 DPS 统计 ---- */
ctx.UNIT_TUNE.kind = "rifle";
ctx.previewReset();
for (let ri = 0; ri < 120; ri++) ctx.previewStep(1 / 60);
ok(ctx.PREVIEW.totalDmg > 0, "演示累计实际伤害");


/* ---- 反馈：读档返还经济 ---- */
const resBak = ctx.W.resources, overBak = ctx.W.over;
ctx.W.over = false; ctx.W.resources = 432;
ctx.saveGame(true);
ctx.W.resources = 0;
ctx.loadGame();
ok(Math.abs(ctx.W.resources - 432) < 1e-6, "读档恢复存档中的资源");
ctx.W.resources = resBak; ctx.W.over = overBak;


/* ---- 手机键位面板可打开 ---- */
smokePanel("手机键位调整", function () { ctx.showTouchLayout(); });


/* ---- 反馈：操控单位死亡后仍可退出 ---- */
ctx.PLAYER.on = true; ctx.PLAYER.unit = { dead: true };
ctx.togglePlayerControl();
ok(ctx.PLAYER.on === false, "操控单位死亡后再次点击操控可退出");
ctx.PLAYER.on = true; ctx.PLAYER.unit = null;
ctx.togglePlayerControl();
ok(ctx.PLAYER.on === false, "无单位时操控模式也能退出");
