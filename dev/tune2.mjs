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
const CFG = ctx.CFG;

console.log("=== 一、数值调整 ===");
console.log("  子弹速度 " + CFG.bullet.speed + "（原 5500），机枪散射 " + CFG.mg.spreadDeg + "°（原 14°），狙击弹速倍数 " + CFG.sniper.speedMul);
chk(CFG.bullet.speed < 5500, "子弹速度调低了");
chk(CFG.bullet.speed > 3000, "但没有低到影响手感");
chk(CFG.mg.spreadDeg <= 7.5, "机枪散射角度减半");
chk(CFG.sniper.speedMul === 3, "狙击手有自己的弹速倍数，不受影响");
console.log("  人类最高速度：" + ["civilian","rifle","mg","sniper","shield"].map(k => k + "=" + CFG.unit[k].vmax).join(" "));
chk(CFG.unit.rifle.vmax > 165, "步枪兵最高速提高了");
chk(CFG.unit.civilian.vmax > 132, "平民最高速提高了");
chk(CFG.cruiseMul > 0 && CFG.cruiseMul < 1, "有巡航速度倍率（" + CFG.cruiseMul + "）");

console.log("=== 二、巡航速度：平时走不满，受惊才放开 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 8;
ctx.buildScenario(5, 8);
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) if (isZ(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
ctx.rebuildGrids();
const r1 = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
r1.x = 2000; r1.y = 1200; r1.mateOk = 1;
ctx.aiHuman(r1, 1 / 60);
const cruise = r1.vmaxCur;
console.log("  没威胁时：vmax " + r1.vmax + " → 实际上限 " + cruise.toFixed(1) + "（×" + CFG.cruiseMul + "）");
chk(Math.abs(cruise - r1.vmax * CFG.cruiseMul) < 0.5, "平时按巡航速度走");
const foe = ctx.addUnit("zombie", r1.x + 80, r1.y);
foe.hp = 99999;
ctx.rebuildGrids();
ctx.aiHuman(r1, 1 / 60);
/* 开火中还会叠加 fireSlowMul（0.7），把它除掉才是真正的速度上限 */
const full1 = r1.vmaxCur / (r1.fireHold > 0 ? CFG.fireSlowMul : 1);
console.log("  恐惧圈里有丧尸时：实际上限 " + full1.toFixed(1) + "（已扣掉开火减速 " +
  (r1.fireHold > 0 ? CFG.fireSlowMul : 1) + "）");
chk(Math.abs(full1 - r1.vmax) < 1, "受惊时放开到最高速");
chk(full1 > cruise * 1.2, "受惊限速明显高于巡航限速");

console.log("=== 三、掉队补偿：离队太远也会跑满 ===");
for (const u of ctx.W.units) if (isZ(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
r1.x = 2000; r1.y = 1200; r1.mateOk = 0;
ctx.rebuildGrids();
ctx.aiHuman(r1, 1 / 60);
const full3 = r1.vmaxCur / (r1.fireHold > 0 ? CFG.fireSlowMul : 1);
console.log("  掉队（mateOk=0）时：实际上限 " + full3.toFixed(1) + "，strayed=" + r1.strayed);
chk(Math.abs(full3 - r1.vmax) < 1, "掉队时放开到最高速去追");

console.log("=== 四、后坐力抵消 ===");
console.log("  抵消倍率 counterMul = " + CFG.recoil.counterMul + "（原来只在身边没丧尸时按 undoMul=" + CFG.recoil.undoMul + " 补）");
chk(CFG.recoil.counterMul > 0 && CFG.recoil.counterMul < 1, "连射抵消倍率 < 1（堪堪持平，不抹掉后坐力）");
/* 单发回正只在"身边没有丧尸"时生效，先把丧尸挪远 */
for (const u of ctx.W.units) if (isZ(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
ctx.rebuildGrids();
r1.state = "engage"; r1.ax = 0; r1.ay = 0;
r1.recoilT = 0.1; r1.recoilX = 1; r1.recoilY = 0;
ctx.aiHuman(r1, 1 / 60);
const axOn = r1.ax;
/* 单发回正靠的是 recoilT 窗口（undoMul），不是连射倍率 —— 所以拿"有后坐力 / 没后坐力"对比 */
r1.state = "engage"; r1.ax = 0; r1.ay = 0;
r1.recoilT = 0;
ctx.aiHuman(r1, 1 / 60);
const axOff = r1.ax;
console.log("  抵消项：开 " + axOn.toFixed(0) + " / 关 " + axOff.toFixed(0) + " px/s²（差 " + (axOn - axOff).toFixed(0) + "）");
chk(axOn - axOff > 100, "单发（步枪）仍然按单位加速度把速度顶回来");
ctx.CFG.recoil.counterMul = 0.85;

console.log("=== 五、护送模式的改动都在 ===");
const raw = html;
chk(raw.indexOf("escortWingSpot") >= 0, "有撤离阶段的两翼岗位函数");
chk(raw.indexOf("wingDist") >= 0 && raw.indexOf("wingBack") >= 0, "两翼距离与落后量可配");
chk(raw.indexOf("pressOn") >= 0, "撤离阶段坚持前压的参数在");
chk(CFG.escort.pressOn > 0.5, "前压权重 " + CFG.escort.pressOn + "（超过一半的方向留给撤离点）");
chk(raw.indexOf("sob") >= 0 && raw.indexOf("!ally && W.mode === \"escort\"") >= 0, "盾兵没队友时会朝目标点撤，不再原地等死");
chk(CFG.escort.wingDist > 60, "两翼距离 " + CFG.escort.wingDist + "px");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
