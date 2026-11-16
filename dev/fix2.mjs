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
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("test")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });

console.log("=== 机枪兵穿透规则 ===");
function shotTest(hps, label) {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
  const zs = [];
  for (let i = 0; i < 8; i++) {
    const z = ctx.addUnit("zombie", 2050 + i * 17, 1200);   // 17px 间距：挤成一团的尸潮
    zs.push(z);
  }
  zs.forEach((z, i) => { z.hp = hps[i % hps.length]; });
  ctx.rebuildGrids();
  const before = zs.map(z => z.hp);
  ctx.fireBullet({ x: 2000, y: 1200, r: 9, kind: "mg" }, zs[0], 0, ctx.CFG.mg.dmg, 3, true);
  ctx.stepBullets(1 / 60);
  const hitList = zs.map((z, i) => before[i] - z.hp).filter(d => d > 0);
  const killed = zs.filter((z, i) => before[i] > 0 && z.dead).length;
  console.log("  " + label.padEnd(34) + " 一发命中 " + hitList.length + " 个（伤害 " + hitList.join("/") + "），其中击杀 " + killed + " 个");
}
shotTest([5, 5, 5, 5, 5, 5, 5, 5], "全部 5 血（打不死，仍应穿透）");
shotTest([3, 3, 3, 3, 3, 3, 3, 3], "全部 3 血（一枪一个，连锁追加）");
shotTest([3, 5, 5, 5, 5, 5, 5, 5], "第1个致死、第2个不死");
console.log("  规则：基础穿 " + ctx.CFG.mg.hits + " 个目标，不要求致死；穿透过程中每造成一次击杀再追加一次，总上限 " + ctx.CFG.mg.maxHits + " 个");

console.log("\n=== 编辑器：开局后是否保留玩家编辑的单位 ===");
ctx.buildScenario(undefined, 40);
const beforeUnits = ctx.W.units.length;
console.log("  默认场景单位数 = " + beforeUnits + "（人类 " + ctx.countUnits().h + " 丧尸 " + ctx.countUnits().z + "）");
ctx.startEditor();
ctx.EDIT.tool = "rifle"; ctx.EDIT.mode = "point";
ctx.editPointerDown(2500, 1000);
ctx.EDIT.tool = "zombie";
ctx.editPointerDown(2560, 1000);
const afterEdit = ctx.W.units.length;
console.log("  编辑器里放置 2 个单位后 = " + afterEdit + "，unitsEdited=" + ctx.EDIT.unitsEdited);
ctx.finishEditor();
ctx.beginGame();
const foundRifle = ctx.W.units.filter(u => u.kind === "rifle" && Math.abs(u.x - 2500) < 6 && Math.abs(u.y - 1000) < 6);
const foundZombie = ctx.W.units.filter(u => u.kind === "zombie" && Math.abs(u.x - 2560) < 6 && Math.abs(u.y - 1000) < 6);
console.log("  开局后单位数 = " + ctx.W.units.length);
console.log("  玩家放置的步枪兵保留 = " + (foundRifle.length ? "是 ✓" : "否 ✗") + "   丧尸保留 = " + (foundZombie.length ? "是 ✓" : "否 ✗"));
console.log("  人类=" + ctx.countUnits().h + " 丧尸=" + ctx.countUnits().z + " 击杀=" + ctx.W.kills);

console.log("\n=== 对照：只改地形、不动单位时，单位仍按尸潮规模重建 ===");
ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false;
ctx.buildScenario(undefined, 40);
ctx.startEditor();
ctx.EDIT.tool = "wall"; ctx.EDIT.mode = "drag";
ctx.editPointerDown(1500, 1600); ctx.editPointerMove(1800, 1850); ctx.editPointerUp(1800, 1850);
console.log("  只画了一堵墙：touched=" + ctx.EDIT.touched + " unitsEdited=" + ctx.EDIT.unitsEdited);
ctx.finishEditor();
const obsBefore = ctx.W.obstacles.length;
ctx.beginGame();
console.log("  开局后障碍=" + ctx.W.obstacles.length + "（编辑后 " + obsBefore + "，地形保留 ✓）  单位=" + ctx.W.units.length + "（按规模重建）");

console.log("\n=== 单位保留后能否正常演算 ===");
ctx.startEditor();
ctx.EDIT.tool = "rifle"; ctx.editPointerDown(2600, 900);
ctx.finishEditor();
ctx.beginGame();
for (let i = 0; i < 60 * 20; i++) ctx.stepSim(1 / 60);
let bad = 0;
for (const u of ctx.W.units) {
  if (!isFinite(u.x) || !isFinite(u.y)) bad++;
  for (const o of ctx.W.obstacles) if (u.x > o.x && u.x < o.x + o.w && u.y > o.y && u.y < o.y + o.h) { bad++; break; }
}
console.log("  演算 20 秒后异常单位 = " + bad + "（应为 0）  人类=" + ctx.countUnits().h + " 丧尸=" + ctx.countUnits().z + " 击杀=" + ctx.W.kills);
