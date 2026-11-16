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
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function zs() { return W().units.filter(u => ctx.isZombie(u) && !u.dead); }

/* 固定种子 + 固定小队，唯一变量就是营救人数 */
function buildWith(civ) {
  ctx.GAME_MODE = "escort";
  ctx.LAST_CIV_COUNT = civ;
  ctx.LAST_SQUAD = ["rifle", "rifle", "rifle", "rifle", "rifle", "mg"];
  ctx.buildScenario(999, 0);
  return { civ: W().civTotal, scale: ctx.escortThreatScale(), z: zs().length };
}
/* 开门后跑固定时长，统计这一段时间里刷了多少 */
function waveWith(civ, sec) {
  buildWith(civ);
  const door = W().prisonDoor;
  const armed = W().units.find(u => ctx.isArmed(u) && !u.dead);
  armed.x = door.x + door.w / 2; armed.y = door.y + door.h / 2;
  ctx.stepSim(1 / 60);
  const seen = new Set(zs().map(u => u.id));
  let n = 0;
  for (let i = 0; i < Math.round(sec * 60); i++) {
    ctx.stepSim(1 / 60);
    for (const u of zs()) if (!seen.has(u.id)) { seen.add(u.id); n++; }
  }
  return n;
}

console.log("=== 一、威胁倍率随营救人数上升（倍率本身）===");
const scaleRows = [4, 8, 12, 16, 20].map(n => {
  ctx.GAME_MODE = "escort"; ctx.LAST_CIV_COUNT = n;
  ctx.LAST_SQUAD = ["rifle"];
  ctx.buildScenario(999, 0);
  return { n, k: ctx.escortThreatScale() };
});
console.log("  " + scaleRows.map(r => r.n + " 人 → ×" + r.k.toFixed(2)).join("   "));
chk(scaleRows[1].k === 1, "默认 8 名平民是基准 ×1.00");
for (let i = 1; i < scaleRows.length; i++) chk(scaleRows[i].k > scaleRows[i - 1].k, "人数 " + scaleRows[i - 1].n + " → " + scaleRows[i].n + " 倍率上升");
chk(scaleRows[4].k <= CFG.escort.civScaleMax + 1e-9, "倍率有上限（最大 ×" + CFG.escort.civScaleMax + "）");

console.log("\n=== 二、初始休眠尸群随人数放大 ===");
const rows = [4, 8, 16, 20].map(n => buildWith(n));
console.log("  " + rows.map(r => r.civ + " 人 → 初始丧尸 " + r.z + " 只（×" + r.scale.toFixed(2) + "）").join("\n  "));
for (let i = 1; i < rows.length; i++) chk(rows[i].z > rows[i - 1].z, rows[i - 1].civ + " → " + rows[i].civ + " 人：初始尸群增多");
const ratio = rows[rows.length - 1].z / rows[0].z;
console.log("  最少 " + rows[0].civ + " 人与最多 " + rows[rows.length - 1].civ + " 人的尸群比 = " + ratio.toFixed(2) + " 倍");
chk(ratio < 2, "增幅被压住了（最多也就 " + ratio.toFixed(2) + " 倍，不会翻倍）");

console.log("\n=== 三、波次刷新量同样放大 ===");
const w4 = waveWith(4, 9);
const w20 = waveWith(20, 9);
console.log("  开门后 9 秒：4 人局刷了 " + w4 + " 只，20 人局刷了 " + w20 + " 只（比 " + (w20 / Math.max(1, w4)).toFixed(2) + "）");
chk(w20 > w4, "营救人数多的局，波次刷得更多");
chk(w20 / Math.max(1, w4) < 2.2, "波次增幅同样温和（不到 2.2 倍）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
