import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
function mk() {
  const els = {}; const store = {};
  const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
    Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
  sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720;
  sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
  sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
  sb.location = { protocol: "https:" };
  const ctx = vm.createContext(sb);
  vm.runInContext(gcode, ctx, { filename: "game.js" });
  return ctx;
}
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }

console.log("=== 一、同步函数存在 ===");
const A = mk(), B = mk();
chk(typeof A.netApplySync === "function", "有 netApplySync");
chk(typeof A.netSendSync === "function", "有 netSendSync");

console.log("=== 二、同一个种子构建出同一个世界 ===");
const SEED = 20240607;
A.buildScenario(SEED, 200);
B.buildScenario(SEED, 200);
const ha = A.LOCK.hash(), hb = B.LOCK.hash();
console.log("  A 指纹 " + ha);
console.log("  B 指纹 " + hb);
chk(ha === hb, "同种子开局，两端指纹完全相同");

console.log("=== 三、不同种子确实不同（反过来证明指纹有用）===");
B.buildScenario(SEED + 1, 200);
const hc = B.LOCK.hash();
console.log("  种子+1 后 B 指纹 " + hc);
chk(hc !== ha, "换个种子指纹就变");

console.log("=== 四、跑 300 帧后仍然一致 ===");
A.buildScenario(SEED, 200);
B.buildScenario(SEED, 200);
A.LOCK.reset(); B.LOCK.reset();
for (let i = 0; i < 300; i++) { A.stepSim(1 / 60); B.stepSim(1 / 60); }
const ha2 = A.LOCK.hash(), hb2 = B.LOCK.hash();
console.log("  300 帧后 A " + ha2);
console.log("  300 帧后 B " + hb2);
chk(ha2 === hb2, "跑 5 秒后两端仍然逐位一致");

console.log("=== 五、走一遍锁步命令 ===");
A.buildScenario(SEED, 100);
B.buildScenario(SEED, 100);
A.LOCK.reset(); B.LOCK.reset();
A.LOCK.on = true; B.LOCK.on = true;
A.W.resources = 9999; B.W.resources = 9999;
/* A 下达一条投放命令，手工转给 B（模拟网络投递） */
const cmd = { c: "place", kind: "rifle", x: 1500, y: 1200, n: 3 };
A.LOCK.issue(cmd);
B.LOCK.receive(JSON.parse(JSON.stringify(cmd)));
for (let i = 0; i < 12; i++) { A.stepSim(1 / 60); B.stepSim(1 / 60); }
const ha3 = A.LOCK.hash(), hb3 = B.LOCK.hash();
console.log("  命令执行后 A " + ha3);
console.log("  命令执行后 B " + hb3);
chk(ha3 === hb3, "同一个命令在两端执行后状态一致");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));