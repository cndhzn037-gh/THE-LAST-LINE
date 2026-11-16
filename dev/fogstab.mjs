import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
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
const raw = html, CFG = ctx.CFG;

console.log("=== 一、视野朝向有了死区 ===");
chk(typeof ctx.fogAimAngle === "function", "视野朝向逻辑可单独调用");
chk(CFG.fog.deadZone > 0, "死区配置 " + CFG.fog.deadZone + " rad（约 " + Math.round(CFG.fog.deadZone * 57.3) + "°）");

ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(3, 2); ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) u.dead = true;
ctx.cleanup();
ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;

const civ = ctx.addUnit("civilian", 2000, 1200);
civ.faceAng = 0;
ctx.rebuildGrids();
/* 模拟 AI 索敌时的来回摆头：幅度 0.2 rad（小于死区 0.35），一直在抖 */
let changes = 0, prev = null;
for (let i = 0; i < 300; i++) {
  civ.faceAng = Math.sin(i * 0.6) * 0.2;
  const a = ctx.fogAimAngle(civ);
  if (prev !== null && a !== prev) changes++;
  prev = a;
}
console.log("  摆头 300 帧，视野角度变了 " + changes + " 次");
chk(changes === 0, "小幅摆头时视野完全不抖（这就是之前闪烁的根源）");

console.log("=== 二、真的转身会跟上 ===");
civ.faceAng = Math.PI * 0.75;      /* 大角度转向，远超死区 */
const before = ctx.fogAimAngle(civ);
for (let i = 0; i < 90; i++) { civ.faceAng = Math.PI * 0.75; ctx.fogAimAngle(civ); }
const after = ctx.fogAimAngle(civ);
console.log("  转向前 " + before.toFixed(2) + " rad → 90 帧后 " + after.toFixed(2) + " rad（目标 " + (Math.PI * 0.75).toFixed(2) + "）");
chk(Math.abs(after - Math.PI * 0.75) < 0.09, "大角度转身会正常跟过去");

console.log("=== 三、玩家操控的那位必须实时跟手 ===");
ctx.PLAYER.on = true; ctx.PLAYER.unit = civ;
civ.faceAng = 1.0;
const pa = ctx.fogAimAngle(civ);
console.log("  玩家转头到 1.00，视野角度 " + pa.toFixed(3));
chk(Math.abs(pa - 1.0) < 0.02, "玩家视野没有滞后（不能被死区拖住）");
ctx.PLAYER.on = false; ctx.PLAYER.unit = null;

console.log("=== 四、角度量化到 1° ===");
const step = 0.01745;
let offGrid = 0;
for (let i = 0; i < 400; i++) {
  civ.faceAng = (i * 0.137) % (Math.PI * 2);
  const a = ctx.fogAimAngle(civ);
  if (Math.abs(a / step - Math.round(a / step)) > 1e-6) offGrid++;
}
chk(offGrid === 0, "返回的角度都在 1° 网格上");
chk(raw.indexOf("Math.round(u.fogAng / 0.01745)") >= 0, "量化就写在这一处");

console.log("=== 五、单位本身不遮挡视线 ===");
chk(raw.indexOf("function fogRay") >= 0, "视线射线是独立的函数");
const raySrc = raw.slice(raw.indexOf("function fogRay"), raw.indexOf("function drawFog"));
chk(raySrc.indexOf("NAV.visBlock") >= 0, "射线只查实心墙网格");
chk(raySrc.indexOf("W.units") < 0 && raySrc.indexOf("HUMGRID") < 0 && raySrc.indexOf("ZGRID") < 0,
  "射线完全不看单位 —— 队友不会挡住你的视线");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));