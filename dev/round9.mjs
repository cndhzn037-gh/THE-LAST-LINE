import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const gradStub = { addColorStop: noop };
const ops = [];
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => {
      if (p in t) return t[p];
      if (p === "fill") return function () { ops.push({ op: "fill", c: t.fillStyle }); };
      if (p === "closePath") return function () { ops.push({ op: "closePath" }); };
      if (p === "ellipse") return function (x, y, rx, ry) { ops.push({ op: "ellipse", x: x, y: y, rx: rx, ry: ry, c: t.fillStyle }); };
      return noop;
    }, set: (t, p, v) => { t[p] = v; return true; } });
function makeEl(id) { return { id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl(id)), createElement: () => makeEl("x"), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });
const W = () => ctx.W;
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function tick(n) { for (let i = 0; i < n; i++) ctx.stepSim(1 / 60); }
function clearScene() {
  ctx.buildScenario(999, 2);
  W().over = false;
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
  W().bloodstains.length = 0; W().domes.length = 0; W().shells.length = 0; W().casings.length = 0;
  W().armedHadMany = 0; W().civHadMany = 0; W().heroDuo = null;
  CFG.hero.enabled = true;
}

console.log("=== 一、血迹变成闭合曲面 ===");
clearScene();
const bz = ctx.addUnit("zombie", 1500, 1000);
bz.hp = 1;
ctx.rebuildGrids();
ctx.killZombie(bz);
const bs = W().bloodstains[0];
console.log("  顶点数 " + bs.pts.length + "，首尾应闭合");
chk(bs.pts.length >= 8, "顶点够多，能围出不规则轮廓");
chk(!bs.pts.some(p => p.cx !== undefined), "不再是那种带控制点的散弧线");
ops.length = 0;
ctx.render();
const fills = ops.filter(o => o.op === "fill").length;
const closes = ops.filter(o => o.op === "closePath").length;
console.log("  渲染一帧：fill " + fills + " 次，closePath " + closes + " 次");
chk(closes >= 1, "血迹是闭合路径后填充的（不再是一条条线）");

console.log("\n=== 二、护盾改成金色 ===");
const srcTxt = fs.readFileSync(process.argv[2], "utf8");
chk(srcTxt.indexOf("hsl(45,100%,64%)") >= 0, "护盾填充改成金色");
chk(srcTxt.indexOf("hsl(198,100%,66%)") < 0, "旧的青色已移除");

console.log("\n=== 三、护盾破裂后 10 秒自动重开 ===");
clearScene();
const shd = ctx.addUnit("shield", 1500, 1000);
const sh2 = ctx.addUnit("shield", 1560, 1000);
ctx.rebuildGrids(); tick(2);
sh2.dead = true; ctx.cleanup(); tick(2);
chk(shd.hero === "armed", "盾兵英雄就位");
ctx.stepSim(1 / 60);   /* domeOn 是在每帧的护盾结算里刷新的 */
chk(shd.domeOn === true, "护罩已撑起");
shd.domeHp = 0; shd.domeOn = false; shd.domeDownT = CFG.shield.domeRestore;
console.log("  强制打破：domeOn=" + shd.domeOn + "，倒计时 " + shd.domeDownT + "s（设定 " + CFG.shield.domeRestore + "s）");
chk(CFG.shield.domeRestore === 10, "重开间隔是 10 秒");
/* 附近不放丧尸，验证"不管有没有接触都会重开" */
for (let i = 0; i < 60 * 9; i++) ctx.stepSim(1 / 60);
console.log("  9 秒后：domeOn=" + shd.domeOn + "（附近没有丧尸）");
chk(shd.domeOn === false, "时间还没到，仍处于破裂状态");
for (let i = 0; i < 60 * 2; i++) ctx.stepSim(1 / 60);
console.log("  11 秒后：domeOn=" + shd.domeOn + "，耐久 " + shd.domeHp.toFixed(1) + "s");
chk(shd.domeOn === true, "无人接触也照样自动重新撑起");
chk(Math.abs(shd.domeHp - CFG.shield.domeHp) < 0.01, "耐久回满");

console.log("\n=== 四、抛飞动画与延迟结算 ===");
clearScene();
const src = ctx.addUnit("shield", 1500, 1000);
const vic = ctx.addUnit("zombie", 1560, 1000);
vic.hp = 99999;
ctx.rebuildGrids();
const x0 = vic.x;
/* blastKnock(v, dx, dy, push, dmg) 是五个参数：位移向量、推出距离、伤害 */
ctx.blastKnock(vic, 60, 0, 60, 3);
console.log("  被掀飞：airT=" + vic.airT.toFixed(2) + "s，高度 " + vic.airH.toFixed(1) +
  "，当前位置 x=" + vic.x.toFixed(0) + "（起点 " + x0 + "）");
chk(vic.airT > 0, "进入抛飞状态");
chk(Math.abs(vic.x - x0) < 2, "动画开始时还在起点，不是瞬移");
chk(vic.pendingDmg > 0, "伤害先记着（" + vic.pendingDmg + "），等落地再算");
const hp0 = vic.hp;
tick(6);
const midH = vic.airH, midX = vic.x;
console.log("  6 帧后：高度 " + midH.toFixed(1) + "，x=" + midX.toFixed(0) + "，血量 " + vic.hp);
chk(midH > 0, "在空中");
chk(midX > x0 + 2, "水平位置在推进");
chk(vic.hp === hp0, "还在空中时伤害没有结算");
/* 落地 */
let landedAt = -1, hpAtLand = 0;
for (let i = 0; i < 60 * 2; i++) {
  tick(1);
  if (vic.airT <= 0 && landedAt < 0) { landedAt = i; hpAtLand = vic.hp; }
}
console.log("  约 " + (landedAt / 60).toFixed(2) + "s 落地，血量 " + hp0 + " → " + vic.hp + "，高度 " + vic.airH);
chk(landedAt >= 0, "落地了");
chk(vic.airH === 0, "落地后高度归零");
chk(vic.hp < hp0, "落地之后伤害才被结算");

console.log("\n=== 五、动画不影响击退距离 ===");
/* 同一发冲击，一次带动画、一次把动画时长设为 0，对比最终位移 */
/* 比的是"动画要把他送到哪儿"（airToX），而不是最终停下位置 ——
   后者还叠加了落地之后才生效的惯性滑行，那是另一套机制 */
function knockLanding(airDur) {
  clearScene();
  const s1 = ctx.addUnit("shield", 1500, 1000);
  const v1 = ctx.addUnit("zombie", 1560, 1000);
  v1.hp = 99999;
  ctx.rebuildGrids();
  const x00 = v1.x;
  const saveDur = CFG.air.dur;
  CFG.air.dur = airDur;
  ctx.shieldBlast(s1);
  CFG.air.dur = saveDur;
  return v1.airToX - x00;
}
const landA = knockLanding(0.55);
const landB = knockLanding(0.0001);
console.log("  抛物线落点：带动画 " + landA.toFixed(2) + "px，不带动画 " + landB.toFixed(2) + "px");
chk(Math.abs(landA - landB) < 0.5, "动画只是把过程演出来，落点分毫不差");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
