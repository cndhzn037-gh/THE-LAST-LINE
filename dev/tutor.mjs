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

console.log("=== 一、教程共 5 步 ===");
const steps = ctx.tutorSteps();
chk(steps.length === 5, "5 步");
const all = steps.map(s => s.b).join(" ");
chk(all.indexOf("操控") >= 0, "讲到了接管操控");
chk(all.indexOf("装备市场") >= 0, "讲到了装备购买");
chk(all.indexOf("不用先接管也能买") >= 0, "说明了仅查看也能配装");

console.log("=== 二、键名是现查的 ===");
console.log("  当前键位：取消=" + ctx.keyDisplay(ctx.KEYMAP["cancel"]) +
  "  装备市场=" + ctx.keyDisplay(ctx.KEYMAP["market"]) +
  "  开火模式=" + ctx.keyDisplay(ctx.KEYMAP["fireMode"]));
const before = steps[2].b;
chk(before.indexOf(ctx.keyDisplay(ctx.KEYMAP["cancel"])) >= 0, "教程里写的是当前取消键");
chk(before.indexOf(ctx.keyDisplay(ctx.KEYMAP["fireMode"])) >= 0, "教程里写的是当前开火模式键");

console.log("=== 三、改了键位，教程跟着变 ===");
const oldCancel = ctx.KEYMAP["cancel"];
ctx.KEYMAP["cancel"] = "X";      /* 模拟玩家改成 X */
const after = ctx.tutorSteps()[2].b;
console.log("  改成 X 之后，这一步里取消键显示为：" + (after.indexOf(">X<") >= 0 ? "X" : "没变"));
chk(after.indexOf(">X<") >= 0, "教程自动更新成新键位");
chk(after.indexOf(">" + ctx.keyDisplay(oldCancel) + "<") < 0, "旧键位不再出现");
ctx.KEYMAP["cancel"] = oldCancel;

console.log("=== 四、对局结束退出操控 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense"; ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(3, 2); ctx.W.over = false; ctx.W.paused = false;
const u = ctx.W.units.find(x => !x.dead && x.kind === "rifle");
ctx.PLAYER.on = true; ctx.PLAYER.unit = u; ctx.PLAYER.firing = true;
ctx.W.over = true; ctx.W.result = "lose";
ctx.showResult();
chk(ctx.PLAYER.on === false && ctx.PLAYER.unit === null, "结算时操控被清掉");
chk(ctx.PLAYER.firing === false && ctx.PLAYER.stickL === null, "开火与摇杆状态也清了");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));