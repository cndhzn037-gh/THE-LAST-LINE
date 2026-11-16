import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const i0 = html.indexOf("<script>") + 8;
const i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
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
vm.runInContext(gcode, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
const CFG = ctx.CFG;

function freshScene() {
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
  ctx.LAST_ZOMBIE_COUNT = 2;
  ctx.buildScenario(3, 2);
  ctx.W.over = false; ctx.W.paused = false;
  for (const u of ctx.W.units) u.dead = true;
  ctx.cleanup();
  ctx.W.tongues.length = 0;
  ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
}
function alive(q) { return q && !q.dead && !q.retract; }
function tickWatch(sec, fn) {
  const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) { ctx.stepSim(1 / 60); fn(); }
}

console.log("=== 一、两只舔舐者抢同一个目标：只能一只下手 ===");
freshScene();
/* 两只站在同一侧：拖拽都朝同一个方向拉，谁都不会因为目标被拉走而够不着 */
const civ = ctx.addUnit("civilian", 2000, 1200);
const lkA = ctx.addUnit("licker", 3300, 1000);
const lkB = ctx.addUnit("licker", 3300, 1400);
ctx.rebuildGrids();
let maxSim = 0, owners = new Set(), waits = 0, waitTMax = 0;
tickWatch(16, () => {
  const n = ctx.W.tongues.filter(alive).length;
  if (n > maxSim) maxSim = n;
  for (const q of ctx.W.tongues) if (alive(q)) owners.add(q.owner);
  for (const w of [lkA, lkB]) {
    if (w.state === "lickerWait") {
      waits++;
      if ((w.tongueT || 0) > waitTMax) waitTMax = w.tongueT;
    }
  }
});
console.log("  16 秒内同时存在的最多舌头数 = " + maxSim + "，出手过的舔舐者有 " + owners.size +
  " 只，等待帧数 " + waits + "，等待期间读条最高 " + waitTMax.toFixed(2) + "s");
chk(maxSim <= 1, "同一个目标上永远不会同时挂两条舌头");
chk(waits > 0, "确实出现了排队等待");
chk(waitTMax >= CFG.licker.windup - 0.05, "排队期间读条不受影响，照样能读满");
chk(owners.size >= 2, "前一只收工后另一只接上（交替进行，不会饿死）");

console.log("=== 一b、前排被打断 = 脱战，排队的立刻出手 ===");
freshScene();
const civB2 = ctx.addUnit("civilian", 2000, 1200);
const lkC = ctx.addUnit("licker", 3300, 1000);
const lkD = ctx.addUnit("licker", 3300, 1400);
ctx.rebuildGrids();
let guard = 0;
while (!lkC.tongueFired && guard++ < 60 * 6) ctx.stepSim(1 / 60);
const qA = ctx.W.tongues.find(alive);
console.log("  前排已粘住：A.fire=" + (lkC.tongueFired || 0) + "，B 读条=" + (lkD.tongueT || 0).toFixed(2) +
  "s，B 状态=" + lkD.state);
chk(!!qA && qA.owner === lkC, "A 先出手");
chk(lkD.state === "lickerWait", "B 在排队等着");
chk((lkD.tongueT || 0) >= CFG.licker.windup - 0.05, "排队时 B 已经读满，就等 A 脱战");
ctx.breakTongue(qA);
console.log("  打断 A 的舌头后：A.fleeT=" + (lkC.fleeT || 0).toFixed(1) + "，A.cd=" + (lkC.tongueCd || 0).toFixed(1));
let fired = 0;
for (let i = 0; i < 18; i++) { ctx.stepSim(1 / 60); if (ctx.W.tongues.some(alive)) { fired = i; break; } }
const qB = ctx.W.tongues.find(alive);
console.log("  B 出手用了 " + (fired / 60).toFixed(2) + "s，舌头主人是 " + (qB ? (qB.owner === lkD ? "B" : "A") : "无"));
chk(!!qB && qB.owner === lkD, "A 一脱战 B 立刻接上（不必等 A 的 5 秒冷却）");

console.log("=== 二、两只舔舐者打不同目标：互不影响 ===");
freshScene();
const civA = ctx.addUnit("civilian", 2300, 1000);
const civB = ctx.addUnit("civilian", 2300, 2000);
const lk1 = ctx.addUnit("licker", 1000, 1000);
const lk2 = ctx.addUnit("licker", 1000, 2000);
ctx.rebuildGrids();
let maxSim2 = 0;
tickWatch(9, () => {
  const n = ctx.W.tongues.filter(alive).length;
  if (n > maxSim2) maxSim2 = n;
});
console.log("  9 秒内同时存在的最多舌头数 = " + maxSim2);
chk(maxSim2 >= 2, "不同目标可以同时被两只舔舐者粘住");

console.log("=== 三、舔舐者的价码 ===");
console.log("  普通丧尸 " + ctx.unitCostOf("zombie") + "，奔跑者 " + ctx.unitCostOf("runner") +
  "，舔舐者 " + ctx.unitCostOf("licker") + "，母体 " + ctx.unitCostOf("mother"));
chk(CFG.econ.killLicker === 20, "配置里舔舐者赏金 20");
chk(ctx.unitCostOf("licker") === 20, "投放一只舔舐者要 20");
chk(ctx.unitCostOf("zombie") === 10, "投放一只普通丧尸要 10");
chk(ctx.unitCostOf("mother") === 100, "投放一只母体要 100");
freshScene();
ctx.W.resources = 1000;
const lkP = ctx.addUnit("licker", 2000, 1200);
ctx.rebuildGrids();
const before = ctx.W.resources;
ctx.killZombie(lkP);
console.log("  击杀舔舐者：资源 " + before + " → " + ctx.W.resources);
chk(ctx.W.resources === before + 20, "打死舔舐者给 20（和投放价一致）");
const zp = ctx.addUnit("zombie", 2100, 1200);
const before2 = ctx.W.resources;
ctx.killZombie(zp);
chk(ctx.W.resources === before2 + 10, "打死普通丧尸还是 10");

console.log("=== 四、丧尸阵营现在能投放了 ===");
freshScene();
ctx.W.resources = 300;
const okz = ctx.doPlace("zombie", 2000, 1200, 3);
const nz = ctx.W.units.filter(u => !u.dead && u.kind === "zombie").length;
console.log("  放 3 只普通丧尸：成功=" + okz + "，场上 " + nz + " 只，剩余资源 " + Math.round(ctx.W.resources));
chk(okz === true, "投放普通丧尸成功（以前直接失败）");
chk(nz === 3, "三只都落地了");
chk(ctx.W.resources === 270, "按 10/只扣了 30");

freshScene();
ctx.W.resources = 300;
const okr = ctx.doPlace("runner", 2000, 1200, 1);
chk(okr === true && ctx.W.units.filter(u => !u.dead && u.kind === "runner").length === 1, "奔跑者也能放");
freshScene();
ctx.W.resources = 300;
const okl = ctx.doPlace("licker", 2000, 1200, 2);
console.log("  放 2 只舔舐者：成功=" + okl + "，剩余资源 " + Math.round(ctx.W.resources));
chk(okl === true && ctx.W.units.filter(u => !u.dead && u.kind === "licker").length === 2, "舔舐者能放");
chk(ctx.W.resources === 260, "按 20/只扣了 40");
freshScene();
ctx.W.resources = 50;
const okm = ctx.doPlace("mother", 2000, 1200, 1);
chk(okm === false && ctx.W.resources === 50, "母体 100 块，资源不够就不放");
freshScene();
ctx.W.resources = 200;
const hotZ = ctx.doPlace("zombie", 2000, 1200, 1);
const fresh = ctx.W.units.filter(u => !u.dead && u.kind === "zombie")[0];
chk(hotZ === true && fresh && fresh.hot === 1, "投放出来的丧尸立刻是活动状态（不会在护送图里装睡）");

console.log("=== 五、舔舐者刷新比例 80 : 1 ===");
let cnt = 0;
const N = 16000;
for (let i = 0; i < N; i++) if (ctx.pickZombieKind() === "licker") cnt++;
const rate = N / cnt;
console.log("  抽 " + N + " 次，舔舐者 " + cnt + " 次，约 " + rate.toFixed(1) + " : 1");
chk(rate > 60 && rate < 105, "比例落在 80 : 1 附近（误差范围内）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));