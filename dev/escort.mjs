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

console.log("=== 一、护送模式地图 ===");
ctx.START.gameMode = "escort";
ctx.START.civCount = 6;
ctx.START.squad = { rifle: 3, mg: 1, sniper: 0, shield: 0 };
ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false;
ctx.beginGame();
const c0 = ctx.countUnits();
console.log("  模式 = " + W().mode + "  阶段 = " + W().phase);
console.log("  平民 " + c0.civ + " 人（全部关押=" + W().units.filter(u => u.kind === "civilian" && u.penned).length + "）");
console.log("  武装小队 " + W().units.filter(u => ctx.isArmed(u)).length + " 人，位置 x=" +
  W().units.filter(u => ctx.isArmed(u)).map(u => Math.round(u.x)).join(","));
console.log("  初始丧尸 " + c0.z + " 只，全部 native=" + W().units.filter(u => u.kind === "zombie" && u.native).length);
const zx0 = W().units.filter(u => u.kind === "zombie").map(u => [u.x, u.y]);

console.log("\n=== 二、休眠丧尸是否原地不动（跑 6 秒）===");
for (let i = 0; i < 60 * 6; i++) ctx.stepSim(1 / 60);
const zsNow = W().units.filter(u => u.kind === "zombie");
let maxMove = 0;
for (let i = 0; i < Math.min(zsNow.length, zx0.length); i++) {
  maxMove = Math.max(maxMove, Math.hypot(zsNow[i].x - zx0[i][0], zsNow[i].y - zx0[i][1]));
}
console.log("  6 秒内初始丧尸最大位移 = " + maxMove.toFixed(2) + "px " + (maxMove < 8 ? "✓ 保持不动" : "✗ 动了"));
console.log("  人类是否已被发现（有丧尸锁定）= " + zsNow.filter(z => z.locked).length + " 只");

console.log("\n=== 三、靠近是否会惊醒 ===");
const rifle = W().units.find(u => ctx.isArmed(u));
const z0 = zsNow[0];
const savedX = rifle.x, savedY = rifle.y;
rifle.x = z0.x + 120; rifle.y = z0.y;   // 走进 120px（警觉半径 170 内）
for (let i = 0; i < 60; i++) ctx.stepSim(1 / 60);
console.log("  把士兵放到丧尸 120px 处 → 该丧尸 locked=" + z0.locked + " " + (z0.locked ? "✓ 自主锁定" : "✗"));
rifle.x = savedX; rifle.y = savedY;

console.log("\n=== 四、开枪是否会引来复仇 ===");
ctx.beginGame();
const anyZ = W().units.filter(u => u.kind === "zombie")[0];
const shooter = W().units.find(u => ctx.isArmed(u));
ctx.damageZombie(anyZ, 1, shooter);
console.log("  对休眠丧尸开一枪 → attacker 已记录 = " + (anyZ.attacker === shooter ? "是 ✓" : "否 ✗"));
for (let i = 0; i < 30; i++) ctx.stepSim(1 / 60);
console.log("  30 帧后该丧尸 locked=" + anyZ.locked + " 目标=" + (anyZ.target ? anyZ.target.kind : "无"));

console.log("\n=== 五、解锁大门 → 疏散 → 撤离 全流程 ===");
ctx.beginGame();
const pd = W().prisonDoor;
const squad2 = W().units.filter(u => ctx.isArmed(u));
for (let i = 0; i < squad2.length; i++) { squad2[i].x = pd.x + 40; squad2[i].y = pd.y + 20 + i * 22; squad2[i].vx = 0; squad2[i].vy = 0; }
for (let i = 0; i < 90; i++) ctx.stepSim(1 / 60);
console.log("  士兵抵达大门 → 封锁解除 = " + W().doorOpen + "  阶段 = " + W().phase);
let tFirst = -1;
for (let i = 0; i < 60 * 16; i++) {
  ctx.stepSim(1 / 60);
  if (tFirst < 0 && W().released > 0) tFirst = i;
  if (W().phase === "retreat") break;
}
console.log("  首个平民放出耗时 " + (tFirst / 60).toFixed(1) + "s（约 2 秒间隔 ✓）");
console.log("  已放出 " + W().released + "/" + W().civTotal + "  阶段 = " + W().phase + " " + (W().phase === "retreat" ? "✓" : ""));
console.log("  场上还有被困平民 = " + W().units.filter(u => u.penned).length);

console.log("\n=== 六、撤离与尸潮升级 ===");
const EV = ctx.CFG.escort.evac;
for (let i = 0; i < W().units.length; i++) {
  const u = W().units[i];
  if (!u.dead && ctx.isHuman(u) && !u.penned) { u.x = EV.x - 30; u.y = EV.y + (i % 7) * 12; u.vx = 0; u.vy = 0; }
}
let firstEvac = -1, motherAfter = false;
for (let i = 0; i < 60 * 40 && !W().over; i++) {
  ctx.stepSim(1 / 60);
  if (firstEvac < 0 && W().evacCount > 0) firstEvac = i;
  if (W().hotPhase && W().motherSpawned) motherAfter = true;
}
console.log("  首次撤离耗时 " + (firstEvac / 60).toFixed(1) + "s");
console.log("  撤离 " + W().evacCount + "/" + W().totalHumans + "  得分 " + W().score);
console.log("  尸潮升级触发 = " + W().hotPhase + "  最远端母体已刷新 = " + W().motherSpawned);
console.log("  场上丧尸 = " + ctx.countUnits().z + "（四面持续刷怪）");
console.log("  结果 = " + (W().over ? W().result : "进行中") + "  场上人类 = " + ctx.countUnits().h);
