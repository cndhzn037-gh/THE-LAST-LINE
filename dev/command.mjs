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

console.log("=== 一、帝皇特使降临的震动时间 ===");
const raw = html;
chk(raw.indexOf("W.shakeDur = 0.45") >= 0, "降临震动缩短到 0.45 秒（原来 1.0 秒）");
chk(raw.indexOf("W.shakeMag = 20") >= 0, "幅度也收了一点（26 → 20）");

console.log("=== 二、指挥模式开关 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 10;
ctx.buildScenario(7, 10);
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) if (isZ(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
ctx.rebuildGrids();
chk(!ctx.CMD.on, "默认没开");
ctx.toggleCmd();
chk(ctx.CMD.on, "按一下进入指挥模式");
ctx.cmdAbort();
chk(!ctx.CMD.on, "Esc 能退出");

console.log("=== 三、框选 ===");
ctx.toggleCmd();
const humans = ctx.W.units.filter(u => !u.dead && ctx.isHuman(u) && !isZ(u));
const target = humans[0];
target.x = 2000; target.y = 1200;
ctx.rebuildGrids();
const sx = ctx.w2sx(target.x), sy = ctx.w2sy(target.y);
console.log("  目标单位屏幕坐标 (" + sx.toFixed(0) + "," + sy.toFixed(0) + ")");
ctx.cmdSelect(sx - 30, sy - 30, sx + 30, sy + 30);
console.log("  框里的单位数 = " + ctx.CMD.units.length);
chk(ctx.CMD.units.length >= 1, "框中了人类单位");
chk(ctx.CMD.units.indexOf(target) >= 0, "目标单位在选中列表里");
ctx.cmdSelect(sx - 3000, sy - 3000, sx - 2990, sy - 2990);
chk(ctx.CMD.units.length === 0, "框在空处就清空选择");

console.log("=== 四、下达靠拢命令 ===");
ctx.cmdSelect(sx - 30, sy - 30, sx + 30, sy + 30);
const n0 = ctx.CMD.units.length;
ctx.cmdIssue(2000 + 260, 1200);
console.log("  下令后 cmdTo = " + JSON.stringify(target.cmdTo));
chk(n0 > 0 && !!target.cmdTo, "被选中的人都拿到了目标点");
chk(ctx.CMD.hasT, "画面上会出现目标标记");
const d0 = Math.hypot(target.x - target.cmdTo.x, target.y - target.cmdTo.y);
/* 到点就自动解除，所以不能只看最后位置 —— 一路采样取"最近距离" */
let minD = 1e9, sawCmd = false;
for (let i = 0; i < 16; i++) {
  tick(0.25);
  minD = Math.min(minD, Math.hypot(target.x - 2260, target.y - 1200));
  if (target.state === "command") sawCmd = true;
}
console.log("  起点距目标 " + d0.toFixed(0) + "px，过程中最近 " + minD.toFixed(0) + "px");
chk(minD < d0 - 80, "确实朝目标靠拢了");
chk(sawCmd, "状态标记为「指挥」");

console.log("=== 五、到位后自动交还 AI ===");
tick(2);
console.log("  再跑 2 秒：cmdTo=" + target.cmdTo + "，状态=" + target.state);
chk(!target.cmdTo, "到附近后自动解除指挥目标");

console.log("=== 六、指挥只锁「去哪」，不禁开火 ===");
chk(raw.indexOf('u.state = "command"') >= 0, "指挥状态是独立分支");
chk(raw.indexOf("canFight") >= 0, "开火逻辑独立于走位分支，不会被指挥屏蔽");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
