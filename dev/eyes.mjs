import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
const counts = { ellipse: 0, lineTo: 0, arc: 0, fill: 0 };
const eyes = [];            /* 记录所有椭圆（只有眼睛用它） */
let gunColorSeen = false, pendingMove = null, gunSeg = null;
const GUN = "#5a606b";
function ctxStub() {
  const base = { canvas: null, fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "", textAlign: "",
    globalCompositeOperation: "", lineCap: "", shadowBlur: 0,
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) };
  return new Proxy(base, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "ellipse") return function (x, y, rx, ry) { counts.ellipse++; eyes.push({ x: x, y: y, rx: rx, ry: ry }); };
      if (p === "moveTo") return function (x, y) { pendingMove = { x: x, y: y }; };
      if (p === "lineTo") return function (x, y) {
        counts.lineTo++;
        if (gunColorSeen && !gunSeg && pendingMove) { gunSeg = { x0: pendingMove.x, y0: pendingMove.y, x1: x, y1: y }; }
        return noop;
      };
      if (typeof p === "string" && p in counts) return function () { counts[p]++; };
      return noop;
    },
    set(t, p, v) { if (p === "strokeStyle" && v === GUN) gunColorSeen = true; t[p] = v; return true; }
  });
}
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => ctxStub(), querySelectorAll: () => [], querySelector: () => null }; }
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
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }

ctx.GAME_MODE = "defense";
ctx.buildScenario(999, 30);

console.log("=== 一、朝向逻辑 ===");
const all = W().units.filter(u => !u.dead);
chk(all.every(u => typeof u.faceAng === "number" && isFinite(u.faceAng)), "每个单位都有面朝方向（" + all.length + " 个）");
const gunner = W().units.find(u => u.kind === "rifle" && !u.dead);
const tgt = W().units.find(u => ctx.isZombie(u) && !u.dead);
gunner.x = 1000; gunner.y = 1000; gunner.vx = 0; gunner.vy = 0;
tgt.x = 1000; tgt.y = 1400; tgt.hp = 99999;
ctx.fireBullet(gunner, tgt, 0, 2, 1, false, false);
chk(Math.abs(gunner.faceAng - Math.PI / 2) < 0.02, "开火瞬间转身面向目标");
gunner.vx = 0; gunner.vy = -160; gunner.aimT = 0.3;
ctx.integrate(1 / 60);
chk(Math.abs(gunner.faceAng - Math.PI / 2) < 0.05, "边退边打时仍朝着敌人");
gunner.aimT = 0; gunner.vx = -200; gunner.vy = 0;
ctx.integrate(1 / 60);
chk(Math.abs(Math.abs(gunner.faceAng) - Math.PI) < 0.05, "没开火时朝向跟随移动");

console.log("\n=== 二、武器规格 ===");
const g1 = ctx.gunSpecOf("rifle"), g2 = ctx.gunSpecOf("mg"), g3 = ctx.gunSpecOf("sniper"), g4 = ctx.gunSpecOf("shield");
console.log("  步枪 " + g1.len + "×" + g1.w + "  机枪 " + g2.len + "×" + g2.w + "  狙击 " + g3.len + "×" + g3.w + "  手枪 " + g4.len + "×" + g4.w);
chk(g2.w > g1.w && g2.len > g1.len, "机枪比步枪更长更粗");
chk(g3.len > g2.len, "狙击最长");
chk(g4.len < g1.len && g4.w < g1.w, "破盾手枪最小");
chk(ctx.gunSpecOf("civilian") === null && ctx.gunSpecOf("zombie") === null, "平民与丧尸没有枪");

console.log("\n=== 三、实画一帧：眼睛够小、武器在右手边 ===");
for (const u of W().units) u.dead = true;
const solo = ctx.addUnit("rifle", 1000, 1000);
solo.faceAng = 0;                       /* 面朝右 -> 右手边是屏幕下方 */
ctx.CAM.x = 1000; ctx.CAM.y = 1000;
ctx.stepSim(1 / 60);
solo.faceAng = 0;
eyes.length = 0; gunSeg = null;
ctx.render();
const z = ctx.CAM.zoom, ur = solo.r * z;
const cxS = ctx.w2sx(solo.x), cyS = ctx.w2sy(solo.y);
console.log("  缩放 z=" + z.toFixed(2) + "，单位屏幕半径 ur=" + ur.toFixed(1) + "px，画出眼睛 " + eyes.length + " 颗");
chk(eyes.length === 2, "画出两颗眼睛");
if (eyes.length === 2) {
  const rx = Math.max(eyes[0].rx, eyes[1].rx), ry = Math.max(eyes[0].ry, eyes[1].ry);
  console.log("  眼睛半轴 " + rx.toFixed(2) + "×" + ry.toFixed(2) + "px，占半径 " + (rx / ur * 100).toFixed(1) + "%");
  chk(rx / ur <= 0.30, "眼睛的相对尺寸比原先（30%）更小或持平");
  chk(rx < 1.2, "默认视角下不到 1.2px —— 要盯着看才认得出来（" + rx.toFixed(2) + "px）");
  /* 拉近视角后眼睛应当按比例略微变大，而不是永远卡在下限 */
  ctx.CAM.zoom = 1.6; eyes.length = 0;
  ctx.render();
  const near = Math.max(eyes[0].rx, eyes[1].rx);
  console.log("  拉近到 z=1.6（半径 " + (solo.r * 1.6).toFixed(1) + "px）后眼睛半轴 " + near.toFixed(2) + "px，占半径 " + (near / (solo.r * 1.6) * 100).toFixed(1) + "%");
  chk(near > rx && near / (solo.r * 1.6) <= 0.16, "拉近后眼睛跟着放大，但保持在同一比例");
  ctx.CAM.zoom = z; eyes.length = 0; ctx.render();
  chk(eyes.every(e => e.x > cxS), "两颗眼睛都在面朝方向（右）的前方");
  chk(Math.abs(eyes[0].y - eyes[1].y) > 0.4, "分列朝向轴两侧");
}
console.log("  武器线段 = " + (gunSeg ? "有" : "无"));
chk(gunSeg !== null, "画出了深灰武器（" + GUN + "，与黑背景区分得开）");
if (gunSeg) {
  const cy = (gunSeg.y0 + gunSeg.y1) / 2;
  console.log("  武器线 y=" + gunSeg.y0.toFixed(1) + " → " + gunSeg.y1.toFixed(1) + "，单位中心 y=" + cyS.toFixed(1));
  chk(cy > cyS + 0.5, "武器靠在单位的右手边（面朝右时位于下方），不在中轴上");
  chk(gunSeg.x1 > cxS, "武器朝面朝方向伸出");
}

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
