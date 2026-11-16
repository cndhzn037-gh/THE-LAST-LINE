import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
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
vm.runInContext(code, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }
function zc() { return ctx.W.units.filter(u => !u.dead && isZ(u)).length; }
function hc() { return ctx.W.units.filter(u => !u.dead && ctx.isHuman(u) && !ctx.isZombieSide(u)).length; }
function newScenario(seed) {
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
  ctx.LAST_ZOMBIE_COUNT = 30;
  ctx.buildScenario(seed, 30);
  ctx.W.over = false; ctx.W.result = ""; ctx.W.waves = null;
}
function clearZombies() {
  for (const u of ctx.W.units) if (isZ(u)) u.dead = true;
  ctx.cleanup();
}

console.log("=== 一、没开波次时：场上清空立刻判胜（原行为） ===");
newScenario(7);
clearZombies();
console.log("  丧尸 " + zc() + " 只，人类 " + hc() + " 名");
chk(zc() === 0, "确实把丧尸清空了");
ctx.checkEnd();
chk(ctx.W.over && ctx.W.result === "win", "无波次模式：清空即胜（保持原样）");

console.log("\n=== 二、波次模式：还有波次没刷出来，清空不算胜 ===");
newScenario(7);
clearZombies();
ctx.W.waves = { left: 3, gap: 45, size: 20, t: 12, idx: 1 };
ctx.checkEnd();
console.log("  剩余波次 " + ctx.W.waves.left + "，场上丧尸 " + zc() + " 只");
chk(!ctx.W.over, "前一波打完、后一波没到时不会被判胜");

console.log("\n=== 三、最后一波投放完毕后清空才通关 ===");
ctx.W.over = false; ctx.W.result = "";
ctx.W.waves = { left: 0, gap: 45, size: 20, t: 0, idx: 4 };
ctx.checkEnd();
chk(ctx.W.over && ctx.W.result === "win", "波次全部投放完毕 + 场上清空 = 通关");

console.log("\n=== 四、波次途中人类全灭：仍然立刻判负 ===");
newScenario(7);
ctx.W.waves = { left: 2, gap: 45, size: 20, t: 30, idx: 1 };
for (const u of ctx.W.units) if (ctx.isHuman(u) && !ctx.isZombieSide(u)) u.dead = true;
ctx.cleanup();
ctx.checkEnd();
chk(ctx.W.over && ctx.W.result === "lose", "人类死绝时不等到波次结束就判负");

console.log("\n=== 五、stepWaves 按设定推进 ===");
newScenario(7);
clearZombies();
ctx.START.waveCount = 3; ctx.START.waveFirst = 1; ctx.START.waveGap = 1; ctx.START.waveSize = 5;
ctx.startWaves();
console.log("  开局：剩余 " + ctx.W.waves.left + " 波，倒计时 " + ctx.W.waves.t.toFixed(0) + "s");
chk(ctx.W.waves.left === 3, "波次数与设置一致");
ctx.checkEnd();
chk(!ctx.W.over, "首波还没来、场上空着也不判胜");
const n0 = zc();
for (let i = 0; i < 100; i++) ctx.stepWaves(0.1);
console.log("  跑 10 秒：已投放 " + ctx.W.waves.idx + " 波，剩余 " + ctx.W.waves.left + " 波，场上丧尸 " + zc() + " 只");
chk(ctx.W.waves.idx >= 2, "到点后确实刷出了波次（" + ctx.W.waves.idx + " 波）");
chk(zc() > n0, "丧尸数量增加了（" + n0 + " → " + zc() + "）");
chk(!ctx.W.over, "波次没放完之前不会结束");

console.log("\n=== 六、波次没放完时打空全场 ===");
clearZombies();
ctx.checkEnd();
const left = ctx.W.waves.left;
console.log("  场上丧尸 " + zc() + " 只，剩余波次 " + left);
if (left > 0) chk(!ctx.W.over, "还剩 " + left + " 波 → 不结束");
else chk(ctx.W.over && ctx.W.result === "win", "已放完 → 判胜");
for (let i = 0; i < 200; i++) ctx.stepWaves(0.1);
clearZombies();
ctx.checkEnd();
console.log("  再次清空后：剩余波次 " + ctx.W.waves.left + "，结果 " + (ctx.W.result || "未结束"));
chk(ctx.W.over && ctx.W.result === "win", "全部波次投放完 + 清空 = 通关");

console.log("\n=== 七、本波清光即刻召唤下一波 ===");
newScenario(7);
clearZombies();
ctx.START.waveCount = 3; ctx.START.waveFirst = 1; ctx.START.waveGap = 60; ctx.START.waveSize = 4;
ctx.startWaves();
for (let i = 0; i < 12; i++) ctx.stepWaves(0.1);   // 1.2 秒，首波落地
console.log("  首波投放后：idx=" + ctx.W.waves.idx + "，剩余倒计时 " + ctx.W.waves.t.toFixed(0) + "s，场上 " + zc() + " 只");
chk(ctx.W.waves.idx === 1, "首波已经刷出");
chk(ctx.W.waves.t > 50, "距离下一波还有将近一个间隔（" + ctx.W.waves.t.toFixed(0) + "s）");
const before = ctx.W.waves.t;
for (let i = 0; i < 10; i++) ctx.stepWaves(0.1);
console.log("  丧尸还活着时再跑 1 秒：倒计时 " + ctx.W.waves.t.toFixed(0) + "s（没有跳波）");
chk(ctx.W.waves.idx === 1, "本波没清光，不会提前");
clearZombies();
for (let i = 0; i < 6; i++) ctx.stepWaves(0.1);
console.log("  清光后再跑 0.6 秒：idx=" + ctx.W.waves.idx + "，剩余 " + ctx.W.waves.left + " 波，场上 " + zc() + " 只");
chk(ctx.W.waves.idx === 2, "清光后立刻召唤了第 2 波（省掉 " + before.toFixed(0) + "s 等待）");
chk(ctx.W.waves.t > 50, "新一波照样从完整间隔开始计时");
clearZombies();
for (let i = 0; i < 6; i++) ctx.stepWaves(0.1);
console.log("  再清光：idx=" + ctx.W.waves.idx + "，剩余 " + ctx.W.waves.left + " 波");
chk(ctx.W.waves.idx === 3 && ctx.W.waves.left === 0, "第 3 波也提前刷出，波次用尽");
clearZombies();
ctx.checkEnd();
chk(ctx.W.over && ctx.W.result === "win", "全部波次打完 + 清空 = 通关");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
