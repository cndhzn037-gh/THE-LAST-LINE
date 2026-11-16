import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0, firstChild: null, tagName: "DIV",
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
vm.runInContext(gcode, ctx, { name: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function countArmed() {
  const out = {};
  for (const u of ctx.W.units) {
    if (u.dead || !ctx.isHuman(u) || u.kind === "civilian") continue;
    out[u.kind] = (out[u.kind] || 0) + 1;
  }
  return out;
}
const NAME = { rifle: "步枪兵", mg: "机枪兵", sniper: "狙击手", shield: "盾兵", medic: "医疗兵" };

for (const id of ["town", "plains", "indoor", "channel"]) {
  ctx.CFG.mapPreset = id;
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 40;
  ctx.buildScenario(20240607, 40);
  const c = countArmed();
  const desc = Object.keys(c).map(k => NAME[k] + "×" + c[k]).join("  ");
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  console.log("  " + ctx.MAP_PRESETS[id].name.padEnd(8) + desc + "   （共 " + total + " 人）");
  if (id === "town") {
    chk(c.rifle === 12 && c.mg === 3, "城镇保持原样：12 步枪 + 3 机枪");
    chk(!c.medic && !c.sniper && !c.shield, "城镇里没有新兵种");
  }
  if (id === "plains") {
    chk(c.medic === 2, "平原配了两名医疗兵");
    chk(c.sniper === 1, "平原配了一名狙击手");
    chk(c.rifle === 10, "步枪兵减到 10（换掉两个）");
    chk(c.mg === 2, "机枪兵减到 2（换掉一个）");
    chk(total === 15, "总人数仍是 15");
  }
  if (id === "indoor") {
    chk(c.shield === 1, "室内配了一名盾兵");
    chk(c.rifle === 10, "步枪兵减到 10（换掉两个）");
    chk(total === 14, "两人换一人，总数 14");
  }
  if (id === "channel") {
    chk(c.rifle === 12 && c.mg === 3 && total === 15, "H 型通道沿用基础编制");
  }
}

console.log("=== 跑一下看会不会崩 ===");
for (const id of ["plains", "indoor"]) {
  ctx.CFG.mapPreset = id;
  ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 40;
  ctx.buildScenario(20240607, 40);
  ctx.W.over = false; ctx.W.paused = false;
  for (let i = 0; i < 300; i++) ctx.stepSim(1 / 60);
  const alive = ctx.W.units.filter(u => !u.dead);
  console.log("  " + ctx.MAP_PRESETS[id].name + " 跑 5 秒后存活 " + alive.length);
  chk(alive.every(u => isFinite(u.x) && isFinite(u.y)), ctx.MAP_PRESETS[id].name + " 没有 NaN");
}

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));