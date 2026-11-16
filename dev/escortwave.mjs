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
const MID = CFG.world.w / 2, TOL = 200;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function zs() { return W().units.filter(u => ctx.isZombie(u) && !u.dead); }
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }
/* 逐帧捕捉新生成的丧尸并记录它刚出现时的位置 ——
   否则等几秒再统计，它们已经朝人类跑过中线了，会把"刷在哪一半"判断错 */
function waveSpawned(sec) {
  const seen = new Set(zs().map(u => u.id));
  const out = [];
  for (let i = 0; i < Math.round(sec * 60); i++) {
    ctx.stepSim(1 / 60);
    for (const u of zs()) if (!seen.has(u.id)) { seen.add(u.id); out.push({ x: u.x, y: u.y, kind: u.kind, side: ctx.escortSpawnSide() }); }
  }
  return out;
}
function split(list) {
  let L = 0, R = 0, M = 0;
  for (const u of list) { if (u.x < MID - TOL) L++; else if (u.x > MID + TOL) R++; else M++; }
  return { L, R, M };
}
function moveHumansRight(frac) {
  for (const u of W().units) {
    if (!ctx.isHuman(u) || u.dead || u.penned) continue;
    u.x = frac > 0.5 ? (MID + 600 + (u.id % 300)) : (MID - 2000 + (u.id % 300));
    u.vx = 0; u.vy = 0;
  }
}

ctx.START.gameMode = "escort";
ctx.START.civCount = 8;
ctx.START.squad = { rifle: 5, mg: 1, sniper: 0, shield: 0 };
ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false; ctx.EDIT.units = null;
ctx.beginGame();
console.log("模式=" + W().mode + " 阶段=" + W().phase + " 初始丧尸=" + zs().length + "  大门=" + (W().prisonDoor ? "有" : "无") + "  doorOpen=" + W().doorOpen);

console.log("\n=== 一、小队刚生成时不刷波次 ===");
const n0 = zs().length;
const early = waveSpawned(12);
console.log("  12 秒内（" + (12 / CFG.escort.spawnInterval).toFixed(0) + " 个刷怪间隔）新增丧尸 " + early.length + " 只，仍处于 " + W().phase + " 阶段");
chk(early.length === 0, "开门之前一只波次丧尸都不刷（场上只有初始尸群 " + n0 + " 只）");
chk(!W().doorOpen, "此时大门尚未解锁");

console.log("\n=== 二、解锁大门 -> 撤离点半场（右）开始刷新 ===");
moveHumansRight(0.2);                       /* 把小队按在左半场 */
const door = W().prisonDoor;
const armed = W().units.find(u => ctx.isArmed(u) && !u.dead);
armed.x = door.x + door.w / 2; armed.y = door.y + door.h / 2;
tick(0.2);
chk(W().doorOpen === true, "武装单位接触大门后解锁（阶段 -> " + W().phase + "）");
/* 刷怪间隔已放宽到 2.6 秒（降难度）：等一个间隔再多一点，既能看到一波，
   又不至于让队伍走远、把"刷怪半场"的判定前提改掉 */
const wave1 = waveSpawned(CFG.escort.spawnInterval + 1.0);
const s1 = split(wave1);
console.log("  开门后 2.2 秒新增 " + wave1.length + " 只（按生成点计）：左半场 " + s1.L + " · 中线附近 " + s1.M + " · 右半场 " + s1.R);
chk(wave1.length > 0, "开门后波次开始刷新");
chk(s1.L === 0, "没有任何一只刷在队伍所在的左半场");

console.log("\n=== 三、小队回撤越过中线 -> 换到另一半场（左）刷新 ===");
/* 只有进入撤离阶段（平民全部救出），队伍才会真的越过中线往撤离点走；
   仍在 rescue 阶段时武装单位的目标是左边的监狱门，人会往回跑 */
W().phase = "retreat";
moveHumansRight(0.8);                       /* 把小队移到右半场 */
tick(0.2);
const side = ctx.escortSpawnSide();
let cx = 0, cn = 0;
for (const u of W().units) if (ctx.isHuman(u) && !u.dead && !u.penned) { cx += u.x; cn++; }
console.log("  队伍质心 x=" + (cx / cn).toFixed(0) + "（中线 " + MID + "），阶段=" + W().phase);
chk(side === -1, "队伍在右半场时，刷怪侧切换到左半场（escortSpawnSide=" + side + "）");
const wave2 = waveSpawned(3.5);
const s2 = split(wave2);
console.log("  越过中线后 3.5 秒新增 " + wave2.length + " 只（按生成点计）：左半场 " + s2.L + " · 中线附近 " + s2.M + " · 右半场 " + s2.R);
chk(wave2.length > 0, "换边之后继续刷新");
const stray = wave2.filter(u => u.x > MID + TOL);
console.log("    越界的那几只: " + JSON.stringify(stray.map(u => u.kind + "@" + Math.round(u.x) + "/side" + u.side)));
console.log("    初始尸群构成: " + JSON.stringify((() => { const m = {}; for (const u of ctx.W.units) if (ctx.isZombie(u)) m[u.kind] = (m[u.kind] || 0) + 1; return m; })()));
chk(s2.R === 0, "没有一只刷在队伍所在的右半场（撤离点半场已停止刷新）");
chk(s2.L > 0, "刷新量全部转到另一半场（左半场 " + s2.L + " 只）");

console.log("\n=== 四、第一个平民撤离 -> 波次强化 ===");
W().phase = "retreat";
const civ = W().units.find(u => u.kind === "civilian" && !u.dead && !u.penned);
civ.x = CFG.escort.evac.x; civ.y = CFG.escort.evac.y;
W().evacT = 0;
tick(0.5);
console.log("  已撤离 " + W().evacCount + " 人，hotPhase=" + W().hotPhase + "，每波数量区间 " +
  (W().hotPhase ? CFG.escort.spawnMinHot + "~" + CFG.escort.spawnMaxHot : CFG.escort.spawnMin + "~" + CFG.escort.spawnMax));
chk(W().evacCount >= 1, "平民成功撤离");
chk(W().hotPhase === true, "第一个平民撤离后波次强化");
chk(W().motherSpawned === true, "同时在最远处投放了母体");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
