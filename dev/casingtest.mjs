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
    getContext: function () { return ctxs; }, querySelectorAll: function () { return []; } };
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

if (typeof ctx.fireBullet !== "function") { console.error("FAIL: fireBullet 不是全局函数"); process.exit(1); }

let shells = 0;
ctx.addShell = function () { shells++; };

const fake = { x: 100, y: 100, r: 8, kind: "mg", vx: 0, vy: 0, vmaxBoost: 0, boostT: 0,
  aimAng: 0, aimT: 0, faceAng: 0, recoilX: 0, recoilY: 0, recoilT: 0, mag: 999 };
const tgt = { x: 300, y: 100 };

function run(n, chain, snipe, auto) {
  shells = 0;
  fake.shellN = 0;
  for (let i = 0; i < n; i++) ctx.fireBullet(fake, tgt, 0, 1, 1, chain, snipe, auto);
  return shells;
}

let fail = 0;
function expect(tag, got, want) {
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + tag + "  弹壳=" + got + " 期望=" + want);
}

expect("机枪连射 10 发", run(10, true, false, true), 5);
expect("机枪连射 9 发", run(9, true, false, true), 4);
expect("机枪连射 1 发", run(1, true, false, true), 0);
expect("机枪连射 2 发", run(2, true, false, true), 1);
expect("狙击单发 5 发", run(5, false, true, false), 5);
expect("狙击单发 1 发", run(1, false, true, false), 1);
expect("步枪远射 4 发", run(4, undefined, undefined, undefined), 4);
expect("步枪速射 8 发", run(8, undefined, undefined, true), 4);
expect("手枪单发 6 发", run(6, false, false, false), 6);
expect("手枪单发 1 发", run(1, false, false, false), 1);
expect("手枪连打 2 秒(约2发)", run(2, false, false, false), 2);

// 连射后转单发：计数应当清零，单发立刻产出
shells = 0;
fake.shellN = 0;
for (let i = 0; i < 3; i++) ctx.fireBullet(fake, tgt, 0, 1, 1, true, false, true);
const afterAuto = shells;
for (let i = 0; i < 2; i++) ctx.fireBullet(fake, tgt, 0, 1, 1, false, false, false);
expect("连射3发(" + afterAuto + ")后单发2发", shells - afterAuto, 2);

console.log(fail === 0 ? "=== 弹壳测试全部通过 ===" : "=== 有 " + fail + " 项失败 ===");
process.exit(fail === 0 ? 0 : 1);