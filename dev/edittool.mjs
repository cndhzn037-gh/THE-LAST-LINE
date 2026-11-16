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
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }

console.log("=== 一、所有兵种都能在编辑器里放置 ===");
const kinds = Object.keys(ctx.CFG.unit);
console.log("  CFG.unit 里共 " + kinds.length + " 个兵种：" + kinds.join(", "));
for (const k of kinds) {
  chk(ctx.isUnitTool(k), "「" + ctx.CFG.unit[k].name + "」(" + k + ") 可放置");
}

console.log("=== 二、非兵种不会被误判 ===");
["sandbag", "house", "low", "erase", "pan", ""].forEach(t => {
  chk(!ctx.isUnitTool(t), "「" + t + "」不算兵种工具");
});

console.log("=== 三、真放得下 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(3, 2); ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) u.dead = true;
ctx.cleanup();
ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
ctx.rebuildGrids();
ctx.EDIT.active = true;
const before = ctx.W.units.filter(u => !u.dead).length;
ctx.editPlaceUnit("medic", 2000, 1200);
ctx.editPlaceUnit("runner", 2100, 1200);
ctx.editPlaceUnit("licker", 2200, 1200);
ctx.editPlaceUnit("bomber", 2300, 1200);
const placed = ctx.W.units.filter(u => !u.dead);
console.log("  放置了 " + (placed.length - before) + " 个单位：" + placed.map(u => u.kind).join(", "));
chk(placed.filter(u => u.kind === "medic").length === 1, "医疗兵放下来了");
chk(placed.filter(u => u.kind === "runner").length === 1, "奔跑者放下来了");
chk(placed.filter(u => u.kind === "licker").length === 1, "舔舐者放下来了");
chk(placed.filter(u => u.kind === "bomber").length === 1, "自爆丧尸放下来了");

console.log("=== 四、编辑后的单位会被记进快照 ===");
chk(ctx.EDIT.unitsEdited === true, "标记为已编辑");
ctx.snapshotEditUnits();
const snapKinds = ctx.EDIT.units.map(u => u.kind);
chk(snapKinds.indexOf("medic") >= 0 && snapKinds.indexOf("bomber") >= 0, "蓝图里带上了新兵种");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));