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

console.log("=== 一、数值确认 ===");
console.log("  普通丧尸 hp=" + ctx.CFG.unit.zombie.hp + "（原 2）");
console.log("  母体 hp=" + ctx.CFG.unit.mother.hp + "（原 5000，降为 1/9）");
console.log("  产卵规则：每掉总血量的 10% 即 " + (ctx.CFG.unit.mother.hp * 0.1).toFixed(1) + " 血产 7 只，共 " + Math.round(ctx.CFG.unit.mother.hp * 0.9 / (ctx.CFG.unit.mother.hp * 0.1)) + " 次");

console.log("\n=== 二、母体产卵次数（应保持 9 次 × 7 只）===");
ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0;
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const m = ctx.addUnit("mother", 2000, 1200);
console.log("  母体血量 " + m.hp + "，首个产卵阈值 " + m.nextSpawnHp.toFixed(1));
let lastZ = 0, events = 0;
for (let i = 0; i < 200 && !m.dead; i++) {
  ctx.damageZombie(m, 10);
  const zc = ctx.W.units.filter(u => u.kind === "zombie").length;
  if (zc > lastZ) { events++; lastZ = zc; }
}
console.log("  产卵触发 " + events + " 次，累计生成普通丧尸 " + lastZ + " 只，母体已死亡=" + m.dead);

console.log("\n=== 三、普通丧尸需要几发子弹 ===");
function killTest(hp) {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.bullets.length = 0; ctx.W.flashes.length = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
  ctx.CFG.unit.zombie.hp = hp;
  const z = ctx.addUnit("zombie", 3000, 1200);
  const r = ctx.addUnit("rifle", 3120, 1200);
  let shots = 0;
  const origFire = ctx.fireBullet;
  ctx.fireBullet = function () { shots++; return origFire.apply(this, arguments); };
  for (let i = 0; i < 60 * 6 && !z.dead; i++) { ctx.stepSim(1 / 60); r.x = 3120; r.y = 1200; r.vx = 0; r.vy = 0; }
  ctx.fireBullet = origFire;
  return { shots: shots, dead: z.dead };
}
const k5 = killTest(5);
console.log("  5 血丧尸：开火 " + k5.shots + " 次将其击杀（每发伤害 1）" + (k5.shots === 5 ? " ✓" : ""));
const k2 = killTest(2);
console.log("  对照 2 血丧尸：开火 " + k2.shots + " 次");

console.log("\n=== 四、武装单位抱团效果对比 ===");
function squadSpread(label, cohesion) {
  ctx.CFG.squad.cohesionMax = cohesion;
  ctx.buildScenario(undefined, 90);
  for (let i = 0; i < 60 * 12; i++) ctx.stepSim(1 / 60);
  const armed = ctx.W.units.filter(u => ctx.isArmed(u));
  if (armed.length < 2) { console.log("  " + label + "：武装单位不足"); return; }
  const cx = armed.reduce((s, u) => s + u.x, 0) / armed.length;
  const cy = armed.reduce((s, u) => s + u.y, 0) / armed.length;
  const spread = Math.sqrt(armed.reduce((s, u) => s + (u.x - cx) ** 2 + (u.y - cy) ** 2, 0) / armed.length);
  // 最近邻距离
  const nn = armed.map(a => Math.min(...armed.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.y - b.y))));
  const avgNN = nn.reduce((a, b) => a + b, 0) / nn.length;
  // 平民是否在武装身后
  const civs = ctx.W.units.filter(u => u.kind === "civilian");
  const paired = civs.filter(c => c.guardOf && !c.guardOf.dead);
  const gd = paired.map(c => Math.hypot(c.x - c.guardOf.x, c.y - c.guardOf.y));
  console.log("  " + label.padEnd(16) + " 武装=" + armed.length +
    " 集群离散=" + spread.toFixed(0) + "px" +
    " 平均最近邻=" + avgNN.toFixed(0) + "px" +
    " 抱团平民=" + paired.length + "/" + civs.length +
    " 护卫距离=" + (gd.length ? (gd.reduce((a, b) => a + b, 0) / gd.length).toFixed(0) : "-") + "px");
}
squadSpread("关闭编队聚合", 0);
squadSpread("开启编队聚合", 0.7);

console.log("\n=== 五、编队聚合是否尊重坚守点位 ===");
ctx.CFG.squad.cohesionMax = 0.7;
ctx.buildScenario(undefined, 90);
const armed2 = ctx.W.units.filter(u => ctx.isArmed(u));
armed2.forEach((u, i) => { u.defend = { x: 2600 + i * 90, y: 700 + (i % 3) * 300 }; });
for (let i = 0; i < 60 * 20; i++) ctx.stepSim(1 / 60);
let onPost = 0;
for (const u of armed2) if (!u.dead && Math.hypot(u.x - u.defend.x, u.y - u.defend.y) < 180) onPost++;
console.log("  20 秒后守在各自点位 180px 内的武装单位 = " + onPost + "/" + armed2.filter(u => !u.dead).length + "（有点位者不参与聚合，应保持高比例）");
