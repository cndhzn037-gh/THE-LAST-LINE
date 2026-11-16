import fs from "node:fs";
import vm from "node:vm";
const file = process.argv[2];
const html = fs.readFileSync(file, "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
function ctxStub() {
  const base = { canvas: null, globalCompositeOperation: "source-over", fillStyle: "", strokeStyle: "",
    lineWidth: 1, globalAlpha: 1, font: "", textAlign: "", shadowBlur: 0,
    createLinearGradient: function () { return { addColorStop: noop }; },
    createRadialGradient: function () { return { addColorStop: noop }; } };
  return new Proxy(base, { get(t, p) { if (p in t) return t[p]; return noop; }, set(t, p, v) { t[p] = v; return true; } });
}
const ctxs = ctxStub();
function makeEl(id) {
  return { id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [],
    width: 800, height: 600, addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop,
    setAttribute: noop, getAttribute: function () { return null; }, click: noop,
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 800, height: 600 }; },
    getContext: function () { return ctxs; }, querySelectorAll: function () { return []; }, querySelector: function () { return null; } };
}
const els = {}, store = {};
const sandbox = {
  console: console, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
  isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat, Infinity: Infinity, NaN: NaN,
  Uint8Array: Uint8Array, Int32Array: Int32Array, Float32Array: Float32Array,
  Map: Map, Set: Set, Error: Error, setTimeout: noop, clearTimeout: noop,
  requestAnimationFrame: function () { return 1; },
  localStorage: { getItem: function (k) { return store[k] ?? null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
  document: { getElementById: function (id) { return els[id] || (els[id] = makeEl(id)); },
    createElement: function (t) { return makeEl("new-" + t); }, querySelectorAll: function () { return []; }, body: { appendChild: noop } }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.innerWidth = 1280;
sandbox.window.innerHeight = 720;
sandbox.window.devicePixelRatio = 1;
sandbox.window.addEventListener = noop;
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx, { filename: "game.js" });

let fail = 0;
function expect(tag, ok, extra) {
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + tag + (extra === undefined ? "" : "  " + extra));
}
function zcount() { let n = 0; for (const u of ctx.W.units) if (!u.dead && ctx.isZombieSide(u)) n++; return n; }
function kindCount(k) { let n = 0; for (const u of ctx.W.units) if (!u.dead && u.kind === k) n++; return n; }

console.log("CFG.caps.zombies = " + ctx.CFG.caps.zombies);

// 清场
ctx.W.units.length = 0;
ctx.W.over = false;
ctx.W.waves = null;

const S = ctx.START;
S.waveMode = true; S.waveCount = 3; S.waveFirst = 10; S.waveGap = 20; S.waveSize = 15;

ctx.startWaves();
expect("波次已启动", !!ctx.W.waves);
expect("剩余波数 3", ctx.W.waves.left === 3, ctx.W.waves.left);
expect("首波 10 秒", Math.abs(ctx.W.waves.t - 10) < 1e-9, ctx.W.waves.t);

const STEP = 1 / 60;
function run(sec) { for (let i = 0; i < Math.round(sec / STEP); i++) ctx.stepWaves(STEP); }

run(9.5);
expect("9.5 秒时还没刷怪", zcount() === 0, "丧尸=" + zcount());

run(0.6);
expect("首波刷出 15 只", zcount() === 15, "丧尸=" + zcount());
expect("剩余波数 2", ctx.W.waves.left === 2, ctx.W.waves.left);
expect("下一波间隔 20 秒", Math.abs(ctx.W.waves.t - 20) < 0.2, ctx.W.waves.t.toFixed(2));

run(20.2);
expect("第二波后共 30 只", zcount() === 30, "丧尸=" + zcount());

run(20.2);
expect("第三波后共 45 只", zcount() === 45, "丧尸=" + zcount());
expect("波次全部用尽", ctx.W.waves.left === 0, ctx.W.waves.left);
const before = zcount();
run(120);
expect("波次用尽后不再刷怪", zcount() === before, "丧尸=" + zcount());

// 兵种比例：普通 : 奔跑者 = 20 : 1
ctx.W.units.length = 0;
ctx.W.waves = null;
S.waveCount = 1; S.waveFirst = 1; S.waveSize = 400;
ctx.startWaves();
run(1.2);
const total = zcount();
const mothers = kindCount("mother");
expect("大规模波次刷出 400 只 + 4 只母体", total === 404, "总=" + total + " 母体=" + mothers);
expect("母体按每 81 只掺 1（400/81≈4）", mothers >= 3 && mothers <= 5, "母体=" + mothers);

// 兵种比例用大样本直接测 pickZombieKind（波次正是调它取兵种）
let rr = 0;
for (let i = 0; i < 20000; i++) if (ctx.pickZombieKind() === "runner") rr++;
const ratio = rr / 20000;
expect("兵种比例沿用投放：普通 20 : 奔跑者 1", ratio > 0.035 && ratio < 0.062,
  (ratio * 100).toFixed(2) + "%  期望 " + (100 / 21).toFixed(2) + "%");

// 波次用尽后 stepWaves 空转
ctx.W.waves.left = 0;
let ok = true;
try { run(5); } catch (e) { ok = false; console.log("  " + e.message); }
expect("波次结束后 stepWaves 不报错", ok);

console.log(fail === 0 ? "=== 波次测试全部通过 ===" : "=== 有 " + fail + " 项失败 ===");
process.exit(fail === 0 ? 0 : 1);