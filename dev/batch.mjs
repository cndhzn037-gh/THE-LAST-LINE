import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [] }; }
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

console.log("=== 一、数值 ===");
const MU = ctx.CFG.unit.mother;
console.log("  母体 hp = " + MU.hp + "（原 556 ÷ 8 ≈ 70）  首个产卵阈值 " + (MU.hp * 0.9).toFixed(1));
console.log("  产卵：每掉 " + (MU.hp * 0.1).toFixed(1) + " 血产 7 只，共 " + Math.round(MU.hp * 0.9 / (MU.hp * 0.1)) + " 次 → 合计 " + (Math.round(MU.hp * 0.9 / (MU.hp * 0.1)) * 7) + " 只");
console.log("  价格：平民 " + ctx.CFG.econ.cost.civilian + "  机枪兵 " + ctx.CFG.econ.cost.mg + "  步枪兵 " + ctx.CFG.econ.cost.rifle + "  小队 " + ctx.squadCost());
console.log("  平民与机枪兵同价 = " + (ctx.CFG.econ.cost.civilian === ctx.CFG.econ.cost.mg ? "✓" : "✗"));

// 产卵实测
ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0;
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const m = ctx.addUnit("mother", 2000, 1200);
let lastZ = 0, spawns = 0;
for (let i = 0; i < 200 && !m.dead; i++) {
  ctx.damageZombie(m, 5);
  const zc = W().units.filter(u => u.kind === "zombie").length;
  if (zc > lastZ) { spawns++; lastZ = zc; }
}
console.log("  实测：产卵 " + spawns + " 次，生成 " + lastZ + " 只普通丧尸，母体已死=" + m.dead);

console.log("\n=== 二、武装单位初始阵位（应排成一整排）===");
ctx.buildScenario(undefined, 80);
const armed = W().units.filter(u => ctx.isArmed(u)).sort((a, b) => a.y - b.y);
const xs = armed.map(u => u.x), ys = armed.map(u => u.y);
const gaps = ys.slice(1).map((y, i) => y - ys[i]);
console.log("  武装单位 " + armed.length + " 人：x 范围 " + Math.min(...xs).toFixed(0) + "~" + Math.max(...xs).toFixed(0) +
  "（跨度 " + (Math.max(...xs) - Math.min(...xs)).toFixed(0) + "px）");
console.log("  y 范围 " + Math.min(...ys).toFixed(0) + "~" + Math.max(...ys).toFixed(0) + "，相邻间距 " + [...new Set(gaps.map(g => Math.round(g)))].join(",") + "px");
let inWall = 0;
for (const u of armed) for (const o of W().obstacles) if (u.x > o.x && u.x < o.x + o.w && u.y > o.y && u.y < o.y + o.h) { inWall++; break; }
console.log("  卡在墙里的武装单位 = " + inWall + "（应为 0）");
const civs = W().units.filter(u => u.kind === "civilian");
console.log("  平民 " + civs.length + " 人，x 范围 " + Math.min(...civs.map(c => c.x)).toFixed(0) + "~" + Math.max(...civs.map(c => c.x)).toFixed(0) + "（排在武装身后）");

console.log("\n=== 三、批量投放 ===");
W().resources = 2000;
function countKinds() {
  const r = {};
  for (const u of W().units) if (!u.dead) r[u.kind] = (r[u.kind] || 0) + 1;
  return r;
}
let before = countKinds(), res0 = W().resources;
ctx.doPlace("rifle", 3400, 900, 5);
let after = countKinds(), res1 = W().resources;
console.log("  批量放 5 名步枪兵：步枪兵 " + before.rifle + " -> " + after.rifle + "，消耗 " + (res0 - res1) + " 资源（预期 125）");
before = countKinds(); res0 = W().resources;
ctx.doPlace("civilian", 3500, 1100, 3);
after = countKinds(); res1 = W().resources;
console.log("  批量放 3 名平民：平民 " + before.civilian + " -> " + after.civilian + "，消耗 " + (res0 - res1) + " 资源（预期 180）");

console.log("\n=== 四、小队投放 ===");
before = countKinds(); res0 = W().resources;
ctx.doPlace("squad", 3300, 1500, 1);
after = countKinds(); res1 = W().resources;
console.log("  投放 1 支小队：步枪兵 +" + (after.rifle - before.rifle) + "，机枪兵 +" + (after.mg - before.mg) +
  "，平民 +" + (after.civilian - before.civilian) + "，消耗 " + (res0 - res1) + " 资源（预期 195）");
res0 = W().resources;
ctx.doPlace("squad", 3400, 1600, 3);
console.log("  批量投放 3 支小队：消耗 " + (res0 - W().resources) + " 资源（预期 585）");

console.log("\n=== 五、边界情况 ===");
W().resources = 40;
console.log("  资源 40 时放 3 名步枪兵（需 75）：");
const ok1 = ctx.doPlace("rifle", 3300, 700, 3);
console.log("    结果 = " + ok1 + "，资源 = " + W().resources + "（应只放 1 个，扣 25）");
W().resources = 2000;
const ok2 = ctx.doPlace("squad", 3060, 600, 1);   // 墙边，应该放不下或用掉部分空间
console.log("  墙边投放小队结果 = " + ok2 + "（放不下会提示换位置）");
for (let i = 0; i < 60 * 5; i++) ctx.stepSim(1 / 60);
console.log("  演算 5 秒后：人类=" + ctx.countUnits().h + " 丧尸=" + ctx.countUnits().z + " 击杀=" + W().kills);
