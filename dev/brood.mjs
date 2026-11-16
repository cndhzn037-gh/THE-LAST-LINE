import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [] }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });

ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0;
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const m = ctx.addUnit("mother", 2000, 1200);
const r = ctx.addUnit("rifle", 1700, 1200);
console.log("母体血量=" + m.hp + " 首个产卵阈值=" + m.nextSpawnHp);
let lastHp = m.hp, log = [];
for (let i = 0; i < 900; i++) {
  ctx.stepSim(1 / 60);
  if (m.hp !== lastHp && Math.abs(lastHp - m.hp) >= 0.5) { lastHp = m.hp; }
  const c = ctx.countUnits();
  if (i % 60 === 0) log.push("t=" + (i / 60).toFixed(0) + "s 母体hp=" + m.hp.toFixed(0) + " 阈值=" + m.nextSpawnHp.toFixed(0) + " 普通丧尸=" + c.z + " 击杀=" + ctx.W.kills);
}
console.log(log.slice(0, 16).join("\n"));
const c = ctx.countUnits();
console.log("15 秒后：母体 hp=" + m.hp.toFixed(0) + " dead=" + m.dead + " 普通丧尸=" + c.z + " 总击杀=" + ctx.W.kills);
console.log("母体产卵次数 = " + Math.floor((m.maxHp * 0.9 - m.nextSpawnHp) / (m.maxHp * 0.1)) + " 次（每次 7 只）");

console.log("\n--- 抱团与掩体：完整场景抽样 ---");
ctx.W.units.length = 0;
ctx.buildScenario(undefined, 120);
for (let i = 0; i < 600; i++) ctx.stepSim(1 / 60);
const armed = ctx.W.units.filter(u => ctx.isArmed(u));
const civs = ctx.W.units.filter(u => u.kind === "civilian");
console.log("武装 " + armed.length + " 人，护卫名额分配：", armed.map(a => a.guards.length).join(","));
console.log("平民 " + civs.length + " 人，已抱团 " + civs.filter(c => c.guardOf).length + " 人");
console.log("掩体状态：", armed.filter(a => a.coverKind).length + "/" + armed.length + " 有掩体目标");
console.log("弹匣状态：", armed.map(a => a.kind + ":" + a.mag + (a.reloading ? "(换弹)" : "")).slice(0, 8).join(" "));
const coverKinds = {};
armed.forEach(a => { if (a.coverKind) coverKinds[a.coverKind] = (coverKinds[a.coverKind] || 0) + 1; });
console.log("掩体类型分布：", JSON.stringify(coverKinds));
