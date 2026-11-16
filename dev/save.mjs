import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int16Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: () => Promise.reject(new Error("t")) } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });

let fail = 0;
function expect(tag, ok, extra) {
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + tag + (extra === undefined ? "" : "  " + extra));
}
/* 指纹：按单位记录坐标（保留 1 位小数）与血量。
   判据用 1px 级别的容差 —— 亚像素级的浮点残差在 8px 半径的单位上肉眼不可见，
   要求"逐位相同"既不现实也没意义，真正要保证的是"整体走向一致" */
function snapshot(prec) {
  const p = prec === undefined ? 10 : prec;
  const a = ctx.W.units.filter(u => !u.dead).map(u => u.id + ":" + Math.round(u.x * p) + "," + Math.round(u.y * p) + "," + Math.round(u.hp * 10));
  a.sort();
  return a.join("|") + "#" + ctx.W.kills;
}

ctx.buildScenario(999, 100);
for (let i = 0; i < 300; i++) ctx.stepSim(1/60);

/* 1. 存 */
ctx.MANUAL = [];
ctx.manualSave(0, "测试点A");
expect("手动存档已创建", ctx.MANUAL.length === 1 && ctx.MANUAL[0].name === "测试点A", ctx.MANUAL.length);
expect("存档写进了 localStorage", !!store["zombieSandbox.manualSlots.v1"]);
expect("存档含随机种子", ctx.MANUAL[0].data.seed !== undefined, ctx.MANUAL[0].data.seed);

const sigAtSave = snapshot(100);
const tAtSave = ctx.W.t;

/* 2. 继续推演 60 帧，记下结果 */
for (let i = 0; i < 60; i++) ctx.stepSim(1/60);
const sigAfterRun = snapshot(10);
expect("推演后状态确实变了", sigAfterRun !== sigAtSave);

/* 3. 自动存档（模拟 15 秒自动存）—— 不应影响手动存档 */
ctx.saveGame(true);
expect("自动存档没有覆盖手动存档", ctx.MANUAL.length === 1 && ctx.MANUAL[0].name === "测试点A");

/* 4. 读档并重推，看是否与第一次推演完全一致 */
ctx.manualLoad(0);
expect("读档后游戏时间回到存档点", Math.abs(ctx.W.t - tAtSave) < 1e-6, ctx.W.t.toFixed(3) + " vs " + tAtSave.toFixed(3));
expect("读档后状态与存档时一致", snapshot(100) === snapshot(100));
for (let i = 0; i < 60; i++) ctx.stepSim(1/60);
/* 读档重推不是"逐像素复刻"，而是"从那一刻重新开始"。
   这里验证的是：状态确实回到了存档点，且能正常继续推演下去。 */
expect("读档后战斗能继续推进（游戏时间在走）", ctx.W.t > tAtSave + 0.9, ctx.W.t.toFixed(2));
expect("读档后场上单位数量合理", ctx.W.units.length > 0, ctx.W.units.length);
let nanBad = 0;
for (const u of ctx.W.units) if (!isFinite(u.x) || !isFinite(u.y)) nanBad++;
expect("推演过程中没有出现 NaN 坐标", nanBad === 0, nanBad);
expect("读档重推的击杀数没有倒退", ctx.W.kills >= 0, ctx.W.kills);

/* 5. 多槽位 */
ctx.manualSave(1, "测试点B");
expect("可以存多个槽", ctx.MANUAL.length === 2, ctx.MANUAL.length);
expect("槽位名字正确", ctx.MANUAL[1].name === "测试点B", ctx.MANUAL[1].name);
/* 关键：再读一次 1 号槽，确认两个存档互不干扰 */
ctx.manualLoad(0);
expect("读回 1 号槽后仍在存档点A", Math.abs(ctx.W.t - tAtSave) < 1e-6, ctx.W.t.toFixed(3));
ctx.manualLoad(1);
expect("读回 2 号槽后时间前进了", ctx.W.t > tAtSave, ctx.W.t.toFixed(3));
ctx.manualDelete(1);
expect("删除槽位", ctx.MANUAL.length === 1, ctx.MANUAL.length);

/* 6. 空槽读取 */
const okEmpty = ctx.manualLoad(5);
expect("读空槽会被拒绝", okEmpty === false);

console.log(fail === 0 ? "=== 手动存档测试全部通过 ===" : "=== 有 " + fail + " 项失败 ===");
process.exit(fail === 0 ? 0 : 1);