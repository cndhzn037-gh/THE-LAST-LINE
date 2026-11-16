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
function startEscort(civ) {
  ctx.START.gameMode = "escort";
  ctx.START.civCount = civ;
  ctx.START.squad = { rifle: 3, mg: 1, sniper: 0, shield: 0 };
  ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false;
  ctx.beginGame();
}

console.log("=== ① 封锁大门是否挡住一切非平民单位 ===");
startEscort(4);
const pd = W().prisonDoor;
const NAV = ctx.NAV;
const tile = NAV.tile;
let blockedCells = 0, total = 0;
for (let yy = pd.y; yy < pd.y + pd.h; yy += 8) {
  const cx = Math.floor((pd.x + pd.w / 2) / tile), cy = Math.floor(yy / tile);
  total++; if (NAV.b(cx, cy)) blockedCells++;
}
console.log("  大门纵向采样 " + total + " 点，导航标记为阻挡 " + blockedCells + " 点 " + (blockedCells === total ? "✓ 完全封死" : ""));
const prisonObs = W().obstacles.filter(o => o.prison);
console.log("  大门作为实体墙存在 = " + (prisonObs.length ? "是 ✓（" + prisonObs[0].w + "×" + prisonObs[0].h + "）" : "否 ✗"));
console.log("  平民仍被关在屋里 = " + W().units.filter(u => u.penned).length + " 人，门内格数未变");

console.log("\n=== ①b 丧尸会不会因为屋里的平民而堵门 ===");
ctx.rebuildGrids();
const outsideZ = ctx.addUnit("zombie", pd.x + 120, pd.y + pd.h / 2);
outsideZ.pounceCd = 999;
ctx.rebuildGrids();
const tgt = ctx.nearestHuman(outsideZ);
const pennedList = W().units.filter(u => u.penned && ctx.isHuman(u));
console.log("  屋外丧尸的最近人类目标 = " + (tgt ? tgt.kind + "@(" + tgt.x.toFixed(0) + "," + tgt.y.toFixed(0) + ")" : "无"));
console.log("  屋内被关押平民 " + pennedList.length + " 人，是否被锁定 = " +
  (tgt && tgt.penned ? "是 ✗（会堵门）" : "否 ✓ 不会堵门"));
outsideZ.dead = true;
W().units = W().units.filter(u => !u.dead);
ctx.rebuildGrids();

console.log("\n=== ② 平民是否每 2 秒放出一个 ===");
const sq = W().units.filter(u => ctx.isArmed(u));
for (let i = 0; i < sq.length; i++) { sq[i].x = pd.x + 40; sq[i].y = pd.y + 20 + i * 24; sq[i].vx = 0; sq[i].vy = 0; }
let times = [], lastRel = 0;
for (let i = 0; i < 60 * 20; i++) {
  ctx.stepSim(1 / 60);
  if (W().released > lastRel) { times.push(W().t); lastRel = W().released; }
  if (W().phase === "retreat") break;
}
const gaps = times.slice(1).map((t, i) => +(t - times[i]).toFixed(2));
console.log("  释放时刻(s) = " + times.map(t => t.toFixed(1)).join(", "));
console.log("  相邻间隔 = " + gaps.join(", ") + "  " + (gaps.every(g => g > 1.8 && g < 2.3) ? "✓ 稳定 2 秒" : "✗"));
console.log("  全部放出 " + W().released + "/" + W().civTotal + "  阶段 = " + W().phase);

console.log("\n=== ③ 平民全没了是否会卡住（屋里的平民被打死）===");
startEscort(4);
const pd2 = W().prisonDoor;
W().units.forEach(u => { if (u.penned) u.dead = true; });
W().doorOpen = true; W().phase = "rescue";
const sq2 = W().units.filter(u => ctx.isArmed(u));
for (let i = 0; i < sq2.length; i++) { sq2[i].x = pd2.x + 40; sq2[i].y = pd2.y + 20 + i * 22; }
for (let i = 0; i < 180; i++) ctx.stepSim(1 / 60);
console.log("  被困平民清空后 → 阶段 = " + W().phase + " " + (W().phase === "retreat" ? "✓ 自动转入撤离，不再傻等" : "✗ 卡住"));

console.log("\n=== ④ 盾兵是否站到队伍前面 ===");
ctx.START.squad = { rifle: 2, shield: 1 };
ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false;
ctx.beginGame();
const sh = W().units.find(u => u.kind === "shield");
const rfs = W().units.filter(u => u.kind === "rifle");
for (let i = 0; i < 60 * 8; i++) ctx.stepSim(1 / 60);
const goal = { x: W().prisonDoor.x, y: W().prisonDoor.y };
const shD = Math.hypot(sh.x - goal.x, sh.y - goal.y);
const rfD = rfs.map(r => Math.hypot(r.x - goal.x, r.y - goal.y));
console.log("  盾兵到大门距离 = " + shD.toFixed(0) + "  步枪兵 = " + rfD.map(d => d.toFixed(0)).join(", "));
console.log("  盾兵是否更靠前 = " + (shD <= Math.max(...rfD) ? "是 ✓" : "否 ✗"));

console.log("\n=== ⑤ 狙击弹视觉参数 ===");
console.log("  弹体长度 = " + ctx.CFG.sniper.len + "px（普通弹 " + ctx.CFG.bullet.len + "px）");
console.log("  宽度倍率 = ×" + ctx.CFG.sniper.widthMul + "（普通宽 " + ctx.CFG.bullet.width + "px → 狙击 " + (ctx.CFG.bullet.width * ctx.CFG.sniper.widthMul).toFixed(1) + "px）");
console.log("  枪口特效 长度 = " + ctx.CFG.sniper.flashLen + "  宽度 = " + ctx.CFG.sniper.flashWid + "（普通枪口 " + ctx.CFG.flash.len + "×" + 13 + "）");
ctx.W.units.length = 0; ctx.W.obstacles.length = 0;
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const sn2 = ctx.addUnit("sniper", 2000, 1200);
ctx.addUnit("zombie", 2600, 1200);
ctx.fireBullet(sn2, { x: 2600, y: 1200 }, 0, 4, 5, false, true);
console.log("  生成的狙击弹 = " + (W().bullets[0].snipe ? "snipe 标记 ✓" : "✗") +
  "，速度 " + W().bullets[0].vx.toFixed(0) + "（普通弹 " + ctx.CFG.bullet.speed + "）");
console.log("  枪口特效已生成 = " + (W().flashes.length ? "是 ✓ snipe=" + W().flashes[0].snipe + " len=" + W().flashes[0].len : "否 ✗"));

console.log("\n=== ⑥ 护送模式能否编辑地形 ===");
startEscort(4);
ctx.startEditor();
console.log("  startEditor → EDIT.active = " + ctx.EDIT.active + " " + (ctx.EDIT.active ? "✓ 已开放" : "✗"));
ctx.EDIT.tool = "wall"; ctx.EDIT.mode = "drag";
ctx.editPointerDown(1000, 1000); ctx.editPointerMove(1300, 1200); ctx.editPointerUp(1300, 1200);
console.log("  画一堵墙后 障碍数 = " + W().obstacles.length + "  touched = " + ctx.EDIT.touched);
const obsBeforeErase = W().obstacles.length;
ctx.EDIT.tool = "erase";
ctx.editPointerDown(W().prisonDoor.x + 5, W().prisonDoor.y + 40);
ctx.editPointerUp(W().prisonDoor.x + 5, W().prisonDoor.y + 40);
console.log("  橡皮擦点大门：障碍 " + obsBeforeErase + " -> " + W().obstacles.length +
  "，prison 障碍 = " + W().obstacles.filter(o => o.prison).length + " " +
  (W().obstacles.filter(o => o.prison).length > 0 ? "✓ 受保护" : "✗ 被删了"));
const preDoors = W().doors, prePrison = W().doors.filter(d => d.prison).length;
ctx.finishEditor();
console.log("  [调试] 完成编辑时：touched=" + ctx.EDIT.touched + " doors=" + preDoors.length + " 其中prison=" + prePrison +
  " 障碍=" + W().obstacles.length + " prisonDoor=" + (W().prisonDoor ? "有" : "无"));
ctx.beginGame();
console.log("  [调试] 开局后：mode=" + W().mode + " doors=" + W().doors.length +
  " 其中prison=" + W().doors.filter(d => d.prison).length + " 障碍=" + W().obstacles.filter(o => o.prison).length);
console.log("  开局后障碍数 = " + W().obstacles.length + "（编辑已保留）  封锁大门 = " + (W().prisonDoor ? "在 ✓" : "丢了 ✗"));
