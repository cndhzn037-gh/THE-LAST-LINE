import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
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
const W = () => ctx.W;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function humans() { return W().units.filter(u => ctx.isHuman(u) && !u.dead); }

ctx.START.gameMode = "defense";
ctx.START.civCount = 8;
ctx.START.squad = { rifle: 4, mg: 1, sniper: 0, shield: 0 };
ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false; ctx.EDIT.units = null;

console.log("=== 一、重开必须重置全局（而不是留下残局）===");
ctx.beginGame();
const n0 = W().units.length;
for (let i = 0; i < 60 * 25; i++) ctx.stepSim(1 / 60);
console.log("  残局：t=" + W().t.toFixed(1) + "s 场上单位=" + W().units.length + "（开局 " + n0 + "）  击杀=" + W().kills + "  感染=" + W().infected);
const before = { t: W().t, k: W().kills, n: W().units.length };
ctx.resetForSetup();
console.log("  重开后：t=" + W().t + "s 击杀=" + W().kills + " 感染=" + W().infected + " over=" + W().over + " 单位=" + W().units.length);
chk(W().t === 0, "时间归零（残局是 " + before.t.toFixed(1) + "s）");
chk(W().kills === 0, "击杀归零（残局是 " + before.k + "）");
chk(W().infected === 0, "感染归零");
chk(W().over === false, "胜负标记被清除");
chk(W().bullets.length === 0, "残留子弹被清空");
chk(W().units.length > 0, "干净场景已重建（不是空世界）");

console.log("\n=== 二、编辑器布置不被残局污染 ===");
ctx.resetForSetup();
const placed = ctx.addUnit("sniper", 500, 500);
ctx.EDIT.unitsEdited = true;          /* 真实流程里由编辑器的放置动作置位 */
ctx.snapshotEditUnits();
console.log("  编辑器蓝图 = " + JSON.stringify(ctx.EDIT.units.map(b => b.kind + "@" + Math.round(b.x) + "," + Math.round(b.y))));
ctx.beginGame();
chk(W().units.some(u => u.kind === "sniper"), "开局采用了编辑器放置的狙击手");
for (let i = 0; i < 60 * 30; i++) ctx.stepSim(1 / 60);
const moved = W().units.filter(u => u.kind === "sniper");
console.log("  打 30 秒后场上狙击手 = " + moved.map(u => Math.round(u.x) + "," + Math.round(u.y)).join(" "));
ctx.resetForSetup();
const back = W().units.filter(u => u.kind === "sniper");
console.log("  重开后狙击手 = " + back.map(u => Math.round(u.x) + "," + Math.round(u.y)).join(" "));
chk(back.length === 1, "编辑器的单位被恢复（数量 1，实际 " + back.length + "）");
chk(back.length === 1 && Math.abs(back[0].x - 500) < 1 && Math.abs(back[0].y - 500) < 1,
  "位置回到编辑器里放的那一点，而不是残局里跑到的位置");
chk(W().t === 0 && W().kills === 0, "重开后仍然是干净对局");

console.log("\n=== 三、编辑器只编辑自己那一套（不继承上一局打剩的人）===");
ctx.EDIT.units = null; ctx.EDIT.unitsEdited = false; ctx.EDIT.touched = false;
ctx.beginGame();
for (let i = 0; i < 60 * 30; i++) ctx.stepSim(1 / 60);
const rem = humans().length;
for (const u of humans()) u.hp = 1;          /* 人为制造"打残"的痕迹 */
ctx.resetForSetup();
const fresh = humans();
const hurt = fresh.filter(u => u.hp <= 1 || u.infectLocked).length;
console.log("  残局人类 " + rem + " 人（全员残血）-> 重开后 " + fresh.length + " 人，其中带伤/被感染的 " + hurt + " 人");
chk(rem === 0 || hurt === 0, "重开后没有任何单位带着上一局的血量与感染状态");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
