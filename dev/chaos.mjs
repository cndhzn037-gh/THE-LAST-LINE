import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
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
function build(n, hero) {
  ctx.GAME_MODE = "chaos";
  ctx.START.gameMode = "chaos";
  ctx.START.chaosCiv = n;
  ctx.START.heroMode = !!hero;
  CFG.hero.enabled = !!hero;
  ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false; ctx.EDIT.units = null;
  ctx.buildScenario(999, 0);
}

console.log("=== 一、场景生成 ===");
build(200, false);
const w0 = W();
console.log("  平民 " + w0.units.filter(u => u.kind === "civilian").length + " 名，障碍 " + w0.obstacles.length +
  " 个，倒计时 " + w0.countdown + "s，开局丧尸 " + w0.units.filter(u => ctx.isZombie(u)).length);
chk(w0.countdown === CFG.chaos.countdown, "开局进入倒计时状态");
chk(w0.units.filter(u => ctx.isZombie(u)).length === 0, "倒计时结束时才会出现丧尸");
/* 墙段长度限制 */
const maxLen = Math.round(CFG.world.h / 6);
const longWalls = w0.obstacles.filter(o => (o.h > maxLen + 4 && o.w <= 30) || (o.w > maxLen + 4 && o.h <= 30));
console.log("  最长允许的墙段 " + maxLen + "px，超长的有 " + longWalls.length + " 段");
chk(longWalls.length === 0, "没有贯通式长墙");
/* 散布均匀性：把地图切 8x8，看多少格子里有人 */
const CN = 8, grid = new Array(CN * CN).fill(0);
for (const u of w0.units) {
  if (u.kind !== "civilian") continue;
  const gx = Math.min(CN - 1, Math.floor(u.x / (CFG.world.w / CN)));
  const gy = Math.min(CN - 1, Math.floor(u.y / (CFG.world.h / CN)));
  grid[gy * CN + gx]++;
}
const empty = grid.filter(c => c === 0).length;
console.log("  8×8 分区里有人的格子 " + (CN * CN - empty) + " / " + (CN * CN));
chk(empty <= 4, "平民基本铺满全图（空格 " + empty + " 个）");
/* 再洪泛一次：如果还有"走不到的可通行格"，说明密闭空间没除干净 */
const leftPocket = ctx.punchOutPockets();
console.log("  生成后再洪泛一遍：被困格子 " + leftPocket + " 个");
chk(leftPocket === 0, "地图上不存在任何密闭空间");

console.log("\n=== 二、倒计时期间谁都不许动 ===");
build(120, false);
tick(120);
const civs = W().units.filter(u => u.kind === "civilian");
const pos0 = civs.map(u => ({ x: u.x, y: u.y }));
console.log("  倒计时过了 2 秒，剩余 " + W().countdown.toFixed(1) + "s");
chk(W().countdown >= 7.9 && W().countdown < 10, "倒计时在走（剩余 " + W().countdown.toFixed(2) + "s）");
let moved = 0;
civs.forEach((u, i) => { if (Math.hypot(u.x - pos0[i].x, u.y - pos0[i].y) > 1) moved++; });
console.log("  移动过的平民 " + moved + " / " + civs.length);
chk(moved === 0, "倒计时期间没有任何单位移动");

console.log("\n=== 三、倒计时结束后身份重排 ===");
/* 快进到倒计时结束 */
let waited = 0;
while (W().countdown > 0 && waited < 60 * 15) { ctx.stepSim(1 / 60); waited++; }
console.log("  倒计时结束后场上构成：" + JSON.stringify((() => {
  const m = {};
  for (const u of W().units) if (!u.dead) m[u.kind] = (m[u.kind] || 0) + 1;
  return m;
})()));
const n0 = W().chaosCiv0;
const mix = CFG.chaos.mix;
const cnt = {};
for (const u of W().units) if (!u.dead) cnt[u.kind] = (cnt[u.kind] || 0) + 1;
console.log("  初始平民 " + n0 + " → 僵尸 " + (cnt.zombie || 0) + "（期望 " + Math.floor(n0 * mix.zombie) + "），" +
  "奔跑者 " + (cnt.runner || 0) + "（" + Math.floor(n0 * mix.runner) + "），" +
  "步枪兵 " + (cnt.rifle || 0) + "（" + Math.floor(n0 * mix.rifle) + "）");
chk((cnt.runner || 0) === Math.floor(n0 * mix.runner), "奔跑者 = " + Math.floor(n0 * mix.runner));
chk((cnt.rifle || 0) === Math.floor(n0 * mix.rifle), "步枪兵 = " + Math.floor(n0 * mix.rifle));
chk((cnt.mg || 0) === Math.floor(n0 * mix.mg), "机枪兵 = " + Math.floor(n0 * mix.mg));
chk((cnt.sniper || 0) === Math.floor(n0 * mix.sniper), "狙击手 = " + Math.floor(n0 * mix.sniper));
chk((cnt.shield || 0) === Math.floor(n0 * mix.shield), "盾兵 = " + Math.floor(n0 * mix.shield));
chk((cnt.civilian || 0) === Math.floor(n0 * mix.civilian), "保留平民 = " + Math.floor(n0 * mix.civilian));
/* 剩下的全归普通丧尸 */
const usedByMix = Math.floor(n0 * mix.runner) + Math.floor(n0 * mix.rifle) + Math.floor(n0 * mix.mg) +
  Math.floor(n0 * mix.sniper) + Math.floor(n0 * mix.shield) + Math.floor(n0 * mix.civilian);
console.log("  普通丧尸 " + (cnt.zombie || 0) + "（剩下的 " + (n0 - usedByMix - (cnt.mother || 0)) + " 名全归它）");
chk((cnt.zombie || 0) > 0, "其余平民变成普通丧尸");
const momExpect = 1 + Math.floor(n0 / CFG.chaos.motherPer);
console.log("  母体 " + (cnt.mother || 0) + " 只（期望 " + momExpect + "）");
chk((cnt.mother || 0) === momExpect, "母体数量 = 1 + 平民数/200");
chk((cnt.civilian || 0) > 0, "剩余平民保留下来（" + (cnt.civilian || 0) + " 名）");

console.log("\n=== 四、英雄模式让母体多五成 ===");
build(600, true);
waited = 0;
while (W().countdown > 0 && waited < 60 * 15) { ctx.stepSim(1 / 60); waited++; }
const n1 = W().chaosCiv0;
const moms = W().units.filter(u => !u.dead && u.kind === "mother").length;
const base1 = 1 + Math.floor(n1 / CFG.chaos.motherPer);
const expect1 = Math.max(1, Math.round(base1 * (1 + CFG.chaos.heroMotherBonus)));
console.log("  平民 " + n1 + " 名：基础母体 " + base1 + "，英雄模式后 " + expect1 + "，实际 " + moms);
chk(moms === expect1, "英雄模式下母体数量 +50%");

console.log("\n=== 五、兵种不足 1 个就不生成 ===");
build(CFG.chaos.minCiv, false);   /* 20 人：8% 狙击手 = 1.6 → 1 个；10% 盾兵 = 2 个 */
waited = 0;
while (W().countdown > 0 && waited < 60 * 15) { ctx.stepSim(1 / 60); waited++; }
const n2 = W().chaosCiv0;
const snip = W().units.filter(u => !u.dead && u.kind === "sniper").length;
const mgN = W().units.filter(u => !u.dead && u.kind === "mg").length;
console.log("  平民 " + n2 + " 名：狙击手期望 " + Math.floor(n2 * 0.003) + "，实际 " + snip +
  "；机枪兵期望 " + Math.floor(n2 * 0.005) + "，实际 " + mgN);
chk(snip === Math.floor(n2 * 0.003), "狙击手按 floor 计算");
chk(mgN === Math.floor(n2 * 0.005), "机枪兵按 floor 计算");
chk(Math.floor(n2 * 0.003) === 0 && snip === 0, "不足 1 个时该局不生成这个兵种");

console.log("\n=== 六、平民数量上下限 ===");
build(1, false);
console.log("  传 1 → 实际 " + W().chaosCiv0 + "（下限 " + CFG.chaos.minCiv + "）");
chk(W().chaosCiv0 >= CFG.chaos.minCiv, "低于下限会被抬到 " + CFG.chaos.minCiv);
build(5000, false);
console.log("  传 5000 → 实际 " + W().chaosCiv0 + "（上限 " + CFG.chaos.maxCiv + "）");
chk(W().chaosCiv0 <= CFG.chaos.maxCiv, "高于上限会被压到 " + CFG.chaos.maxCiv);

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
