import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
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
vm.runInContext(code, ctx, { filename: "game.js" });
const W = () => ctx.W;
const P = ctx.PLAYER;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function tick(n) { for (let i = 0; i < n; i++) { ctx.stepPlayerInput(1 / 60); ctx.stepSim(1 / 60); } }
function parkZombies() { for (const u of W().units) if (ctx.isZombie(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; } }

ctx.GAME_MODE = "defense";
ctx.buildScenario(999, 20);
parkZombies();

console.log("=== 一、开关默认关闭，AI 正常接管 ===");
chk(P.on === false && P.unit === null, "初始未开启操控");
const before = W().units.filter(u => u.state !== "player").length;
tick(30);
chk(W().units.every(u => u.state !== "player"), "没有单位处于被操控状态");

console.log("\n=== 二、开启开关后点击人类单位才能接管 ===");
ctx.togglePlayerControl();
chk(P.on === true, "开关已开启");
const z0 = W().units.find(u => ctx.isZombie(u) && !u.dead);
ctx.pickPlayerUnit(ctx.w2sx(z0.x), ctx.w2sy(z0.y));
chk(P.unit === null, "点丧尸无法接管（只认人类阵营）");
const sol = W().units.find(u => u.kind === "rifle" && !u.dead);
ctx.pickPlayerUnit(ctx.w2sx(sol.x), ctx.w2sy(sol.y));
chk(P.unit === sol, "点人类单位成功接管：" + (P.unit ? ctx.CFG.unit[P.unit.kind].name : "无"));

console.log("\n=== 三、WASD 驱动移动 ===");
ctx.keys["d"] = true;
ctx.stepPlayerInput(1 / 60);
console.log("  按 D -> moveX=" + P.moveX + " moveY=" + P.moveY);
chk(P.moveX === 1 && P.moveY === 0, "D 产生向右的输入");
const x0 = sol.x;
tick(60);
console.log("  一秒后 x: " + x0.toFixed(0) + " -> " + sol.x.toFixed(0) + "，状态=" + sol.state);
chk(sol.x > x0 + 60, "角色朝右移动了 " + (sol.x - x0).toFixed(0) + "px");
chk(sol.state === "player", "状态标记为玩家操控");
ctx.keys["d"] = false;
ctx.keys["w"] = true;
ctx.stepPlayerInput(1 / 60);
chk(P.moveY === -1, "W 产生向上的输入");
ctx.keys["w"] = false;

console.log("\n=== 四、鼠标瞄准 ===");
P.unit.x = 2000; P.unit.y = 1150; sol.vx = 0; sol.vy = 0;
ctx.UI.pointer.x = ctx.w2sx(2400); ctx.UI.pointer.y = ctx.w2sy(1150);
ctx.stepPlayerInput(1 / 60);
console.log("  指针在正右方 -> 瞄准 (" + P.aimX.toFixed(2) + ", " + P.aimY.toFixed(2) + ")");
chk(Math.abs(P.aimX - 1) < 0.02 && Math.abs(P.aimY) < 0.02, "瞄准方向指向准星");
tick(2);
chk(Math.abs(sol.faceAng) < 0.05, "角色转身面向准星");
ctx.UI.pointer.x = ctx.w2sx(sol.x);        /* 指针要放在角色正下方，x 也得跟着对上 */
ctx.UI.pointer.y = ctx.w2sy(sol.y + 400);
ctx.stepPlayerInput(1 / 60);
tick(2);
console.log("  指针移到正下方 -> 朝向 " + sol.faceAng.toFixed(2) + "（期望 1.57）");
chk(Math.abs(sol.faceAng - Math.PI / 2) < 0.08, "朝向跟着准星转");

console.log("\n=== 五、按住开火，子弹朝准星飞 ===");
sol.fireFarT = 0; sol.mag = 30; sol.reloading = false;
ctx.UI.pointer.x = ctx.w2sx(2600); ctx.UI.pointer.y = ctx.w2sy(1150);
ctx.stepPlayerInput(1 / 60);
P.firing = true; P.aimLen = 1;
const nb = W().bullets.length;
ctx.stepSim(1 / 60);
const shot = W().bullets[W().bullets.length - 1];
console.log("  子弹数 " + nb + " -> " + W().bullets.length + "，弹药 " + sol.mag);
chk(W().bullets.length > nb, "开火产生子弹");
if (shot) chk(Math.abs(Math.atan2(shot.vy, shot.vx)) < 0.08, "子弹朝准星方向飞（角度 " + Math.atan2(shot.vy, shot.vx).toFixed(3) + "）");
chk(sol.mag < 30, "消耗了弹药");
P.firing = false;

console.log("\n=== 六、操控角色仍是队伍一员（友军逻辑与丧尸锁敌照常） ===");
ctx.rebuildGrids();
chk(W().humanList.indexOf(sol) >= 0, "仍在友军名单里，丧尸照常能锁它");
const near = ctx.nearestHuman({ x: sol.x + 30, y: sol.y });
chk(near !== null, "丧尸的索敌函数能找到人类目标");
const armedCount = W().units.filter(u => ctx.isArmed(u) && !u.dead).length;
chk(armedCount > 0, "操控角色照常参与武装编队（场上武装 " + armedCount + " 人）");

console.log("\n=== 七、关闭开关立刻交还 AI ===");
ctx.togglePlayerControl();
chk(P.on === false && P.unit === null, "开关关闭且已释放角色");
ctx.keys["d"] = true;
ctx.stepPlayerInput(1 / 60);
tick(30);
ctx.keys["d"] = false;
console.log("  关掉开关后状态=" + sol.state + "（不再是 player 即已交还 AI）");
chk(sol.state !== "player", "AI 重新接管该角色");

console.log("\n=== 八、角色阵亡 / 尸变自动释放 ===");
ctx.togglePlayerControl();
ctx.pickPlayerUnit(ctx.w2sx(sol.x), ctx.w2sy(sol.y));
chk(P.unit === sol, "重新接管");
sol.dead = true; ctx.W.units = ctx.W.units.filter(u => u !== sol);
ctx.stepPlayerInput(1 / 60);
chk(P.unit === null, "角色消失（阵亡）后自动交还 AI");
const alive = W().units.find(u => ctx.isArmed(u) && !u.dead);
ctx.pickPlayerUnit(ctx.w2sx(alive.x), ctx.w2sy(alive.y));
alive.infectLocked = true; alive.incubT = 99; alive.fadeT = 99;
ctx.stepSim(1 / 60);
ctx.stepPlayerInput(1 / 60);
chk(P.unit === null || !ctx.isZombieSide(P.unit), "角色尸变后不再被操控");

console.log("\n=== 九、触屏摇杆 ===");
P.stickL = { id: 1, ox: 100, oy: 400, x: 100, y: 400, nx: 0, ny: 0, mag: 0, kx: 100, ky: 400 };
ctx.stickUpdate(P.stickL, 100 + 60, 400);
console.log("  左摇杆右推 -> nx=" + P.stickL.nx.toFixed(2) + " mag=" + P.stickL.mag.toFixed(2));
chk(P.stickL.nx > 0.7 && P.stickL.mag > 0.7, "左摇杆给出向右的移动输入");
const u9 = W().units.find(u => ctx.isHuman(u) && !u.dead && ctx.isArmed(u));
P.unit = u9; P.on = true;
ctx.stepPlayerInput(1 / 60);
chk(P.moveX > 0.5, "摇杆输入转成了移动方向");
P.stickR = { id: 2, ox: 800, oy: 400, x: 800, y: 400, nx: 0, ny: 0, mag: 0, kx: 800, ky: 400 };
ctx.stickUpdate(P.stickR, 800, 400 - 70);
ctx.stepPlayerInput(1 / 60);
console.log("  右摇杆上推 -> 瞄准 (" + P.aimX.toFixed(2) + ", " + P.aimY.toFixed(2) + ") 开火=" + P.firing);
chk(Math.abs(P.aimY + 1) < 0.05, "右摇杆控制瞄准方向");
chk(P.firing === true, "右摇杆推出去即自动开火");

console.log("\n=== 十、镜头跟随角色，而不是被 WASD 推着走 ===");
P.on = true; P.unit = null;
const hero = W().units.find(u => ctx.isHuman(u) && !u.dead && ctx.isArmed(u));
P.unit = hero;
hero.x = 1500; hero.y = 1000; hero.vx = 0; hero.vy = 0;
parkZombies();
P.camHoldT = 0;
ctx.CAM.x = 3200; ctx.CAM.y = 400;                 /* 镜头先故意放得老远 */
const farX = ctx.CAM.x, farY = ctx.CAM.y;
/* 鼠标放在屏幕正右方（这才是玩家实际能控制的量：镜头怎么移，鼠标在屏幕上的方位不变） */
ctx.UI.pointer.x = ctx.VW / 2 + 300; ctx.UI.pointer.y = ctx.VH / 2;
P.stickL = null; P.stickR = null;
for (let i = 0; i < 120; i++) { ctx.stepPlayerInput(1 / 60); ctx.followPlayerCamera(1 / 60); }
const lead = ctx.CFG.playerCam.lead;
console.log("  镜头 " + farX.toFixed(0) + "," + farY.toFixed(0) + " -> " + ctx.CAM.x.toFixed(0) + "," + ctx.CAM.y.toFixed(0) +
  "；角色在 " + hero.x.toFixed(0) + "," + hero.y.toFixed(0) + "，前瞻 " + lead + "px");
chk(Math.abs(ctx.CAM.x - farX) > 500, "镜头自动追到了角色身上");
chk(Math.abs(ctx.CAM.y - hero.y) < 25, "垂直于准星的轴上对准角色");
chk(Math.abs(ctx.CAM.x - (hero.x + lead)) < 30, "沿准星方向留了 " + lead + "px 前瞻偏移，视野重心偏向要打的方向");

const cx0 = ctx.CAM.x, cy0 = ctx.CAM.y;
ctx.keys["w"] = true; ctx.keys["a"] = true;
ctx.handlePanKey(1 / 60);
console.log("  操控中按 W+A：镜头 (" + cx0.toFixed(0) + "," + cy0.toFixed(0) + ") -> (" + ctx.CAM.x.toFixed(0) + "," + ctx.CAM.y.toFixed(0) + ")");
chk(ctx.CAM.x === cx0 && ctx.CAM.y === cy0, "接管期间 WASD 不再平移镜头（它属于角色）");
const hx0 = hero.x;
for (let i = 0; i < 40; i++) { ctx.stepPlayerInput(1 / 60); ctx.stepSim(1 / 60); ctx.followPlayerCamera(1 / 60); }
console.log("  按住 W+A 一秒：角色 (" + hx0.toFixed(0) + " -> " + hero.x.toFixed(0) + "," + hero.y.toFixed(0) + ")，镜头 x=" + ctx.CAM.x.toFixed(0));
chk(hero.x < hx0 - 40, "WASD 移动的确实是角色");
ctx.keys["w"] = false; ctx.keys["a"] = false;

P.on = false; P.unit = null;
const px0 = ctx.CAM.x;
ctx.keys["a"] = true;
ctx.handlePanKey(1 / 60);
chk(ctx.CAM.x !== px0, "关掉操控后 WASD 恢复平移镜头");
ctx.keys["a"] = false;

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
