import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const gradStub = { addColorStop: noop };
const strokes = [];
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => {
      if (p in t) return t[p];
      if (p === "arc") return function (x, y, r) { strokes.push({ op: "arc", x: x, y: y, r: r, c: t.strokeStyle }); };
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
function clearScene() {
  ctx.buildScenario(999, 2);
  W().over = false;
  for (const u of W().units) u.dead = true;
  ctx.cleanup();
  W().units.length = 0;
  W().obstacles.length = 0;
  ctx.NAV.build(CFG.world, W().obstacles, 9);
  W().shells.length = 0; W().casings.length = 0; W().bloodstains.length = 0; W().reloadPops.length = 0;
}

console.log("=== 一、血迹更明显 ===");
console.log("  不透明度 " + CFG.blood.alpha + "（原 0.17），明度区间 " + CFG.blood.litLo + "~" + CFG.blood.litHi);
chk(CFG.blood.alpha >= 0.25, "不透明度比原来（0.17）明显提高，但没有浓到扎眼");
chk(CFG.blood.litLo >= 28, "明度也抬高了，不再是黑乎乎一片");
clearScene();
const z1 = ctx.addUnit("zombie", 1500, 1000);
z1.hp = 1;
ctx.rebuildGrids();
ctx.killZombie(z1);
chk(W().bloodstains.length === 1, "血迹照常生成");

console.log("\n=== 二、弹壳尺寸按兵种 ===");
console.log("  步枪 " + CFG.shell.sizes.rifle + "，机枪 " + CFG.shell.sizes.mg +
  "，狙击 " + CFG.shell.sizes.sniper + "，盾兵手枪 " + CFG.shell.sizes.shield + "（子弹宽度 " + CFG.bullet.width + "）");
chk(CFG.shell.sizes.rifle < CFG.shell.sizes.mg, "机枪弹壳略粗于步枪");
chk(CFG.shell.sizes.sniper > CFG.shell.sizes.mg * 2, "狙击弹壳明显更大");
chk(CFG.shell.sizes.rifle < 1.5, "步枪弹壳只比子弹宽一点点（" + CFG.shell.sizes.rifle + "）");
/* 实际开火核对 */
clearScene();
const sizes = {};
for (const k of ["rifle", "mg", "sniper"]) {
  const u = ctx.addUnit(k, 1500, 1000);
  const t = ctx.addUnit("zombie", 2000, 1000);
  t.hp = 99999;
  ctx.rebuildGrids();
  ctx.fireBullet(u, t, 0, 2, 1, false, false);
  sizes[k] = W().shells[W().shells.length - 1].size;
  W().shells.length = 0;
  u.dead = true; t.dead = true; ctx.cleanup();
}
console.log("  实际抛出的弹壳：" + Object.keys(sizes).map(k => k + "=" + sizes[k]).join("  "));
chk(sizes.sniper > sizes.mg && sizes.mg > sizes.rifle, "尺寸关系正确");

console.log("\n=== 三、换弹时的禁止符号 ===");
clearScene();
const rl = ctx.addUnit("rifle", 1500, 1000);
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
rl.reloading = true; rl.reloadT = 1.5;
strokes.length = 0;
ctx.render();
const redArcs = strokes.filter(s2 => s2.op === "arc" && typeof s2.c === "string" && s2.c.indexOf("232,64,64") >= 0);
console.log("  换弹中渲染：红色圆弧 " + redArcs.length + " 处" + (redArcs.length ? "，半径 " + redArcs[0].r.toFixed(1) + "px" : ""));
chk(redArcs.length >= 1, "头顶画出了禁止符号");
if (redArcs.length) {
  const ur = rl.r * ctx.CAM.zoom;
  chk(redArcs[0].r < ur, "符号比角色半径还小（" + redArcs[0].r.toFixed(1) + " < " + ur.toFixed(1) + "）");
}
rl.reloading = false;
strokes.length = 0;
ctx.render();
const redArcs2 = strokes.filter(s2 => s2.op === "arc" && typeof s2.c === "string" && s2.c.indexOf("232,64,64") >= 0);
console.log("  换弹结束后渲染：红色圆弧 " + redArcs2.length + " 处");
chk(redArcs2.length === 0, "换弹完成后符号消失");

console.log("\n=== 四、换弹完成的弹壳提示 ===");
clearScene();
const rl2 = ctx.addUnit("rifle", 1500, 1000);
const tz = ctx.addUnit("zombie", 1900, 1000);
tz.hp = 99999;
ctx.rebuildGrids();
ctx.stepSim(1 / 60);
rl2.reloading = true; rl2.reloadT = 0.02; rl2.mag = 0;
ctx.stepSim(1 / 60);
ctx.stepSim(1 / 60);
console.log("  换弹完成：mag=" + rl2.mag + "，头顶提示 " + W().reloadPops.length + " 条，剩余 " +
  (W().reloadPops[0] ? W().reloadPops[0].t.toFixed(2) : "-") + "s");
chk(W().reloadPops.length === 1, "换弹完成时弹出了提示");
chk(rl2.mag === rl2.magSize, "弹匣确实补满了");
if (W().reloadPops[0]) chk(Math.abs(W().reloadPops[0].max - 1) < 0.01, "提示持续 1 秒");
ctx.stepSim(1 / 60);
chk(W().reloadPops.length === 0 || W().reloadPops[0].t < 1, "提示在倒计时");
/* 一秒后消失 */
for (let i = 0; i < 70; i++) { tz.x = 1900; tz.y = 1000; tz.hp = 99999; ctx.stepSim(1 / 60); }
console.log("  1 秒多以后：还剩 " + W().reloadPops.length + " 条");
chk(W().reloadPops.length === 0, "一秒内消散");

console.log("\n=== 五、重置时清空 ===");
clearScene();
const zz2 = ctx.addUnit("zombie", 1500, 1000);
zz2.hp = 1;
ctx.rebuildGrids();
ctx.killZombie(zz2);
ctx.resetForSetup();
chk(W().bloodstains.length === 0 && W().shells.length === 0 && W().casings.length === 0 && W().reloadPops.length === 0,
  "血迹、弹壳、提示全部随地图重置清空");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
