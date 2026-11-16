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
const W = () => ctx.W;
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function build() {
  ctx.GAME_MODE = "escort";
  ctx.LAST_CIV_COUNT = ctx.START.civCount || 6;
  ctx.LAST_SQUAD = ["rifle", "rifle", "rifle"];
  ctx.buildScenario(999, 0);
}

console.log("=== 一、默认关卡（玩家没动过编辑器）===");
ctx.EDIT.levelTouched = false; ctx.EDIT.level = null;
build();
const def = { z: W().units.filter(u => ctx.isZombie(u)).length, door: W().prisonDoor ? Math.round(W().prisonDoor.x) : null,
  evac: ctx.curEvac(), zones: ctx.edgeSpawnPoints().length };
console.log("  初始丧尸 " + def.z + " 只，锁门 x=" + def.door + "，波次区 " + def.zones + " 块，撤离点 (" + def.evac.x + "," + def.evac.y + ")");
chk(def.zones === 8, "默认 8 个边缘波次区");
chk(def.door === 750, "默认锁门在默认牢房的右墙上");

console.log("\n=== 二、玩家自定义关卡 ===");
ctx.START.civCount = 6;
ctx.EDIT.level = {
  mounds: [{ x: 1200, y: 800, n: 5 }, { x: 1900, y: 1500, n: 9 }],
  zones: [{ x: 3000, y: 200, w: 300, h: 300, side: 1 }, { x: 200, y: 900, w: 260, h: 500, side: -1 }],
  prison: { x: 300, y: 500, w: 500, h: 600 },
  prisonDoor: { x: 800, y: 780, w: 60, h: 120 },
  squad: { x: 3600, y: 1100 },
  evac: { x: 3700, y: 1150 },
  routes: []
};
ctx.EDIT.levelTouched = true;
build();
const zs2 = W().units.filter(u => ctx.isZombie(u));
const scale = ctx.escortThreatScale();
const expect = Math.round(5 * scale) + Math.round(9 * scale);
console.log("  威胁倍率 ×" + scale.toFixed(2) + "，两堆尸群应有 " + expect + " 只，实际 " + zs2.length + " 只");
chk(zs2.length === expect, "初始尸群按玩家的堆布置生成");
const nearA = zs2.filter(u => Math.hypot(u.x - 1200, u.y - 800) < 130).length;
const nearB = zs2.filter(u => Math.hypot(u.x - 1900, u.y - 1500) < 130).length;
chk(nearA === Math.round(5 * scale) && nearB === Math.round(9 * scale), "两堆各自落在玩家标的位置上（" + nearA + " / " + nearB + "）");
chk(zs2.every(u => u.native === 1), "它们全部是原地休眠的初始丧尸");

const pd = W().prisonDoor;
console.log("  锁门 x=" + Math.round(pd.x) + " y=" + Math.round(pd.y) + " w=" + pd.w + " h=" + Math.round(pd.h) + "（玩家框在 800,780 附近）");
chk(Math.abs(pd.x - 780) < 2, "锁门被贴到玩家指定牢房的右墙上");
chk(pd.prison === true, "它就是那道封锁大门");
const prisonWalls = W().obstacles.filter(o => o.x >= 300 && o.x <= 800 && o.y >= 500 && o.y <= 1100);
chk(prisonWalls.length >= 4, "牢房四面墙按玩家的矩形砌好（" + prisonWalls.length + " 段）");

const pts = ctx.edgeSpawnPoints();
console.log("  波次区 " + pts.length + " 块：" + pts.map(p => "x" + p.x0 + "-" + p.x1 + "/side" + p.side).join("  "));
chk(pts.length === 2, "波次区改成玩家画的两块");
chk(pts[0].side === 1 && pts[1].side === -1, "左右半场标注正确");

const sq = W().units.filter(u => ctx.isArmed(u));
const sx = sq.reduce((s, u) => s + u.x, 0) / sq.length;
console.log("  小队质心 x=" + Math.round(sx) + "（玩家出生点 3600）");
chk(Math.abs(sx - 3600) < 160, "小队在玩家指定的出生点集结");
chk(ctx.curEvac().x === 3700 && ctx.curEvac().y === 1150, "撤离点改用玩家设定的位置");

console.log("\n=== 三、波次只从玩家画的区域刷 ===");
ctx.EDIT.level.zones = [{ x: 3000, y: 200, w: 300, h: 300, side: 1 }];
ctx.EDIT.level.squad = { x: 1000, y: 1200 };
build();
const door = W().prisonDoor;
const armed = W().units.find(u => ctx.isArmed(u) && !u.dead);
armed.x = door.x + door.w / 2; armed.y = door.y + door.h / 2;
ctx.stepSim(1 / 60);
chk(W().doorOpen === true, "开门成功");
const seen = new Set(W().units.filter(u => ctx.isZombie(u)).map(u => u.id));
const spawned = [];
for (let i = 0; i < 60 * 6; i++) {
  ctx.stepSim(1 / 60);
  for (const u of W().units) if (ctx.isZombie(u) && !seen.has(u.id)) { seen.add(u.id); spawned.push({ x: u.x, y: u.y }); }
}
const inZone = spawned.filter(p => p.x >= 2990 && p.x <= 3310 && p.y >= 190 && p.y <= 510).length;
console.log("  开门后刷出 " + spawned.length + " 只，其中 " + inZone + " 只落在玩家画的那个区域里");
chk(spawned.length > 0 && inZone === spawned.length, "每一只都从玩家画的波次区里出来");

console.log("\n=== 四、关掉自定义后回到默认关卡 ===");
ctx.EDIT.levelTouched = false;
build();
chk(ctx.edgeSpawnPoints().length === 8, "波次区回到默认 8 块");
chk(ctx.curEvac().x === CFG.escort.evac.x, "撤离点回到默认位置");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
