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

ctx.START.gameMode = "escort";
ctx.START.civCount = 4;
ctx.START.squad = { rifle: 2, mg: 0, sniper: 0, shield: 0 };
ctx.EDIT.touched = false; ctx.EDIT.unitsEdited = false;
ctx.beginGame();
console.log("A. 开局后：mode=" + W().mode + " prisonDoor=" + (W().prisonDoor ? "有" : "无") +
  " doors=" + W().doors.length + " prison障碍=" + W().obstacles.filter(o => o.prison).length);

ctx.startEditor();
ctx.EDIT.tool = "wall"; ctx.EDIT.mode = "drag";
ctx.editPointerDown(1000, 1000); ctx.editPointerMove(1300, 1200); ctx.editPointerUp(1300, 1200);
console.log("B. 编辑后：touched=" + ctx.EDIT.touched + " doors=" + W().doors.length +
  " prison门在doors里=" + (W().doors.filter(d => d.prison).length) + " prisonDoor=" + (W().prisonDoor ? "有" : "无"));

ctx.finishEditor();
console.log("C. 完成后：touched=" + ctx.EDIT.touched + " START.gameMode=" + ctx.START.gameMode +
  " doors=" + W().doors.length + " 障碍=" + W().obstacles.length);

const savedObs = W().obstacles, savedDoors = W().doors;
ctx.beginGame();
console.log("D. 再次开局：mode=" + W().mode + " 障碍=" + W().obstacles.length +
  " doors=" + W().doors.length + " prison门在doors里=" + W().doors.filter(d => d.prison).length +
  " prisonDoor=" + (W().prisonDoor ? "有" : "无"));
console.log("   保留的是同一份 doors 吗 = " + (W().doors === savedDoors ? "是" : "否（被换成新数组）"));
console.log("   障碍表里还有 prison 实体吗 = " + W().obstacles.filter(o => o.prison).length);
