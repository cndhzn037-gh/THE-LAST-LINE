import fs from "node:fs";
import vm from "node:vm";

const file = process.argv[2];
const html = fs.readFileSync(file, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: 未找到 <script> 块"); process.exit(1); }
const code = m[1];

try { new vm.Script(code, { filename: "game.js" }); }
catch (e) { console.error("FAIL 语法错误: " + e.message); process.exit(1); }
console.log("PASS 语法检查");

const noop = function () {};
function ctxStub() {
  const base = { canvas: null, globalCompositeOperation: "source-over", fillStyle: "", strokeStyle: "",
    lineWidth: 1, globalAlpha: 1, font: "", textAlign: "", shadowBlur: 0,
    /* 浏览器里 createLinearGradient 返回 CanvasGradient，stub 也得给一个带 addColorStop 的假对象 */
    createLinearGradient: function () { return { addColorStop: noop }; },
    createRadialGradient: function () { return { addColorStop: noop }; } };
  return new Proxy(base, {
    get(t, p) { if (p in t) return t[p]; return noop; },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const ctxs = ctxStub();
function makeEl(id) {
  return {
    id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [],
    width: 800, height: 600,
    addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop,
    setAttribute: noop, getAttribute: function () { return null; }, click: noop,
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 800, height: 600 }; },
    getContext: function () { return ctxs; },
    querySelectorAll: function () { return []; }
  };
}
const els = {};
const store = {};
const sandbox = {
  console: console,
  Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
  isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat, Infinity: Infinity, NaN: NaN,
  Uint8Array: Uint8Array, Int32Array: Int32Array, Float32Array: Float32Array,
  Map: Map, Set: Set, Error: Error, Promise: Promise, TextEncoder: TextEncoder, TextDecoder: TextDecoder,
  Blob: Blob, Response: Response, CompressionStream: (typeof CompressionStream !== "undefined" ? CompressionStream : undefined),
  DecompressionStream: (typeof DecompressionStream !== "undefined" ? DecompressionStream : undefined),
  atob: atob, btoa: btoa, URL: URL, navigator: { clipboard: null, share: null },
  setTimeout: noop, clearTimeout: noop,
  requestAnimationFrame: function () { return 1; },
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  document: {
    getElementById: function (id) { return els[id] || (els[id] = makeEl(id)); },
    createElement: function (t) { return makeEl("new-" + t); },
    querySelectorAll: function () { return []; },
    body: { appendChild: noop }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.innerWidth = 1280;
sandbox.window.innerHeight = 720;
sandbox.window.devicePixelRatio = 1;
sandbox.window.addEventListener = noop;

const ctx = vm.createContext(sandbox);
try { vm.runInContext(code, ctx, { filename: "game.js" }); }
catch (e) { console.error("FAIL 运行期异常: " + e.message + "\n" + (e.stack || "")); process.exit(1); }
console.log("PASS 初始化与 boot()");

const W = () => ctx.W;
function stats(tag) {
  const w = W();
  const c = ctx.countUnits();
  console.log("  [" + tag + "] t=" + w.t.toFixed(1) + "s 人类=" + c.h + " 丧尸=" + c.z + " 母体=" + c.m +
    " 击杀=" + w.kills + " 感染=" + w.infected + " 资源=" + Math.floor(w.resources) + " 子弹=" + w.bullets.length);
}
stats("初始");

function checkFinite(tag) {
  const w = W();
  for (const u of w.units) {
    if (!isFinite(u.x) || !isFinite(u.y) || !isFinite(u.vx) || !isFinite(u.vy)) {
      throw new Error(tag + " 单位 id=" + u.id + " 出现 NaN/Inf 坐标");
    }
  }
  for (const b of w.bullets) if (!isFinite(b.x) || !isFinite(b.y)) throw new Error(tag + " 子弹坐标异常");
}
function checkOverlap(tag) {
  const u = W().units;
  let worst = 0, pairs = 0;
  for (let i = 0; i < u.length; i++) {
    for (let j = i + 1; j < u.length; j++) {
      const a = u[i], b = u[j];
      if (Math.abs(a.x - b.x) > 60 || Math.abs(a.y - b.y) > 60) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const pen = (a.r + b.r) - d;
      if (pen > 1) { pairs++; if (pen > worst) worst = pen; }
    }
  }
  console.log("  [" + tag + "] 重叠对=" + pairs + " 最大穿透=" + worst.toFixed(2) + "px");
  return worst;
}
function checkBounds(tag) {
  for (const u of W().units) {
    if (u.x < -1 || u.y < -1 || u.x > ctx.CFG.world.w + 1 || u.y > ctx.CFG.world.h + 1)
      throw new Error(tag + " 单位越界 id=" + u.id + " (" + u.x.toFixed(1) + "," + u.y.toFixed(1) + ")");
  }
}

const t0 = Date.now();
const STEPS = 1800;
let maxFrameMs = 0;
for (let i = 0; i < STEPS; i++) {
  const s0 = process.hrtime.bigint();
  ctx.stepSim(1 / 60);
  const ms = Number(process.hrtime.bigint() - s0) / 1e6;
  if (ms > maxFrameMs) maxFrameMs = ms;
  if (i % 300 === 0) { checkFinite("step" + i); checkBounds("step" + i); }
}
const elapsed = Date.now() - t0;
console.log("PASS 模拟 " + STEPS + " 步（" + (STEPS / 60).toFixed(0) + " 秒游戏时间）耗时 " + elapsed + "ms，单步最大 " + maxFrameMs.toFixed(2) + "ms");
checkFinite("结束");
checkBounds("结束");
stats("模拟后");
const worst = checkOverlap("模拟后");
if (worst > 6) throw new Error("刚体分离不合格，最大穿透 " + worst.toFixed(2) + "px");

// 渲染路径 + 图元统计
const counts = { arc: 0, fillRect: 0, stroke: 0, fill: 0, lineTo: 0 };
function countingCtx() {
  const base = { canvas: null, globalCompositeOperation: "", fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    createLinearGradient: function () { return { addColorStop: noop }; },
    createRadialGradient: function () { return { addColorStop: noop }; } };
  return new Proxy(base, {
    get(t, p) { if (p in t) return t[p]; if (typeof p === "string" && p in counts) return function () { counts[p]++; }; return noop; },
    set(t, p, v) { t[p] = v; return true; }
  });
}
try {
  const realGet = els["cv"].getContext;
  els["cv"].getContext = function () { return countingCtx(); };
  ctx.CTX = els["cv"].getContext();
  ctx.UI.debug = false; ctx.render();
  ctx.UI.debug = true; ctx.render();
  ctx.UI.debug = false;
  els["cv"].getContext = realGet;
} catch (e) { throw new Error("渲染异常: " + e.message + "\n" + e.stack); }
console.log("PASS 渲染路径（含调试视图） 图元: 圆弧=" + counts.arc + " 矩形=" + counts.fillRect + " 填充=" + counts.fill + " 描边=" + counts.stroke + " 线段=" + counts.lineTo);
if (counts.arc < 5 && ctx.W.units.length > 20) throw new Error("渲染图元过少，可能没有画出单位");

// 单位不得卡在障碍物内部
function checkInsideObstacle(tag) {
  const w = ctx.W;
  let bad = 0, worst = null;
  for (const u of w.units) {
    for (const o of w.obstacles) {
      if (u.x > o.x && u.x < o.x + o.w && u.y > o.y && u.y < o.y + o.h) {
        bad++; if (!worst) worst = "id=" + u.id + " kind=" + u.kind + " (" + u.x.toFixed(0) + "," + u.y.toFixed(0) + ")";
        break;
      }
    }
  }
  console.log("  [" + tag + "] 卡在障碍内的单位=" + bad + (worst ? " 例如 " + worst : ""));
  return bad;
}
const inside = checkInsideObstacle("模拟后");
if (inside > 2) throw new Error("有 " + inside + " 个单位卡在障碍物内部");

// 防线岗位合理性
const posts = ctx.W.posts;
const humans = ctx.W.units.filter((u) => ctx.isHuman(u));
const withPost = humans.filter((u) => u.post).length;
console.log("PASS 防线 岗位数=" + posts.length + " 已分配=" + withPost + "/" + humans.length);
if (withPost > posts.length) throw new Error("岗位分配超过岗位总数");

// 尸潮投放
const beforeWave = ctx.countUnits().z;
ctx.addUnit("zombie", 300, 300);
console.log("PASS 单位生成 丧尸 " + beforeWave + " -> " + ctx.countUnits().z);

// 存档往返
const snap = ctx.serialize();
const json = JSON.stringify(snap);
const before = ctx.countUnits();
ctx.deserialize(JSON.parse(json));
const after = ctx.countUnits();
if (before.h !== after.h || before.z !== after.z) throw new Error("存档往返单位数不一致 " + JSON.stringify(before) + " vs " + JSON.stringify(after));
console.log("PASS 存档往返 人类=" + after.h + " 丧尸=" + after.z + " JSON=" + (json.length / 1024).toFixed(1) + "KB");
for (let i = 0; i < 120; i++) ctx.stepSim(1 / 60);
checkFinite("读档后");
console.log("PASS 读档后继续演算 2 秒");

// 投放与经济
ctx.W.resources = 500;
const okSand = ctx.doPlace("sandbag", 2000, 1152);
const okRifle = ctx.doPlace("rifle", 2100, 1152);
console.log("PASS 投放测试 sandbag=" + okSand + " rifle=" + okRifle + " 障碍数=" + ctx.W.obstacles.length);
for (let i = 0; i < 60; i++) ctx.stepSim(1 / 60);
checkFinite("投放后");

console.log("\n=== 全部自检通过 ===");
