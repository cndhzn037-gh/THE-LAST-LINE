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
function clean() {
  W().units.length = 0; W().obstacles.length = 0; W().doors.length = 0;
  W().bullets.length = 0; W().flashes.length = 0; W().trails.length = 0; W().shocks.length = 0;
  W().infected = 0; W().kills = 0;
  ctx.NAV.build(ctx.CFG.world, W().obstacles, 9);
}

console.log("=== ① 远射范围翻倍 ===");
console.log("  步枪兵远射 r = " + ctx.CFG.far.r + "（原 420）");
console.log("  机枪兵射程   r = " + ctx.CFG.mg.r + "（原 420）");
clean();
const z0 = ctx.addUnit("zombie", 2700, 1200);
const r0 = ctx.addUnit("rifle", 2000, 1200);   // 距离 700：旧射程打不到，新射程能打到
ctx.rebuildGrids();
const s = ctx.senseZombies(r0, ctx.CFG.far.r, ctx.CFG.fearR);
console.log("  700px 外的丧尸是否进入感知 = " + (s.far > 0 ? "是 ✓（旧射程 420 时看不到）" : "否 ✗"));

console.log("\n=== ② 护盾碎裂冲击波 ===");
clean();
const sh = ctx.addUnit("shield", 2000, 1200);
const zs = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  const z = ctx.addUnit("zombie", 2000 + Math.cos(a) * 22, 1200 + Math.sin(a) * 22);
  z.pounceCd = 999; zs.push(z);
}
const before = zs.map(z => Math.hypot(z.x - 2000, z.y - 1200));
for (let i = 0; i < 60 * 8; i++) {
  sh.x = 2000; sh.y = 1200; sh.vx = 0; sh.vy = 0;
  ctx.stepSim(1 / 60);
  if (sh.shieldBroken) break;
}
const after = zs.map(z => Math.hypot(z.x - 2000, z.y - 1200));
const pushed = after.filter((d, i) => d > before[i] + 10).length;
console.log("  护盾破裂 = " + sh.shieldBroken + "（用时约 " + W().t.toFixed(1) + "s）");
console.log("  丧尸平均距盾兵 " + (before.reduce((a, b) => a + b, 0) / 8).toFixed(0) + "px → " +
  (after.reduce((a, b) => a + b, 0) / 8).toFixed(0) + "px");
console.log("  被推开的丧尸 = " + pushed + "/8 只 " + (pushed >= 5 ? "✓" : "✗"));
console.log("  产生的冲击波特效 = " + W().shocks.length + " 个");

console.log("\n=== ③ 盾兵被感染后自爆（不尸变）===");
clean();
const sh2 = ctx.addUnit("shield", 2000, 1200);
sh2.shieldBroken = true; sh2.shieldHp = 0;       // 直接进入破盾状态
const pack = [];
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  const z = ctx.addUnit("zombie", 2000 + Math.cos(a) * 20, 1200 + Math.sin(a) * 20);
  z.pounceCd = 999; pack.push(z);
}
const hpBefore = pack.map(z => z.hp);
let lockedAt = -1, blastAt = -1;
for (let i = 0; i < 60 * 12; i++) {
  sh2.x = 2000; sh2.y = 1200; sh2.vx = 0; sh2.vy = 0;
  ctx.stepSim(1 / 60);
  if (lockedAt < 0 && sh2.infectLocked) lockedAt = i;
  if (sh2.dead) { blastAt = i; break; }
}
console.log("  感染锁定于 t=" + (lockedAt >= 0 ? (lockedAt / 60).toFixed(2) + "s" : "未发生"));
console.log("  自爆于 t=" + (blastAt >= 0 ? (blastAt / 60).toFixed(2) + "s（锁定后 " + ((blastAt - lockedAt) / 60).toFixed(2) + "s）" : "未发生"));
console.log("  盾兵是否变成丧尸 = " + (ctx.W.infected > 0 ? "是 ✗" : "否 ✓（W.infected 仍为 0）"));
const dmg = pack.map((z, i) => hpBefore[i] - z.hp);
console.log("  范围内丧尸受伤 = " + dmg.join("/") + "（应为 4 或更高）");
console.log("  死亡的丧尸 = " + pack.filter(z => z.dead).length + "/6 只");
console.log("  自爆特效 = " + W().shocks.length + " 个");

console.log("\n=== ④ 自爆范围是否等于恐惧半径 ===");
console.log("  恐惧半径 = " + ctx.CFG.fearR + "px  自爆伤害 = " + ctx.CFG.shield.detonateDmg + "  延迟 = " + ctx.CFG.shield.detonateDelay + "s  冲击推力 = " + ctx.CFG.shield.blastPush);
