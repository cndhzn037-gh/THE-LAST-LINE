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

console.log("=== 一、三种地形的视线规则 ===");
chk(raw.indexOf("this.visBlock = new Uint8Array") >= 0, "有独立的视线阻挡网格");
chk(raw.indexOf('var seeThrough = (o.kind === "low");') >= 0, "矮墙不挡视线");
chk(raw.indexOf("if (!seeThrough) this.visBlock") >= 0, "只有实心墙写进视线网格");

function ob(x, y, w, h, kind) { return ctx.makeObstacle(x, y, w, h, kind); }
/* 世界：左边一道实心墙、右边一道矮墙，中间留空 */
ctx.W.obstacles = [ ob(2100, 1100, 40, 400, "wall"), ob(1900, 1900, 400, 40, "low") ];
ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
const gx = Math.floor(2120 / ctx.NAV.tile), gy = Math.floor(1300 / ctx.NAV.tile);
console.log("  实心墙格 blocked=" + ctx.NAV.b(gx, gy) + " visBlock=" + ctx.NAV.visBlock[gy * ctx.NAV.cols + gx]);
chk(ctx.NAV.b(gx, gy) === 1, "实心墙：走不过去");
chk(ctx.NAV.visBlock[gy * ctx.NAV.cols + gx] === 1, "实心墙：看不透");
const lx = Math.floor(2100 / ctx.NAV.tile), ly = Math.floor(1920 / ctx.NAV.tile);
console.log("  矮墙格 blocked=" + ctx.NAV.b(lx, ly) + " visBlock=" + ctx.NAV.visBlock[ly * ctx.NAV.cols + lx]);
chk(ctx.NAV.b(lx, ly) === 1, "矮墙：走不过去");
chk(ctx.NAV.visBlock[ly * ctx.NAV.cols + lx] === 0, "矮墙：看得过去");

console.log("=== 二、射线被墙截断 ===");
/* 从墙左边朝右打，应该提前被挡住 */
const dWall = ctx.fogRay(2000, 1300, 0, 400);
console.log("  朝实心墙：看得到 " + dWall.toFixed(0) + "px（满距 400）");
chk(dWall < 200, "实心墙把视线截断了");
const dFree = ctx.fogRay(2000, 700, 0, 400);
console.log("  朝空地：看得到 " + dFree.toFixed(0) + "px");
chk(dFree === 400, "空地上一条直线看满全程");
const dLow = ctx.fogRay(2000, 1920, 0, 400);
console.log("  朝矮墙：看得到 " + dLow.toFixed(0) + "px");
chk(dLow === 400, "矮墙不挡视线，照样看满");

console.log("=== 三、迷雾是纯视觉层 ===");
chk(raw.indexOf("if (!CFG.fog.on || HIDE_UI) return;") >= 0, "有开关");
chk(raw.indexOf('b.textContent = (CFG.fog.on ? "✓ " : "✗ ") + lab;') >= 0, "菜单里有开关按钮");
chk(raw.indexOf("zombieSandbox.fog") >= 0, "开关状态存本地");
console.log("  默认开启=" + CFG.fog.on + "，半角=" + (CFG.fog.coneDeg / 2).toFixed(0) + "°，最暗=" + CFG.fog.alpha);

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
