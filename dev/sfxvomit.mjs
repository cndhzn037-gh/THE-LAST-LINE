import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const i0 = html.indexOf("<script>") + 8;
const i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
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
vm.runInContext(gcode, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
const SFX = ctx.SFX;
const log = [];
function mkParam(name) {
  return {
    _v: 0,
    set value(v) { this._v = v; }, get value() { return this._v; },
    setValueAtTime: function (v, t) { log.push([name, "set", v, +t.toFixed(3)]); },
    linearRampToValueAtTime: function (v, t) { log.push([name, "lin", v, +t.toFixed(3)]); },
    exponentialRampToValueAtTime: function (v, t) { log.push([name, "exp", v, +t.toFixed(3)]); },
    setTargetAtTime: noop
  };
}
function mkNode(kind, extra) {
  const n = Object.assign({ kind: kind, connected: [], connect: function (t) { n.connected.push(t && t.kind); }, disconnect: noop,
    start: function () { log.push([kind, "start"]); }, stop: function () { log.push([kind, "stop"]); } }, extra || {});
  return n;
}
let panners = 0;
const audio = {
  currentTime: 10, sampleRate: 48000, state: "running",
  destination: { kind: "dest" },
  createOscillator: function () { const o = mkNode("osc"); o.type = "sine"; o.frequency = mkParam("osc.freq"); return o; },
  createBiquadFilter: function () { const f = mkNode("filter", { Q: { value: 0 } }); f.type = "lowpass"; f.frequency = mkParam("filter.freq"); return f; },
  createGain: function () { const g = mkNode("gain"); g.gain = mkParam("gain"); return g; },
  createBufferSource: function () { return mkNode("src", { buffer: null, loop: false }); },
  createStereoPanner: function () { panners++; return mkNode("pan", { pan: { value: 0 } }); },
  createConvolver: function () { return mkNode("conv", { buffer: null }); },
  createDynamicsCompressor: function () { return mkNode("comp"); },
  createBuffer: function () { return { getChannelData: () => new Float32Array(8) }; },
  resume: noop
};
SFX.ctx = audio;
SFX.master = mkNode("master");
SFX.wetIn = mkNode("wet");
SFX.noiseBuf = {};
SFX.ok = true; SFX.enabled = true; SFX.voices = 0;

console.log("=== 一、呕吐音效存在且能被调用 ===");
chk(typeof SFX.vomit === "function", "SFX.vomit 已定义");
let err = null;
try { SFX.vomit({ peak: 0.34, wet: 0.22 }); } catch (e) { err = e; }
chk(!err, "调用不报错" + (err ? "：" + err.message : ""));
const oscFreq = log.filter((l) => l[0] === "osc.freq");
const filtFreq = log.filter((l) => l[0] === "filter.freq");
console.log("  振荡器频率轨迹：" + oscFreq.map((l) => l[2]).join(" → ") + " Hz");
console.log("  滤波器频率轨迹：" + filtFreq.map((l) => l[2]).join(" → ") + " Hz");
chk(oscFreq.length >= 2 && oscFreq[0][2] > oscFreq[1][2], "喉音是往下滑的（高→低）");
chk(oscFreq[0][2] >= 120 && oscFreq[0][2] <= 200, "起始音高在低吼区间（120~200Hz）");
chk(oscFreq[oscFreq.length - 1][2] <= 80, "收尾沉到 80Hz 以下（那口闷呕）");
chk(log.filter((l) => l[0] === "src").length > 0, "还有一路湿噪声叠加");
chk(log.filter((l) => l[0] === "src" && l[1] === "start").length >= 1, "噪声源真的启动了");
chk(log.filter((l) => l[0] === "osc" && l[1] === "start").length >= 1, "振荡器真的启动了");
chk(SFX.voices === 2, "声道计数 +2（两路）");

console.log("=== 二、接在伸舌头这一动作上 ===");
const iShoot = gcode.indexOf("function shootTongue");
const iVomit = gcode.indexOf("SFX.vomit(");
chk(iVomit >= 0, "shootTongue 里调用了 vomit");
chk(iShoot >= 0 && iVomit > iShoot && iVomit - iShoot < 800, "调用位置就在 shootTongue 内");
const iBand = gcode.indexOf("SFX.band(", iShoot);
chk(iBand < 0 || iBand - iShoot > 800, "旧的单薄 420Hz 音已经换掉");

console.log("=== 三、pan 缺省时不会漏接 ===");
log.length = 0; panners = 0;
SFX.vomit({ peak: 0.2 });
chk(panners === 0, "不传 pan 就不建声像器");
chk(log.filter((l) => l[1] === "start").length >= 2, "两路都还在响");
SFX.vomit({ peak: 0.2, pan: -0.6 });
chk(panners === 1, "传了 pan 就会建声像器");

console.log("=== 四、混音拥挤时自动压低 ===");
SFX.voices = 240;
log.length = 0;
SFX.vomit({ peak: 0.4 });
const peaks = log.filter((l) => l[0] === "gain" && l[1] === "lin").map((l) => l[2]);
console.log("  240 路同时发声时峰值 = " + (peaks[0] || 0).toFixed(3) + "（原设 0.400）");
chk(peaks.length > 0 && peaks[0] <= 0.4, "混音拥挤时单发音量被压低");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));