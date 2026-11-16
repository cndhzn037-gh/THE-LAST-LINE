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
/* 丧尸会被刚体分离推开，所以每一帧都把它按回贴脸位置，模拟"一直被缠住" */
function bite(sec, z, h) {
  for (let i = 0; i < Math.round(sec * 60); i++) {
    z.x = h.x; z.y = h.y;
    ctx.stepSim(1 / 60);
  }
}
const CFG = ctx.CFG;

console.log("=== 普通士兵买防护服也能扛感染 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(5, 2);
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) if (isZ(u)) u.dead = true;
ctx.cleanup();

function setup(suitId) {
  for (const u of ctx.W.units) if (!u.dead) u.dead = true;
  ctx.cleanup();
  const h = ctx.addUnit("rifle", 2000, 1200);
  h.gear = {};
  if (suitId) h.gear.suit = suitId;
  ctx.applyGear(h);
  const z = ctx.addUnit("zombie", 2000, 1200);
  z.hp = 99999;
  ctx.rebuildGrids();
  return { h: h, z: z };
}

console.log("  防护服状态：suitHp=" + (setup("suit1").h.suitHp) + "s");
chk(CFG.unit.rifle.hp > 0, "基准场景就绪");

console.log("=== 一、没买防护服：一贴就感染 ===");
let s = setup(null);
console.log("  初始 suitHp=" + s.h.suitHp + "，infectT=" + (s.h.infectT || 0).toFixed(2));
chk((s.h.suitHp || 0) === 0, "没买时没有防护耐久");
bite(3, s.z, s.h);
console.log("  贴 3 秒后：infectT=" + (s.h.infectT || 0).toFixed(2) + "，infectLocked=" + s.h.infectLocked);
chk(s.h.infectLocked, "没有防护服会被咬中（infectLocked）");

console.log("=== 二、买一级防护服（3 秒）：前几秒咬不动 ===");
s = setup("suit1");
console.log("  装上后 suitHp=" + s.h.suitHp.toFixed(1) + "s");
chk(Math.abs(s.h.suitHp - 2) < 0.01, "一级防护服耐久 2 秒");
bite(2.0, s.z, s.h);
console.log("  贴 2 秒后：suitHp=" + s.h.suitHp.toFixed(2) + "，infectT=" + (s.h.infectT || 0).toFixed(2));
chk(s.h.infectT < 0.05, "破防之前完全不感染");
chk(s.h.suitHp >= 0, "耐久在持续消耗");
bite(2.0, s.z, s.h);
console.log("  贴 4 秒后：suitHp=" + s.h.suitHp.toFixed(2) + "，broken=" + s.h.suitBroken + "，infectT=" + (s.h.infectT || 0).toFixed(2));
chk(s.h.suitBroken, "3 秒左右破防");
chk(s.h.infectLocked, "破防之后开始被咬");

console.log("=== 三、抗毒血清（12 秒）明显更耐 ===");
s = setup("antidote");
chk(Math.abs(s.h.suitHp - 12) < 0.01, "血清耐久 12 秒");
bite(6, s.z, s.h);
console.log("  贴 6 秒后：suitHp=" + s.h.suitHp.toFixed(1) + "，broken=" + s.h.suitBroken + "，infectT=" + (s.h.infectT || 0).toFixed(2));
chk(!s.h.suitBroken && !s.h.infectLocked, "6 秒了还没破、也没被感染");
console.log("=== 三之二、三级防护服（8 秒） ===");
s = setup("suit3");
chk(Math.abs(s.h.suitHp - 8) < 0.01, "三级耐久 8 秒");

console.log("=== 四、英雄的防护服不受影响 ===");
s = setup(null);
ctx.promoteHero(s.h, "armed", true);
console.log("  英雄 suitHp=" + s.h.suitHp.toFixed(1));
chk(s.h.suitHp > 0, "英雄照样自带防护服");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
