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
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }

console.log("=== 一、医疗兵现在能分到护卫 ===");
ctx.START.squad = { rifle: 3, mg: 1, sniper: 0, shield: 0, medic: 2 };
ctx.LAST_SQUAD = ctx.expandSquad(ctx.START.squad);
ctx.buildEscortScenario(20240607, 6, ctx.LAST_SQUAD);
ctx.W.over = false; ctx.W.paused = false;
ctx.rebalanceGuards();   /* 开局时会定期调用，测试里手动触发一次 */
const medics = ctx.W.units.filter(u => !u.dead && u.kind === "medic");
const civs = ctx.W.units.filter(u => !u.dead && u.kind === "civilian");
console.log("  场上：医疗兵 " + medics.length + " 人，平民 " + civs.length + " 人");
chk(medics.length === 2, "两名医疗兵都在");
chk(medics.every(m => m.guardOf && !m.guardOf.dead), "每个医疗兵都分到了护卫（以前全是 null）");
chk(civs.every(c => c.guardOf && !c.guardOf.dead), "平民的护卫关系没被破坏");

console.log("=== 二、撤离阶段会往撤离点走 ===");
/* 直接切到撤离阶段，把所有人放到离撤离点较远的地方 */
ctx.W.phase = "retreat";
const EV = ctx.curEvac();
medics.forEach(m => { m.x = EV.x - 420; m.y = EV.y + 120; m.routeIdx = -1; });
ctx.rebuildGrids();
const d0 = medics.map(m => Math.hypot(m.x - EV.x, m.y - EV.y));
console.log("  起步距离： " + d0.map(d => Math.round(d)).join(" / "));
tick(3.0);
const d1 = medics.map(m => Math.hypot(m.x - EV.x, m.y - EV.y));
console.log("  3 秒后距离：" + d1.map(d => Math.round(d)).join(" / "));
chk(d1.every((d, i) => d < d0[i] - 30), "医疗兵主动朝撤离点靠近了");

console.log("=== 三、真能撤出去 ===");
/* 直接把他们放到撤离点旁边，看结算会不会送走 */
let evacBefore = ctx.W.evacCount;
medics.forEach(m => { m.x = EV.x; m.y = EV.y; });
ctx.rebuildGrids();
tick(4.0);
const left = ctx.W.units.filter(u => !u.dead && u.kind === "medic").length;
console.log("  撤离计数 " + evacBefore + " → " + ctx.W.evacCount + "，场上还剩医疗兵 " + left);
chk(ctx.W.evacCount > evacBefore, "医疗兵被撤离点结算走了");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));