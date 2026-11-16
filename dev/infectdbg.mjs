import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const c2 = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [] }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720; sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
const ctx = vm.createContext(sb);
vm.runInContext(code, ctx, { filename: "game.js" });

function run(gap, frames) {
  ctx.W.units.length = 0; ctx.W.obstacles.length = 0; ctx.W.doors.length = 0; ctx.W.bullets.length = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
  const civ = ctx.addUnit("civilian", 2000, 1200);
  const z = ctx.addUnit("zombie", 2000 + 16 + gap, 1200);
  z.pounceCd = 999;
  console.log("--- gap=" + gap + "（设定间距 " + (16 + gap) + "px，接触阈值 " + (16 + ctx.CFG.infect.touchPad) + "px）---");
  for (let i = 0; i < frames; i++) {
    civ.x = 2000; civ.y = 1200; civ.vx = 0; civ.vy = 0;
    z.x = 2000 + 16 + gap; z.y = 1200; z.vx = 0; z.vy = 0;
    ctx.stepSim(1 / 60);
    if (i % 40 === 0 || i === frames - 1) {
      const d = Math.hypot(civ.x - z.x, civ.y - z.y);
      console.log("  帧" + String(i).padStart(3) + " 实距=" + d.toFixed(2) + "px  infectT=" + civ.infectT.toFixed(3) +
        "  locked=" + civ.infectLocked + " 转化计数=" + ctx.W.infected);
    }
    if (civ.dead) { console.log("  已在帧 " + i + " 完成转化"); break; }
  }
}
run(0, 200);
run(3, 200);
run(-4, 200);
