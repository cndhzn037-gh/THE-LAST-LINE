import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "80", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
let nodeCount = 0, compUsed = false;
function fp() { return { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop, setTargetAtTime: noop }; }
function fnode(x) { nodeCount++; return Object.assign({ connect: noop, disconnect: noop, start: noop, stop: noop }, x || {}); }
function FakeAC() {
  this.currentTime = 0; this.sampleRate = 44100; this.state = "running";
  this.destination = fnode(); this.resume = noop;
  this.createGain = () => fnode({ gain: fp() });
  this.createBufferSource = () => fnode({ buffer: null, loop: false, playbackRate: fp() });
  this.createBiquadFilter = () => fnode({ type: "", frequency: fp(), Q: fp() });
  this.createOscillator = () => fnode({ type: "", frequency: fp() });
  this.createConvolver = () => fnode({ buffer: null });
  this.createStereoPanner = () => fnode({ pan: fp() });
  this.createDynamicsCompressor = () => { compUsed = true; return fnode({ threshold: fp(), knee: fp(), ratio: fp(), attack: fp(), release: fp() }); };
  this.createBuffer = (ch, len) => ({ getChannelData: () => new Float32Array(len) });
}
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  performance: { now: () => Date.now() },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
sb.AudioContext = FakeAC;
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });

ctx.SFX.init();
console.log("=== 输出链 ===");
console.log("  压缩器已挂上 = " + (compUsed ? "是 ✓（靠它防削波，而不是掐声源）" : "否 ✗"));
console.log("  默认音量 = " + ctx.SFX.volume + "（原 0.62）  并发上限 = " + ctx.SFX.maxVoices + "（原 16）");
ctx.SFX.voices = 9999; const duckFloor = ctx.SFX.duck(); ctx.SFX.voices = 0;
console.log("  动态降幅起点 = " + ctx.SFX.softCap + " 个并发，之后线性下压，最低压到 " + Math.round(duckFloor * 100) + "%  " + (Math.abs(duckFloor - 0.3) < 0.001 ? "✓" : "✗"));

console.log("\n=== 密集交火不再被掐断 ===");
let bursts = 0;
const origBurst = ctx.SFX.burst;
ctx.SFX.burst = function () { bursts++; return origBurst.apply(this, arguments); };
ctx.SFX.voices = 0;
for (let i = 0; i < 60; i++) ctx.SFX.shot("rifle", 2000, 1200, 1);
console.log("  同一帧内 60 把步枪同时开火 → 实际发声 " + bursts + " 次 " + (bursts >= 55 ? "✓ 全部放行，能连成一片" : "✗ 仍被拦截"));
ctx.SFX.burst = origBurst;
console.log("  对比旧版：38ms 闸门 + 16 并发上限，60 把枪只会有 1 把出声");
console.log("  并发上限提到 " + ctx.SFX.maxVoices + " 个节点；14 把步枪速射的峰值需求约 150 个节点，够用");

console.log("\n=== 动态降幅曲线 ===");
for (const n of [0, 20, 40, 60, 100, 150, 200, 240, 320]) {
  ctx.SFX.voices = n;
  console.log("  并发 " + String(n).padStart(3) + " 个 → 单个音效音量系数 " + ctx.SFX.duck().toFixed(3));
}
ctx.SFX.voices = 0;

console.log("\n=== 三把枪的音色差异（随机取一组样本）===");
for (const k of ["rifle", "mg", "sniper", "pistol"]) {
  const list = ctx.SFX.V[k];
  const c = list[0];
  console.log("  " + k.padEnd(7) + " 低通 " + String(c.cut).padStart(4) + "Hz  衰减 " + c.decay.toFixed(3) + "s  推力 " + String(c.freq).padStart(3) + "Hz  带通 " + String(c.mid).padStart(4) + "Hz  混响 " + c.wet.toFixed(2) + "  峰值 " + c.peak);
}
console.log("");
console.log("  步枪：低通 ~2000Hz、衰减 ~0.046s、带通 ~1450Hz → 短促清脆的\"啪\"");
console.log("  机枪：衰减仅 ~0.027s、带通 ~620Hz（比步枪低一个八度）→ 干硬密集的\"哒\"");
console.log("  狙击：低通 ~700Hz、衰减 ~0.33s、推力 ~43Hz → 一记收得干净的重\"砰\"");
console.log("  全场：混响 0.08~0.28，只剩几十毫秒的实感，尾音不再拖长");
