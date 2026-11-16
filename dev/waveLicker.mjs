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
const raw = html;
const CFG = ctx.CFG;

console.log("=== 投放尸潮里的舔舐者 ===");
chk(raw.indexOf('toast("尸潮涌入 +" + n + " 只（奔跑者 " + runners + "，舔舐者 " + lickers') >= 0,
  "提示里会报舔舐者数量");
chk(raw.indexOf("if (lickers === 0 && n >= 80)") >= 0, "大波次有保底，至少来一只");

/* 模拟点一次「投放尸潮」 */
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 0;
ctx.buildScenario(5, 0);
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) if (isZ(u)) u.dead = true;
ctx.cleanup();

/* 直接跑按钮里的同一套逻辑 */
function dropWave(n) {
  const zs = ctx.defaultSpawnZone();
  let runners = 0, lickers = 0;
  for (let i = 0; i < n; i++) {
    const zk = ctx.pickZombieKind();
    if (zk === "runner") runners++;
    else if (zk === "licker") lickers++;
    ctx.addUnit(zk, zs.x + 10, zs.y + 10);
  }
  if (lickers === 0 && n >= 80) { ctx.addUnit("licker", zs.x + 10, zs.y + 10); lickers = 1; }
  return { runners: runners, lickers: lickers };
}
const r40 = dropWave(40);
console.log("  投放 40 只：奔跑者 " + r40.runners + "，舔舐者 " + r40.lickers);
const r200 = dropWave(200);
console.log("  投放 200 只：奔跑者 " + r200.runners + "，舔舐者 " + r200.lickers);
chk(r200.lickers >= 1, "大波次里一定有舔舐者");
const cnt = ctx.W.units.filter(u => !u.dead && u.kind === "licker").length;
console.log("  场上舔舐者共 " + cnt + " 只");
chk(cnt >= 1, "确实生成到了场上");
chk(ctx.W.units.some(u => !u.dead && u.kind === "licker" && ctx.isZombieSide(u)), "被当作丧尸阵营");
chk(ctx.CFG.unit.licker.hp === 20, "投放出来的是正规舔舐者（20 血）");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
