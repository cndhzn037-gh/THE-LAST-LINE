import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0, firstChild: null,
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

console.log("=== 一、四套配色主题 ===");
const ids = Object.keys(ctx.PALETTE_THEMES);
console.log("  主题：" + ids.map(i => ctx.PALETTE_THEMES[i].name).join(" / "));
chk(ids.length === 4, "一共 4 套");
chk(ids.indexOf("dusk") >= 0, "默认那套在");

console.log("=== 二、换主题会改地面与建筑色 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(3, 2); ctx.W.over = false;
const wall = ctx.W.obstacles.find(o => o.kind !== "low");
const low = ctx.W.obstacles.find(o => o.kind === "low");
const duskWallHue = wall ? wall.hue : -1;
const duskGround = ctx.CFG.palette.ground;
ctx.applyPaletteTheme("military");
console.log("  地面 " + duskGround + " → " + ctx.CFG.palette.ground);
console.log("  墙体色相 " + Math.round(duskWallHue) + " → " + Math.round(wall.hue));
chk(ctx.CFG.palette.ground !== duskGround, "地面颜色变了");
chk(Math.abs(wall.hue - 108) < 6, "墙体跟着换成军事绿的色相");
chk(store["zombieSandbox.palette"] === "military", "选择被记住");
chk(Math.abs(low.hue - 112) < 6, "矮墙也换了，且和自己的色相接近");

console.log("=== 三、换主题不影响玩法 ===");
const nBefore = ctx.W.units.filter(u => !u.dead).length;
const hpBefore = ctx.W.units[0].hp;
ctx.applyPaletteTheme("night");
chk(ctx.W.units.filter(u => !u.dead).length === nBefore, "单位数量没变");
chk(ctx.W.units[0].hp === hpBefore, "血量没变");
chk(ctx.CFG.world.w === 4096, "地图尺寸没变");

console.log("=== 四、新建筑用新配色 ===");
ctx.applyPaletteTheme("ruin");
const o2 = ctx.makeObstacle(100, 100, 50, 50, "wall");
console.log("  废墟褐下新建的墙：色相 " + Math.round(o2.hue) + "，明度 " + Math.round(o2.lit));
chk(Math.abs(o2.hue - 26) < 6, "新建的建筑用当前主题色");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));