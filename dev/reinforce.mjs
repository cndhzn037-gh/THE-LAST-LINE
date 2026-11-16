import fs from "node:fs";
import vm from "node:vm";
const file = process.argv[2];
const html = fs.readFileSync(file, "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
function ctxStub() {
  const base = { canvas: null, globalCompositeOperation: "source-over", fillStyle: "", strokeStyle: "",
    lineWidth: 1, globalAlpha: 1, font: "", textAlign: "", shadowBlur: 0,
    createLinearGradient: function () { return { addColorStop: noop }; },
    createRadialGradient: function () { return { addColorStop: noop }; } };
  return new Proxy(base, { get(t, p) { if (p in t) return t[p]; return noop; }, set(t, p, v) { t[p] = v; return true; } });
}
const ctxs = ctxStub();
function makeEl(id) {
  return { id: id, style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [],
    width: 800, height: 600, addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop,
    setAttribute: noop, getAttribute: function () { return null; }, click: noop,
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 800, height: 600 }; },
    getContext: function () { return ctxs; }, querySelectorAll: function () { return []; }, querySelector: function () { return null; } };
}
const els = {}, store = {};
const sandbox = {
  console: console, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
  isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat, Infinity: Infinity, NaN: NaN,
  Uint8Array: Uint8Array, Int32Array: Int32Array, Float32Array: Float32Array,
  Map: Map, Set: Set, Error: Error, setTimeout: noop, clearTimeout: noop,
  requestAnimationFrame: function () { return 1; },
  localStorage: { getItem: function (k) { return store[k] ?? null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
  document: { getElementById: function (id) { return els[id] || (els[id] = makeEl(id)); },
    createElement: function (t) { return makeEl("new-" + t); }, querySelectorAll: function () { return []; }, body: { appendChild: noop } }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.innerWidth = 1280;
sandbox.window.innerHeight = 720;
sandbox.window.devicePixelRatio = 1;
sandbox.window.addEventListener = noop;
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx, { filename: "game.js" });

let fail = 0;
function expect(tag, ok, extra) {
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + tag + (extra === undefined ? "" : "  " + extra));
}
function humans() {
  let n = 0;
  for (const u of ctx.W.units) if (!u.dead && ctx.isHuman(u) && !ctx.isZombieSide(u)) n++;
  return n;
}
function zombies() {
  let n = 0;
  for (const u of ctx.W.units) if (!u.dead && ctx.isZombieSide(u)) n++;
  return n;
}

// clear the map: keep only a handful of humans, no zombies
ctx.W.units.length = 0;
ctx.W.over = false;
ctx.W.paused = false;
const CX = ctx.CFG.world.w / 2, CY = ctx.CFG.world.h / 2;
for (let i = 0; i < 6; i++) {
  const a = Math.PI * 2 * i / 6;
  ctx.addUnit("rifle", CX + Math.cos(a) * 260, CY + Math.sin(a) * 260);
}
ctx.addUnit("civilian", CX + 40, CY + 40);
const h0 = humans();
const z0 = zombies();
expect("起始人类 " + h0 + " / 丧尸 " + z0, h0 === 7 && z0 === 0);

ctx.startReinforce();
expect("倒计时启动 phase=1", ctx.W.reinf && ctx.W.reinf.phase === 1);
expect("第一轮 90 秒", Math.abs(ctx.W.reinf.t - 90) < 1e-6, ctx.W.reinf.t);

const STEP = 1 / 60;
function run(sec) { for (let i = 0; i < Math.round(sec / STEP); i++) ctx.stepReinforce(STEP); }

run(89.5);
expect("89.5 秒后仍在第一轮", ctx.W.reinf.phase === 1);
expect("剩余约 0.5 秒", Math.abs(ctx.W.reinf.t - 0.5) < 0.05, ctx.W.reinf.t.toFixed(3));

run(0.6);
expect("进入第二轮 phase=2", ctx.W.reinf.phase === 2, "phase=" + ctx.W.reinf.phase);
const h1 = humans();
expect("免费获得小型混编 +6 人", h1 === h0 + 6, h0 + " -> " + h1);
expect("第二轮 30 秒", ctx.W.reinf.t > 29.5 && ctx.W.reinf.t <= 30, ctx.W.reinf.t.toFixed(3));

run(30.2);
expect("进入第三轮 phase=3", ctx.W.reinf.phase === 3, "phase=" + ctx.W.reinf.phase);
const h2 = humans();
expect("免费获得中型混编 +11 人", h2 === h1 + 11, h1 + " -> " + h2);
expect("第三轮 90 秒", ctx.W.reinf.t > 89 && ctx.W.reinf.t <= 90, ctx.W.reinf.t.toFixed(3));

run(ctx.W.reinf.t - 0.3);
expect("第三轮未结束时还未降临", ctx.W.reinf.phase === 3);
run(0.4);
expect("帝皇特使降临 phase=4", ctx.W.reinf.phase === 4, "phase=" + ctx.W.reinf.phase);
expect("光柱计时启动", ctx.W.reinf.pillT > 0, ctx.W.reinf.pillT.toFixed(3));
expect("屏幕震动已触发", ctx.W.shakeT > 0 && ctx.W.shakeMag > 0, "shakeT=" + ctx.W.shakeT.toFixed(2) + " mag=" + ctx.W.shakeMag);

run(0.5);
expect("粒子正在喷发", ctx.W.reinf.parts.length > 0, "粒子=" + ctx.W.reinf.parts.length);

let renderOk = true;
try { ctx.render(); } catch (e) { renderOk = false; console.log("  渲染异常: " + e.message); }
expect("降临特效渲染不报错", renderOk);

ctx.W.reinf.phase = 2; ctx.W.reinf.t = 12.345;
let timerOk = true;
try { ctx.render(); } catch (e) { timerOk = false; console.log("  渲染异常: " + e.message); }
expect("倒计时渲染不报错", timerOk);
ctx.W.reinf.phase = 4; ctx.W.reinf.t = 0;

run(0.6);
expect("1 秒后光柱结束", ctx.W.reinf.pillT <= 0, ctx.W.reinf.pillT.toFixed(3));
expect("冲击波已经推开", ctx.W.reinf.waveR > 0 && ctx.W.reinf.waveT > 0, "r=" + ctx.W.reinf.waveR.toFixed(0));

run(5.2);
let heroes = 0, nonHero = 0;
for (const u of ctx.W.units) {
  if (u.dead || !ctx.isHuman(u) || ctx.isZombieSide(u)) continue;
  if (u.hero) heroes++; else nonHero++;
}
expect("冲击波扫过后全部升格为英雄", nonHero === 0 && heroes > 0, "英雄=" + heroes + " 未升格=" + nonHero);
expect("冲击波走完全场", ctx.W.reinf.waveT >= ctx.W.reinf.waveDur);

ctx.W.reinf.parts.length = 0;
run(0.1);
expect("全部结束 phase=5", ctx.W.reinf.phase === 5, "phase=" + ctx.W.reinf.phase);

// 剧情提示：会自己到期消失，且不受隐藏界面影响
ctx.STORY.lines.length = 0;
ctx.storyLine("测试提示 A", { life: 1 });
ctx.storyLine("测试提示 B", { life: 2 });
expect("剧情提示已入队", ctx.STORY.lines.length === 2, ctx.STORY.lines.length);
ctx.HIDE_UI = true;
ctx.render();
ctx.HIDE_UI = false;
expect("隐藏界面时剧情提示仍会绘制", ctx.STORY.lines.length === 2);
for (let i = 0; i < 70; i++) ctx.stepStory(1 / 60);
expect("短提示到期后被移除", ctx.STORY.lines.length === 1, ctx.STORY.lines.length);
expect("长提示还在", ctx.STORY.lines[0] && ctx.STORY.lines[0].text === "测试提示 B");
for (let i = 0; i < 70; i++) ctx.stepStory(1 / 60);
expect("全部到期后清空", ctx.STORY.lines.length === 0);

// 降临时的镜头平滑聚焦
ctx.CAM.x = 300; ctx.CAM.y = 400;
const startX = ctx.CAM.x, startY = ctx.CAM.y;
ctx.focusCameraOn(2600, 1500, 0.9);
let midOk = false, midActive = false, prev = ctx.CAM.x;
for (let i = 0; i < 60; i++) {
  const active = ctx.stepCameraFocus(1 / 60);
  if (i === 27) { midOk = Math.abs(ctx.CAM.x - startX) > 10; midActive = active; }
}
expect("聚焦期间镜头确实在移动", midOk);
expect("聚焦期间接管判断返回 true", midActive === true);
expect("聚焦结束精确落在落点",
  Math.abs(ctx.CAM.x - 2600) < 0.5 && Math.abs(ctx.CAM.y - 1500) < 0.5,
  ctx.CAM.x.toFixed(1) + "," + ctx.CAM.y.toFixed(1));
expect("聚焦结束后交还控制", ctx.stepCameraFocus(1 / 60) === false);

console.log(fail === 0 ? "=== 支援部队测试全部通过 ===" : "=== 有 " + fail + " 项失败 ===");
process.exit(fail === 0 ? 0 : 1);