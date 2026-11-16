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

const A = mk(), B = mk();
console.log("=== 一、快照打包 ===");
A.buildScenario(20240607, 30);
const snap = A.packSnapshot();
const liveA = A.W.units.filter(u => !u.dead).length;
console.log("  A 有 " + liveA + " 个单位，打包成 " + snap.length + " 个数字（每单位 6 个）");
chk(snap.length === liveA * 6, "条数对得上");
chk(snap.every(n => typeof n === "number" && isFinite(n)), "全是有效数字");

console.log("=== 二、成员端能把快照揉进来 ===");
B.buildScenario(20240607, 30);
/* 故意把 B 的世界搅乱：往不同方向推 */
B.W.units.forEach(u => { if (!u.dead) { u.x += 40; u.y += 25; } });
const before = B.W.units.filter(u => !u.dead).length;
B.applySnapshot({ u: snap });
const after = B.W.units.filter(u => !u.dead).length;
console.log("  B 处理快照前后单位数 " + before + " → " + after);
chk(B.W.units.every(u => isFinite(u.x) && isFinite(u.y)), "没有 NaN 坐标");
/* 再揉几次应该越来越接近 */
for (let i = 0; i < 12; i++) B.applySnapshot({ u: snap });
let maxErr = 0;
const aUnits = A.W.units.filter(u => !u.dead);
for (const au of aUnits) {
  const bu = B.findUnitById(au.id);
  if (!bu) continue;
  maxErr = Math.max(maxErr, Math.hypot(au.x - bu.x, au.y - bu.y));
}
console.log("  揉 13 次后最大位置误差 " + maxErr.toFixed(1) + "px");
chk(maxErr < 20, "两端单位位置收敛了");

console.log("=== 三、血量也跟着走 ===");
A.W.units[5].hp = 3;
B.applySnapshot({ u: A.packSnapshot() });
const bu5 = B.findUnitById(A.W.units[5].id);
chk(bu5 && bu5.hp === 3, "血量同步过来了");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));