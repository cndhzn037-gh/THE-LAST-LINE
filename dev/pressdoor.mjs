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
const H = ctx.CFG.escort.house;

function insideHouse(u) {
  return u.x > H.x + 20 && u.x < H.x + H.w - 20 && u.y > H.y + 20 && u.y < H.y + H.h - 20;
}
ctx.START.gameMode = "escort";
ctx.START.civCount = 6;
ctx.START.squad = { rifle: 2, mg: 1, sniper: 0, shield: 0 };
ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false;
ctx.beginGame();
const pd = W().prisonDoor;
const dcx = pd.x + pd.w / 2, dcy = pd.y + pd.h / 2;
console.log("房屋矩形 x " + H.x + "~" + (H.x + H.w) + "  y " + H.y + "~" + (H.y + H.h));
console.log("大门中心 (" + dcx.toFixed(0) + "," + dcy.toFixed(0) + ")");

/* 模拟一批已经追到门口的丧尸（把它们直接放到门外 260~420px 处） */
const pack = [];
for (let i = 0; i < 24; i++) {
  /* 只在门外（右侧）扇形投放，绝不能落在屋子里面 */
  const ang = (-Math.PI / 3) + (i / 23) * (Math.PI * 2 / 3);
  const rr = 260 + (i % 3) * 90;
  const zx = dcx + Math.abs(Math.cos(ang)) * rr + 40;
  const zy = dcy + Math.sin(ang) * rr * 0.7;
  const z = ctx.addUnit("zombie", zx, zy);
  z.locked = 1;
  z.pounceCd = 999;
  pack.push(z);
}
console.log("  投放前先确认没有丧尸落在屋里：" + pack.filter(insideHouse).length + " 只");
ctx.rebuildGrids();
console.log("\n投放 24 只已锁定的丧尸在门口外，跑 25 秒……");
for (let i = 0; i < 60 * 25; i++) ctx.stepSim(1 / 60);

let inside = 0, atDoor = 0, minX = 1e9;
for (const z of pack) {
  if (z.dead) continue;
  if (insideHouse(z)) inside++;
  minX = Math.min(minX, z.x);
  if (Math.hypot(z.x - dcx, z.y - dcy) < 130) atDoor++;
}
console.log("  穿进房屋内部 = " + inside + " 只 " + (inside === 0 ? "✓ 门把它们挡在外面" : "✗"));
console.log("  挤在大门 130px 内 = " + atDoor + "/24 只  ← 扑门聚堆效果");
console.log("  最靠内的丧尸 x = " + minX.toFixed(0) + "（大门内侧边缘 x=" + (pd.x - 10) + "）");

let sum = 0, worst = 0;
for (let i = 0; i < 240; i++) {
  const s0 = process.hrtime.bigint();
  ctx.stepSim(1 / 60);
  const ms = Number(process.hrtime.bigint() - s0) / 1e6;
  sum += ms; if (ms > worst) worst = ms;
}
console.log("  此时全场 " + W().units.filter(u => u.kind === "zombie").length + " 只丧尸：平均 " + (sum / 240).toFixed(2) + "ms/步，最差 " + worst.toFixed(1) + "ms");
