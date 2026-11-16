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
const CFG = ctx.CFG;

console.log("=== 后坐力抵消应当「堪堪持平」，不是完全抹掉 ===");
function rateOf(kind, mulKey) {
  const base = kind === "mg" ? CFG.mg : (kind === "sniper" ? CFG.sniper : CFG.far);
  const rkMul = CFG.recoil[kind] || 0;
  const rk = rkMul * CFG.recoil.unit;
  const rate = rk / Math.max(0.015, base.interval);
  return { rk: rk, rate: rate, counter: rate * CFG.recoil.counterMul };
}
for (const k of ["rifle", "mg", "sniper"]) {
  const o = rateOf(k);
  const net = o.rate - o.counter;
  console.log("  " + k.padEnd(6) + " 单发推力 " + o.rk.toFixed(0).padStart(4) + " px/s  平均推力率 " +
    o.rate.toFixed(0).padStart(5) + " px/s²  抵消 " + o.counter.toFixed(0).padStart(5) +
    "  净剩 " + net.toFixed(0) + " px/s²");
  chk(o.counter < o.rate, k + "：抵消小于推力（还会被推着走）");
  chk(o.counter > o.rate * 0.6, k + "：抵消又不至于形同虚设");
}
const mgNet = rateOf("mg").rate - rateOf("mg").counter;
console.log("  机枪净剩推力 " + mgNet.toFixed(0) + " px/s²（原来 counterMul=5 时是负的，等于完全抵消）");
chk(mgNet > 0, "机枪兵不再能顶着满额后坐力高速前压");

console.log("=== 抵消量与单位加速度无关 ===");
chk(CFG.recoil.counterMul > 0.5 && CFG.recoil.counterMul < 1, "倍率 " + CFG.recoil.counterMul + "（小于 1）");
const raw = html;
chk(raw.indexOf("recoilRate") >= 0, "有了按枪计算的平均推力率字段");
chk(raw.indexOf("u.acc * cmul") < 0, "不再用单位加速度当抵消量");

console.log("=== 平民不会在逼近时站死原地 ===");
chk(raw.indexOf("s.dNear < fearR * fearR * 0.55") >= 0, "站定判定加了「最近丧尸太近就不许站住」的兜底");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
