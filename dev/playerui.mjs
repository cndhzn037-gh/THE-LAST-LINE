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
const CFG = ctx.CFG;
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }

console.log("=== 一、操控读数与瞄准线 ===");
chk(typeof ctx.drawPlayerAimAndHud === "function", "有操控 HUD 绘制函数");
chk(typeof ctx.gunNameOf === "function", "有枪械名称换算");
chk(ctx.gunNameOf({ kind: "mg" }) === "机枪", "机枪兵 → 机枪");
chk(ctx.gunNameOf({ kind: "rifle" }) === "步枪", "步枪兵 → 步枪");
chk(ctx.gunNameOf({ kind: "sniper" }) === "狙击枪", "狙击手 → 狙击枪");
const raw = html;
chk(raw.indexOf("VH * 2 / 3") >= 0, "读数在屏幕从下往上 1/3 处");
chk(raw.indexOf("换弹中") >= 0, "有换弹提示");
chk(raw.indexOf("Math.round(VH - 212)") >= 0,
  "换弹提示贴近兵种占比条（VH-152）的上方");
chk(raw.indexOf("fearRadiusOf(u) * 1.5") >= 0, "瞄准线长度不超过恐惧范围的 150%");
chk(raw.indexOf("createLinearGradient(ax0, ay0, ax1, ay1)") >= 0, "瞄准线是渐变（越远越淡）");
chk(raw.indexOf("setLineDash([11, 7])") >= 0, "瞄准线是虚线");
chk(raw.indexOf("lineWidth = 3.6") >= 0, "瞄准线加粗");

console.log("=== 二、操控时空格 = 猛扑 ===");
chk(CFG.playerDash && CFG.playerDash.push > 200, "猛扑脉冲 " + (CFG.playerDash ? CFG.playerDash.push : 0) + " px/s");
chk(CFG.playerDash.cd > 0.3, "有冷却 " + CFG.playerDash.cd + "s，按住不会连发");
chk(CFG.pounce.cd === 2.5, "丧尸的猛扑配置没被撞名覆盖（cd 仍是 " + CFG.pounce.cd + "）");
chk(raw.indexOf("if (PLAYER.on && PLAYER.unit && !PLAYER.unit.dead) { playerPounce(); return true; }") >= 0,
  "空格在操控时走猛扑，不再暂停");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 8;
ctx.buildScenario(7, 8);
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) if (isZ(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
ctx.rebuildGrids();
const p = ctx.W.units.find(u => !u.dead && u.kind === "rifle");
p.x = 2000; p.y = 1200; p.vx = 0; p.vy = 0;
ctx.PLAYER.on = true; ctx.PLAYER.unit = p; ctx.PLAYER.moveX = 1; ctx.PLAYER.moveY = 0;
const sp0 = Math.hypot(p.vx, p.vy);
ctx.playerPounce();
const sp1 = Math.hypot(p.vx, p.vy);
console.log("  猛扑前速度 " + sp0.toFixed(0) + " → 猛扑后 " + sp1.toFixed(0) + " px/s");
chk(sp1 > sp0 + 300, "空格给了明显的速度脉冲");
chk(ctx.PLAYER.pounceT > 0, "进入冷却");
const vx1 = p.vx;
ctx.playerPounce();
chk(Math.abs(p.vx - vx1) < 0.01, "冷却期间再按不会叠加");

console.log("=== 三、操控步枪兵 = 速射 ===");
chk(raw.indexOf("var piv = CFG.near.interval") >= 0, "玩家手里的步枪改用速射间隔");
chk(raw.indexOf("pdmg = CFG.near.dmg") >= 0, "伤害也走速射档");
console.log("  速射间隔 " + CFG.near.interval + "s，点射间隔 " + CFG.far.interval + "s");
chk(CFG.near.interval < CFG.far.interval / 4, "速射明显快于点射");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
