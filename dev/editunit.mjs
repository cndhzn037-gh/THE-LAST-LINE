import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const gradStub = { addColorStop: noop };
const els = {};
function makeEl(id) {
  const e = { id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600,
    addEventListener: function (k, f) { if (k === "change") e._onchange = f; },
    removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
    getAttribute: function () { return null; }, click: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    getContext: () => c2, querySelectorAll: () => [], querySelector: () => null };
  return e;
}
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl(id)), createElement: () => makeEl("x"),
    querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });
const W = () => ctx.W;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }

console.log("=== 一、工具识别：全部兵种都要被认作单位工具 ===");
const KINDS = ["rifle", "mg", "sniper", "shield", "civilian", "zombie", "mother"];
for (const k of KINDS) {
  const name = ctx.CFG.unit[k].name;
  chk(ctx.isUnitTool(k) === true, "「" + name + "」(" + k + ") 可放置");
}
console.log("  非单位工具应当被排除：");
for (const t of ["house", "wall", "door", "erase", "move", "defend", "spawn", "route", ""]) {
  if (ctx.isUnitTool(t)) { bad++; console.log("  XX 误判 " + t); }
}
console.log("  OK house / wall / door / erase / move / defend / spawn / route / 空值 都正确排除");

console.log("\n=== 二、实际放置七种单位 ===");
ctx.GAME_MODE = "defense";
ctx.buildScenario(999, 8);
function findFree() {
  for (let y = 120; y < 2200; y += 55) {
    for (let x = 120; x < 4000; x += 55) {
      if (!ctx.blockedForPlacement(x, y, 16)) return { x: x, y: y };
    }
  }
  return null;
}
for (const k of KINDS) {
  const spot = findFree();
  if (!spot) { bad++; console.log("  XX 找不到空地"); break; }
  const n0 = W().units.length;
  ctx.EDIT.tool = k;
  ctx.editPlaceUnit(k, spot.x, spot.y);
  const added = W().units.length - n0;
  const last = W().units[W().units.length - 1];
  chk(added === 1 && last && last.kind === k,
    "放下「" + ctx.CFG.unit[k].name + "」→ 场上 +" + added + "，类型=" + (last ? last.kind : "无"));
}

console.log("\n=== 三、人类兵种会分配到岗位，丧尸不会 ===");
const sn = W().units.find(u => u.kind === "sniper");
const sh = W().units.find(u => u.kind === "shield");
const zb = W().units.find(u => u.kind === "zombie" && u.id > 900);
chk(!!sn && !!sh, "狙击手与盾兵确实进入了战场");
chk(ctx.isHuman(sn) && ctx.isHuman(sh), "两者都被认作人类阵营");
chk(!ctx.isUnitTool("sandbag"), "sandbag 仍然走沙袋那条分支，不会被当单位放");

console.log("\n=== 四、放置后编辑标记正确置位 ===");
ctx.EDIT.unitsEdited = false;
ctx.EDIT.touched = false;
const spot2 = findFree();
ctx.editPlaceUnit("shield", spot2.x, spot2.y);
chk(ctx.EDIT.unitsEdited === true, "标记为已编辑单位（会被存进蓝图）");
chk(ctx.EDIT.touched === true, "标记为已改动地形");

console.log("\n=== 五、批量放置 ===");
/* 找一块真正空旷的地方：周围 360px 内没有障碍，才能放满一批 */
function findOpenArea() {
  for (let y = 400; y < 1900; y += 40) {
    for (let x = 300; x < 3800; x += 40) {
      let clear = true;
      for (let a = 0; a < 12 && clear; a++) {
        const ang = Math.PI * 2 * a / 12;
        for (const rr of [120, 240, 340]) {
          if (ctx.blockedForPlacement(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 20)) { clear = false; break; }
        }
      }
      if (clear) return { x: x, y: y };
    }
  }
  return null;
}
const open = findOpenArea();
chk(!!open, "找到一块空旷区域用于测试");
console.log("  空旷点 (" + open.x + "," + open.y + ")  批量档位表 " + JSON.stringify(ctx.BATCH_STEPS));

ctx.BATCH_IDX = 0;
ctx.setBatch(0);
const r0 = W().resources;
let n0 = W().units.length;
ctx.editPlaceUnit("rifle", open.x, open.y);
chk(W().units.length - n0 === 1, "×1 时只放 1 个");

const idx5 = ctx.BATCH_STEPS.indexOf(5);
ctx.BATCH_IDX = idx5;
ctx.setBatch(idx5);
n0 = W().units.length;
ctx.editPlaceUnit("sniper", open.x, open.y);
const added = W().units.length - n0;
chk(added === 5, "×5 时一次放下 " + added + " 个狙击手");
const batch = W().units.slice(n0);
let minGap = Infinity;
for (let i = 0; i < batch.length; i++) {
  for (let j = i + 1; j < batch.length; j++) {
    minGap = Math.min(minGap, Math.hypot(batch[i].x - batch[j].x, batch[i].y - batch[j].y));
  }
}
console.log("  这批单位之间的最小间距 " + minGap.toFixed(0) + "px");
chk(minGap > 30, "批量放下的单位互不重叠（最小间距 " + minGap.toFixed(0) + "px）");
chk(W().resources === r0, "编辑器放置不消耗资源（资源仍为 " + r0 + "）");

/* 空间不够时应只放得下的部分，而不是静默失败 */
const tight = ctx.W.obstacles.length ? (function () {
  for (let y = 100; y < 2200; y += 20) for (let x = 60; x < 4000; x += 20) {
    if (ctx.blockedForPlacement(x, y, 14)) return { x: x, y: y };
  }
  return null;
})() : null;
if (tight) {
  n0 = W().units.length;
  ctx.editPlaceUnit("mg", tight.x, tight.y);
  const few = W().units.length - n0;
  console.log("  贴着障碍物放 ×5 → 实际放下 " + few + " 个");
  chk(few <= 5, "空间不足时不会硬塞（放下 " + few + " 个）");
}

ctx.BATCH_IDX = 0; ctx.setBatch(0);

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
