import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
let oscCount = 0, srcCount = 0;
function node(extra) {
  return Object.assign({
    connect: noop, disconnect: noop, start: noop, stop: noop, buffer: null, loop: false, type: "",
    gain: { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop, setTargetAtTime: noop },
    frequency: { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop },
    Q: { value: 0 }, pan: { value: 0 }, threshold: { value: 0 }, knee: { value: 0 },
    ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }
  }, extra || {});
}
class FakeAC {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = "running"; this.destination = node(); }
  createGain() { return node(); }
  createOscillator() { oscCount++; return node(); }
  createBufferSource() { srcCount++; return node(); }
  createBiquadFilter() { return node(); }
  createDynamicsCompressor() { return node(); }
  createConvolver() { return node(); }
  createStereoPanner() { return node(); }
  createBuffer(ch, len) { return { length: len, getChannelData: () => new Float32Array(len) }; }
  resume() {}
}
const gradStub = { addColorStop: noop };
const rects = [];
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => {
      if (p in t) return t[p];
      if (p === "fillRect") return function (x, y, w, h) { rects.push({ x: x, y: y, w: w, h: h }); };
      return noop;
    }, set: (t, p, v) => { t[p] = v; return true; } });
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
sb.AudioContext = FakeAC;
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });
const W = () => ctx.W;
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }

console.log("=== 一、音效本身 ===");
ctx.SFX.init();
chk(ctx.SFX.ok === true, "音频引擎已就绪");
oscCount = 0; srcCount = 0;
ctx.SFX.alarm();
console.log("  警报：振荡器 " + oscCount + " 个，噪声源 " + srcCount + " 个");
chk(oscCount === 2, "警报只响两声（正好 2 个振荡器）");
oscCount = 0; srcCount = 0;
ctx.SFX.firework(0, 0);
console.log("  礼花：振荡器 " + oscCount + " 个（升空哨音 + 低频推力），噪声源 " + srcCount + " 个（爆裂 + 噼啪）");
chk(oscCount >= 2, "礼花有升空哨音与爆响");
chk(srcCount >= 6, "礼花有爆裂与一串噼啪");

console.log("\n=== 二、胜利：放烟花 ===");
ctx.buildScenario(999, 12);
chk(W().fxWin === 0 && W().fireworks.length === 0, "开局没有任何结算特效");
for (const u of W().units) if (ctx.isZombie(u)) u.dead = true;
ctx.cleanup();                        /* countUnits 不筛 dead，得先把尸体清掉 */
const ci = ctx.countUnits();
console.log("  诊断: over=" + W().over + " mode=" + W().mode + " GAME_MODE=" + ctx.GAME_MODE +
  " 统计丧尸=" + ci.z + " 母体=" + (ci.m === undefined ? "-" : ci.m) + " 人类=" + ci.h);
ctx.checkEnd();
console.log("  判定 " + W().result + "，特效计时 " + W().fxWin.toFixed(1) + "s");
chk(W().over === true && W().result === "win", "丧尸清空后判胜");
chk(W().fxWin > 0, "胜利特效已启动");
ctx.updateEndFx(1 / 60);
chk(W().fireworks.length >= 1, "立刻放出了第一朵烟花");
const n1 = W().fireworks.length;
for (let i = 0; i < 60 * 3; i++) ctx.updateEndFx(1 / 60);
console.log("  3 秒后场上烟花 " + W().fireworks.length + " 朵（首帧 " + n1 + " 朵），仍在持续补充");
chk(W().fireworks.length > 0, "胜利期间不断有新的烟花");
chk(W().fireworks.length <= 26, "烟花数量有上限，不会堆积");
const f0 = W().fireworks[0];
console.log("  烟花位置 (" + f0.x.toFixed(0) + "," + f0.y.toFixed(0) + ") 颜色色相 " + f0.hue + "，寿命 " + f0.dur + "s");
chk(f0.x > 0 && f0.x < ctx.VW && f0.y > 0 && f0.y < ctx.VH * 0.7, "烟花落在屏幕上半部");

console.log("\n=== 三、烟花会自己消散 ===");
W().fxWin = 0;                       /* 停止补充 */
for (let i = 0; i < 60 * 3; i++) ctx.updateEndFx(1 / 60);
console.log("  停止补充 3 秒后剩 " + W().fireworks.length + " 朵");
chk(W().fireworks.length === 0, "烟花全部消散，不会永久留在屏幕上");

console.log("\n=== 四、失败：渐变红光 ===");
ctx.buildScenario(999, 12);
for (const u of W().units) if (u.kind === "civilian") u.dead = true;
ctx.cleanup();
ctx.checkEnd();
console.log("  判定 " + W().result + "，红光计时 " + W().fxLose.toFixed(1) + "s");
chk(W().result === "lose", "平民全灭判负");
chk(W().fxLose > 0, "失败红光已启动");
chk(W().fireworks.length === 0, "失败时不放烟花");
function loseAlpha() {
  const lk = 1 - W().fxLose / CFG.fx.loseDur;
  return Math.sin(Math.PI * Math.pow(lk, 0.85)) * CFG.fx.losePeak;
}
const samples = [];
for (let i = 0; i < 60 * 4; i++) { ctx.updateEndFx(1 / 60); samples.push(loseAlpha()); }
const peak = Math.max.apply(null, samples);
const peakIdx = samples.indexOf(peak);
console.log("  红光强度 起 " + samples[0].toFixed(3) + " → 峰值 " + peak.toFixed(3) + "（第 " + (peakIdx / 60).toFixed(1) + " 秒）→ 末 " + samples[samples.length - 1].toFixed(3));
chk(samples[0] < peak * 0.5, "红光是从弱渐强上去的");
chk(samples[samples.length - 1] < peak * 0.5, "最后又退掉，不是一直红着");
chk(peak <= CFG.fx.losePeak + 1e-6, "峰值不过分遮挡画面（" + peak.toFixed(2) + "）");
chk(W().fxLose <= 0, "计时走完后特效结束");

console.log("\n=== 五、渲染不报错，且百分比条已上移 ===");
ctx.buildScenario(999, 10);
W().fxWin = 3; W().fxLose = 2;
ctx.spawnFirework();
rects.length = 0;
ctx.render();
const VH = ctx.VH, VW = ctx.VW;
const bar = rects.filter(r => Math.abs(r.y - (VH - 152)) < 3 && r.w > 200);
const old = rects.filter(r => Math.abs(r.y - (VH - 92)) < 3 && r.w > 200);
console.log("  屏幕高 " + VH + "；在 y=" + (VH - 152) + " 处找到 " + bar.length + " 个宽条，旧的 y=" + (VH - 92) + " 处 " + old.length + " 个");
chk(bar.length > 0, "百分比条已上移到 y=" + (VH - 152));
chk(old.length === 0, "原来的位置已经没有它了");
chk(rects.some(r => r.w === VW && r.h === VH), "失败红光会铺满整屏");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
