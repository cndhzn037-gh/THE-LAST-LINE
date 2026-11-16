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
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }
const raw = html;
const CFG = ctx.CFG;

console.log("=== 一、举盾时也能开火 ===");
chk(raw.indexOf("var canFight = armed;") >= 0, "canFight 不再排除未破盾的盾兵");
chk(raw.indexOf("!(u.kind === \"shield\" && !u.shieldBroken)") < 0, "旧的「举盾不射击」判定已经删掉");

console.log("=== 二、行为验证 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 6;
ctx.buildScenario(4, 6);
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) if (isZ(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
const sh = ctx.addUnit("shield", 2000, 1200);
sh.shieldBroken = false;
sh.mag = sh.magSize;
ctx.rebuildGrids();
const foe = ctx.addUnit("zombie", 2100, 1200);
foe.hp = 99999;
ctx.rebuildGrids();
console.log("  盾兵护盾状态：shieldBroken=" + sh.shieldBroken + "，弹匣 " + sh.mag + "/" + sh.magSize);
const m0 = sh.mag;
tick(2.5);
console.log("  2.5 秒后弹匣 " + sh.mag + "/" + sh.magSize + "，场上子弹 " + ctx.W.bullets.length);
chk(!sh.shieldBroken, "期间护盾一直是完好的（确实是「举盾开火」）");
chk(ctx.W.bullets.length > 0, "举着盾也在用手枪还击");
chk(sh.mag < m0, "手枪照常消耗弹药（" + m0 + " → " + sh.mag + "）");
chk(!CFG.pistol.infiniteAmmo, "手枪没有无限弹药标记");
chk(raw.indexOf("var inf = !!u.aura;") >= 0, "读表的 ∞ 只跟平民英雄光环挂钩");
chk(raw.indexOf('(inf ? "∞" : Math.max(0, u.mag))') >= 0, "光环里的单位显示 ∞ / 容量");

console.log("=== 三、玩家操控时同样能打 ===");
chk(raw.indexOf('else if (u.kind === "shield") { piv = CFG.pistol.interval') >= 0 ||
    raw.indexOf('u.kind === "shield"') >= 0, "玩家分支里有盾兵的手枪参数");
ctx.PLAYER.on = true; ctx.PLAYER.unit = sh; ctx.PLAYER.firing = true;
sh.mag = sh.magSize;
const m1 = sh.mag;
tick(1);
ctx.PLAYER.firing = false;
ctx.PLAYER.on = false; ctx.PLAYER.unit = null;
console.log("  玩家按住左键 1 秒：场上子弹 " + ctx.W.bullets.length + "，弹匣 " + m1 + " → " + sh.mag);
chk(sh.mag < m1, "玩家操控时也照常消耗弹药");
chk(ctx.W.bullets.length > 0, "玩家操控的盾兵也能用手枪开火");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
