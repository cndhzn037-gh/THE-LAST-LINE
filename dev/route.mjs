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
const CFG = ctx.CFG;
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }
/* 把丧尸全部按到远角，保证测试期间人类不会被尸潮打扰 */
function parkZombies() {
  for (const u of W().units) if (ctx.isZombie(u) && !u.dead) { u.x = 3980; u.y = 2260; u.vx = 0; u.vy = 0; }
}
function humans() { return W().units.filter(u => ctx.isHuman(u) && !u.dead); }
function setup(routes) {
  ctx.EDIT.level = { mounds: null, zones: null, prison: null, prisonDoor: null, squad: null, evac: null, routes: routes };
  ctx.EDIT.levelTouched = true;
  ctx.GAME_MODE = "defense";
  ctx.LAST_ZOMBIE_COUNT = 20;
  ctx.buildScenario(999, 20);
  ctx.assignRoutes();
}

console.log("=== 一、路线绑定到框选范围内的单位 ===");
setup([{ pts: [{ x: 3300, y: 700 }, { x: 3300, y: 1400 }, { x: 3300, y: 1900 }],
         rect: { x: 3260, y: 500, w: 200, h: 500 }, color: "#ff9a3c" }]);
const bound = W().units.filter(u => u.routeIdx >= 0 && !u.dead);
console.log("  共 " + humans().length + " 名人类，其中 " + bound.length + " 名落在编组框里并绑定了路线");
chk(bound.length > 0, "有单位继承了这条路线");
chk(bound.every(u => u.x >= 3260 && u.x <= 3460 && u.y >= 500 && u.y <= 1000), "绑定的单位都在框选范围内");
chk(W().routes.length === 1, "场上生成了一条路线");

console.log("\n=== 二、开局后按顺序走过检查点 ===");
parkZombies();
function distToTarget(u) {
  const rt = W().routes[u.routeIdx];
  const wp = rt.pts[Math.min(u.routePt, rt.pts.length - 1)];
  return Math.hypot(u.x - wp.x, u.y - wp.y);
}
const u0 = bound[0];
const startPt = u0.routePt, t0 = distToTarget(u0);
tick(6);
parkZombies();
const t1 = distToTarget(u0);
console.log("  样例单位 id=" + u0.id + " 距当前检查点 " + t0.toFixed(0) + " → " + t1.toFixed(0) + "px，序号 " + startPt + " → " + u0.routePt);
chk(u0.routePt > startPt || t1 < t0 - 40, "朝当前检查点在走（到位就换下一个）");
const ahead = bound.filter(u => u.routePt > 0).length;
chk(ahead > 0, "已有 " + ahead + " 名单位抵达并推进到下一个检查点");

console.log("\n=== 三、走完全程后交回常规逻辑 ===");
for (let i = 0; i < 6; i++) { tick(10); parkZombies(); }
const done = bound.filter(u => !u.dead && u.routePt >= 3).length;
const states = {};
for (const u of bound) if (!u.dead) states[u.state] = (states[u.state] || 0) + 1;
console.log("  走完全部 3 个检查点的单位 " + done + "/" + bound.filter(u => !u.dead).length + "，状态分布 " + JSON.stringify(states));
chk(done > 0, "有单位走完了整条路线");

console.log("\n=== 四、被恐惧打断后回到路线 ===");
setup([{ pts: [{ x: 3300, y: 700 }, { x: 3300, y: 1900 }], rect: { x: 3260, y: 500, w: 200, h: 500 }, color: "#4ec9ff" }]);
parkZombies();
tick(2); parkZombies();
const v = W().units.filter(u => u.routeIdx >= 0 && !u.dead)[0];
v.x = 3300; v.y = 900; v.vx = 0; v.vy = 0;
/* 放一只丧尸在恐惧半径内、但够不着的位置，并且每帧钉住它 ——
   否则它自己会扑上来把测试对象直接感染掉，就测不到"撤退"了 */
const foe = ctx.addUnit("zombie", 3300, 1010);
foe.hp = 99999;
for (let i = 0; i < 36; i++) { foe.x = 3300; foe.y = 1010; foe.vx = 0; foe.vy = 0; ctx.stepSim(1 / 60); }
console.log("  丧尸在恐惧圈里（相距 110px）时：状态=" + v.state + " vx=" + v.vx.toFixed(0) + " 已感染=" + v.infectLocked);
chk(!v.infectLocked, "测试对象没有被感染（保持着观察条件）");
chk(v.state === "flee", "恐惧优先：先撤");
foe.x = 3980; foe.y = 2260;                          /* 威胁解除 */
tick(2);
console.log("  威胁解除后：状态=" + v.state + " 检查点序号=" + v.routePt + " 距检查点 " +
  Math.hypot(v.x - 3300, v.y - 1900).toFixed(0) + "px");
chk(v.state === "route" || v.state === "routeDone", "自己回到路线继续走，没有把队伍丢下");

console.log("\n=== 五、多条路线各自一种颜色 ===");
setup([{ pts: [{ x: 3300, y: 600 }, { x: 3300, y: 1000 }], rect: { x: 3260, y: 520, w: 180, h: 300 }, color: "#ff9a3c" },
       { pts: [{ x: 3700, y: 1200 }, { x: 3700, y: 1700 }], rect: { x: 3660, y: 1100, w: 180, h: 400 }, color: "#4ec9ff" }]);
const g1 = W().units.filter(u => u.routeIdx === 0 && !u.dead).length;
const g2 = W().units.filter(u => u.routeIdx === 1 && !u.dead).length;
console.log("  路线 1（" + W().routes[0].color + "）" + g1 + " 人；路线 2（" + W().routes[1].color + "）" + g2 + " 人");
chk(g1 > 0 && g2 > 0, "两条编组各自带上了人");
chk(W().routes[0].color !== W().routes[1].color, "不同编组用不同颜色区分");

console.log("\n=== 六、没画路线时一切照旧 ===");
ctx.EDIT.levelTouched = false;
ctx.buildScenario(999, 20);
ctx.assignRoutes();
chk(W().routes.length === 0, "没有路线数据时不生成任何路线");
chk(W().units.every(u => u.routeIdx < 0), "也没有单位被错误绑定");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项不通过 ==="));
process.exit(bad === 0 ? 0 : 1);
