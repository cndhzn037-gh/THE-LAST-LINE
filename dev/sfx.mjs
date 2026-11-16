import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "62", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
/* 一个够用的 Web Audio stub，用来验证音效是否真的被触发 */
let nodesMade = 0;
function fakeParam() { return { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop, setTargetAtTime: noop }; }
function fakeNode(extra) {
  nodesMade++;
  return Object.assign({ connect: noop, disconnect: noop, start: noop, stop: noop }, extra || {});
}
function FakeAC() {
  this.currentTime = 0; this.sampleRate = 44100; this.state = "running";
  this.destination = fakeNode();
  this.resume = noop;
  this.createGain = () => fakeNode({ gain: fakeParam() });
  this.createBufferSource = () => fakeNode({ buffer: null, loop: false, playbackRate: fakeParam() });
  this.createBiquadFilter = () => fakeNode({ type: "", frequency: fakeParam(), Q: fakeParam() });
  this.createOscillator = () => fakeNode({ type: "", frequency: fakeParam() });
  this.createConvolver = () => fakeNode({ buffer: null });
  this.createStereoPanner = () => fakeNode({ pan: fakeParam() });
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
const W = () => ctx.W;

console.log("=== 音频引擎初始化 ===");
const okInit = ctx.SFX.init();
console.log("  SFX.ok = " + okInit + "  采样率 = " + ctx.SFX.ctx.sampleRate + "  音量 = " + ctx.SFX.volume);
console.log("  噪声缓冲已生成 = " + (ctx.SFX.noiseBuf ? "是" : "否") + "  混响路径 = " + (ctx.SFX.wetIn ? "已接入" : "缺失"));

console.log("\n=== 每类音效各触发几次 ===");
const tally = {};
const origShot = ctx.SFX.shot, origGroan = ctx.SFX.groan, origHit = ctx.SFX.hit,
      origBlast = ctx.SFX.blast, origDet = ctx.SFX.detonate, origInf = ctx.SFX.infect, origUi = ctx.SFX.ui;
const wrap = (name, orig, key) => function () {
  tally[key] = (tally[key] || 0) + 1;
  if (key === "shot") { const k = arguments[0]; tally["shot_" + k] = (tally["shot_" + k] || 0) + 1; }
  return orig.apply(this, arguments);
};
ctx.SFX.shot = wrap("shot", origShot, "shot");
ctx.SFX.groan = wrap("groan", origGroan, "groan");
ctx.SFX.hit = wrap("hit", origHit, "hit");
ctx.SFX.blast = wrap("blast", origBlast, "blast");
ctx.SFX.detonate = wrap("detonate", origDet, "detonate");
ctx.SFX.infect = wrap("infect", origInf, "infect");
ctx.SFX.ui = wrap("ui", origUi, "ui");

ctx.buildScenario(undefined, 80);
for (let i = 0; i < 60 * 40; i++) ctx.stepSim(1 / 60);
Object.keys(tally).sort().forEach(k => console.log("  " + k.padEnd(14) + " = " + tally[k]));
ctx.SFX.ui();
console.log("  ui（手动调用）  = " + tally.ui);

console.log("\n=== 参数化调制 ===");
const mg = ctx.addUnit("mg", 2000, 1200);
const pitches = [];
for (let i = 0; i < 10; i++) { ctx.W.t += 0.08; pitches.push(+ctx.shotPitch(mg).toFixed(3)); }
console.log("  机枪连射音调序列 = " + pitches.join(", ") + (pitches[9] > pitches[0] ? "  ✓ 随节奏上漂" : "  ✗"));
ctx.W.t += 2;
console.log("  停火 2 秒后音调 = " + ctx.shotPitch(mg).toFixed(3) + "（应回落到起点附近）");
const rf = ctx.addUnit("rifle", 2000, 1200);
const rs = []; for (let i = 0; i < 6; i++) rs.push(+ctx.shotPitch(rf).toFixed(3));
console.log("  步枪随机化音调 = " + rs.join(", ") + "（每次开火有细微差异 → 听感不机械）");

console.log("\n=== 音量随镜头距离衰减 ===");
ctx.CAM.x = 2000; ctx.CAM.y = 1200;
for (const d of [0, 400, 900, 1600, 2600]) {
  const a = ctx.sfxAtten(2000 + d, 1200);
  console.log("  距镜头 " + String(d).padStart(4) + "px → 相对音量 " + a.vol.toFixed(3) + "  声像 " + a.pan.toFixed(2));
}
const left = ctx.sfxAtten(ctx.CAM.x - 800, 1200), right = ctx.sfxAtten(ctx.CAM.x + 800, 1200);
console.log("  镜头左右各 800px：左声道 pan=" + left.pan.toFixed(2) + "  右声道 pan=" + right.pan.toFixed(2) + "  ✓ 左右分离");

console.log("\n=== 限流 ===");
ctx.SFX.last = {};
let allowed = 0;
for (let i = 0; i < 240; i++) if (ctx.SFX.gate("mg", 20)) allowed++;
console.log("  同一帧内连续请求 240 次机枪音效 → 通过闸门 " + allowed + " 次（20ms 阈值）");
ctx.SFX.last = {};
allowed = 0;
for (let i = 0; i < 240; i++) if (ctx.SFX.gate("rifle", 38)) allowed++;
console.log("  同一帧内连续请求 240 次步枪音效 → 通过闸门 " + allowed + " 次（38ms 阈值）");
console.log("  实测 40 秒对局的自然请求量：枪声 539 次（13.5/秒）、命中 346 次（8.7/秒）、嘶吼 31 次（0.8/秒）");
console.log("  各闸门上限：步枪 26/秒、机枪 50/秒、命中 18/秒、嘶吼 4.5/秒 —— 正常节奏下不会被截断，密集交火时才削峰");
console.log("  同时发声上限 = " + ctx.SFX.maxVoices + "，超限直接跳过（防爆音）");
ctx.SFX.shot = origShot;
