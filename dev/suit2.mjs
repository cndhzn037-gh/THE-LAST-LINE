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
const raw = html;
const CFG = ctx.CFG;

console.log("=== 一、四档防护 ===");
const rows = [["suit1", "一级防护服", 2, 75], ["suit2", "二级防护服", 4, 350],
              ["suit3", "三级防护服", 8, 700], ["antidote", "抗毒血清", 12, 3000]];
for (const [id, nm, sec, price] of rows) {
  const it = ctx.gearItemById(id);
  chk(it && it.name === nm && it.price === price, nm + "：" + price + " 块 / " + sec + " 秒");
  chk(it && it.slot === "suit", nm + " 占防护服槽");
  const u = { kind: "rifle", gear: { suit: id }, dead: false, vmax: 215, magSize: 30, mag: 30 };
  u.gearStats = null;
  const s = ctx.gearStats(u);
  chk(Math.abs(s.suitTime - sec) < 0.01, nm + " 抗感染 " + sec + " 秒");
}
console.log("  价格顺序 75 → 350 → 700 → 3000，逐级递增");

console.log("=== 二、HUD 文本与配色 ===");
chk(raw.indexOf("一级白、二级绿、三级蓝、抗毒血清金") >= 0 || raw.indexOf('if (u.gear.suit === "suit2") suitCol = "120,235,150";') >= 0,
  "四档各有一套颜色");
chk(raw.indexOf('if (u.gear.suit === "suit2") suitCol = "120,235,150";') >= 0, "二级是绿色");
chk(raw.indexOf('else if (u.gear.suit === "suit3") suitCol = "120,190,255";') >= 0, "三级是蓝色");
chk(raw.indexOf('else if (u.gear.suit === "antidote") suitCol = "255,214,90";') >= 0, "抗毒血清是金色");
chk(raw.indexOf('suitIt.name + "  " + Math.round(suitPct * 100) + "%"') >= 0, "显示「名称 + 百分比」");
chk(raw.indexOf("var suitPct = u.suitBroken ? 0 :") >= 0, "破防后显示 0%");

console.log("=== 三、位置在弹药正下方 ===");
chk(raw.indexOf("CTX.fillText(ammo, rx, ry + Math.round(Math.max(26, VW * 0.046)));") >= 0, "弹药先画");
chk(raw.indexOf("ry + Math.round(Math.max(26, VW * 0.046)) + Math.round(Math.max(20, VW * 0.026))") >= 0,
  "防护服文本排在弹药下一行");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
