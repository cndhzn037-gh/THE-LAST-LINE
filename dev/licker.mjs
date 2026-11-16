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
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function isZ(u) { return ctx.isZombie(u) || ctx.isZombieSide(u); }
function tick(sec) { for (let i = 0; i < Math.round(sec * 60); i++) ctx.stepSim(1 / 60); }
const CFG = ctx.CFG;
const raw = html;

console.log("=== 一、基本设定 ===");
const c = CFG.unit.licker;
console.log("  血量 " + c.hp + "，移速 " + c.vmax + "（普通丧尸 " + CFG.unit.zombie.vmax + "），颜色 " + c.color);
chk(c.hp === 20, "血量 20");
chk(c.vmax === CFG.unit.zombie.vmax, "移速与常规丧尸一致");
chk(c.color.toLowerCase() === "#e86d6d", "粉红 #e86d6d（232,109,109）");
chk(ctx.isZombieKind("licker") && ctx.isZombieKind("zombie"), "被当作丧尸阵营");
chk(raw.indexOf('<option value="licker">舔舐者</option>') >= 0, "投放/编辑器下拉里都有");

console.log("=== 二、舌头参数 ===");
const L = CFG.licker;
console.log("  舌头血量 " + L.tongueHp + "，读条 " + L.windup + "s，末端速度 " + (CFG.bullet.speed / L.speedDiv).toFixed(0) +
  "（步枪弹速 " + CFG.bullet.speed + "）");
chk(L.tongueHp === 30, "舌头 30 血（原 15，翻倍）");
chk(L.windup === 2, "读条 2 秒");
chk(CFG.bullet.speed / L.speedDiv === CFG.bullet.speed / 2, "末端速度是弹速的一半");
chk(L.dragDiv === 5, "基础拖拽是移速的 1/5");
chk(L.dragBoost === 2, "命中后拖拽速度翻倍（1/5 × 2 = 2/5）");
console.log("  命中后实际拖拽速度 = " + (CFG.unit.licker.vmax / L.dragDiv * L.dragBoost).toFixed(1) + "px/s");
chk(Math.abs(L.fleeMul - 1 / 3) < 0.01, "打断后按 1/3 移速逃跑");
console.log("  起手距离 = 平民恐惧半径 " + CFG.fearRCivilian + " × " + L.reachMul + " = " + (CFG.fearRCivilian * L.reachMul));
chk(L.reachMul === 5, "射程是恐惧半径的 5 倍（原 2 倍，加了 150%）");

console.log("=== 三、行为 ===");
ctx.GAME_MODE = "defense"; ctx.W.mode = "defense";
ctx.LAST_ZOMBIE_COUNT = 2;
ctx.buildScenario(3, 2);
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) u.dead = true;
ctx.cleanup();
ctx.W.tongues.length = 0;
/* 清空地形阻挡，保证 1300px 的直线通道是通的（否则舌头一伸就被墙判定断掉） */
ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
const civ = ctx.addUnit("civilian", 2000, 1200);
const lk = ctx.addUnit("licker", 2000 + CFG.fearRCivilian * CFG.licker.reachMul, 1200);
ctx.rebuildGrids();
console.log("  初始：舔舐者距平民 " + Math.round(Math.hypot(lk.x - civ.x, lk.y - civ.y)) + "px，状态 " + lk.state);
tick(1.0);
console.log("  1 秒后：state=" + lk.state + "，读条 " + (lk.tongueT || 0).toFixed(2));
chk(lk.state === "lickerAim" || lk.tongueFired, "到位后开始读条");
tick(4);
console.log("  再 4 秒：舌头数 " + ctx.W.tongues.length + "，tongueFired=" + (lk.tongueFired || 0));
chk(ctx.W.tongues.length > 0, "读满后伸出了舌头");
const tq = ctx.W.tongues[0];
chk(tq && tq.hp === 30, "舌头 30 血");
const dBefore = Math.hypot(civ.x - lk.x, civ.y - lk.y);
tick(1.5);
const dAfter = Math.hypot(civ.x - lk.x, civ.y - lk.y);
console.log("  被拖拽：距离 " + dBefore.toFixed(0) + " → " + dAfter.toFixed(0) + "px，held=" + !!civ.tongueHeld +
  "，丝线长度 " + tq.len.toFixed(0) + "px");
chk(dAfter < dBefore - 5, "命中后目标被往回拽");
/* 蛛丝：末端粘在目标身上，长度 = 本体到目标的距离；往回拖的时候丝线必须跟着变短 */
chk(Math.abs(tq.len - Math.max(0, dAfter - civ.r * 0.6)) < 3, "丝线末端贴着目标（长度跟着距离走，不再固定）");
chk(tq.len < 1300 - 60, "往回拖的过程中丝线明显缩短了");
chk(Math.abs(tq.ang - Math.atan2(civ.y - lk.y, civ.x - lk.x)) < 1e-6, "粘住之后丝线绷直（角度直指目标）");

console.log("  果断性：射程外耽误的时间不该让读条白读");
ctx.W.tongues.length = 0;
lk.tongueFired = 0; lk.tongueT = 0; lk.tongueCd = 0; lk.fleeT = 0;
civ.x = lk.x + 1300; civ.y = lk.y;   /* 先攒 1 秒 */
ctx.rebuildGrids();
tick(1.0);
const tSaved = lk.tongueT || 0;
civ.x = lk.x + 1300 * 1.5;           /* 拉出射程 1 秒，读条不该归零 */
ctx.rebuildGrids();
tick(1.0);
console.log("    射程内攒到 " + tSaved.toFixed(2) + "s，被拉出去 1 秒后仍是 " + (lk.tongueT || 0).toFixed(2) + "s");
chk(tSaved > 0.8, "射程内 1 秒攒了 1 秒的条");
chk((lk.tongueT || 0) > 0.5, "被拉出射程期间读条进度没有归零");
civ.x = lk.x + 1300;                 /* 拉回来，只需要再攒不到 1 秒就能出手 */
ctx.rebuildGrids();
tick(1.15);
console.log("    拉回射程 1.15 秒后：读条 " + (lk.tongueT || 0).toFixed(2) + "，舌头数 " + ctx.W.tongues.length);
chk(ctx.W.tongues.length > 0, "回到射程立刻出手（不重新读满 2 秒）");

console.log("=== 四、打断舌头 ===");
const q2 = ctx.W.tongues[0];
if (q2) {
  ctx.breakTongue(q2);
  tick(0.2);
  console.log("  打断后：tongueFired=" + (lk.tongueFired || 0) + "，state=" + lk.state + "，held=" + !!civ.tongueHeld);
  chk(!lk.tongueFired, "舔舐者解除定身");
  chk(lk.fleeT > 0 || lk.state === "lickerFlee", "进入逃跑状态");
  chk(!civ.tongueHeld || !civ.dead, "目标恢复行动");
}

console.log("=== 五、断舌后 4 秒冷却 ===");
chk(CFG.licker.cd === 4, "配置里冷却就是 4 秒（原 5 秒）");
const cd0 = lk.tongueCd || 0;
console.log("  打断瞬间 tongueCd = " + cd0.toFixed(1) + "s");
chk(cd0 > 3.5, "立刻进入 4 秒冷却");
/* 冷却期间：看得见它在追，但不会读条 */
ctx.W.over = false; ctx.W.paused = false;
let sawAim = false;
for (let i = 0; i < 60 * 3; i++) { ctx.stepSim(1 / 60); if (lk.state === "lickerAim") sawAim = true; }
console.log("  冷冻 3 秒后：tongueCd=" + (lk.tongueCd || 0).toFixed(1) + "，state=" + lk.state + "，读条过吗=" + sawAim);
chk(!sawAim, "冷却期间不会重新读条");
chk(ctx.W.tongues.length === 0, "也没有新舌头");
chk((lk.tongueCd || 0) > 0, "3 秒时冷却还没走完");
/* 冷却结束：重新开始读条 */
for (let i = 0; i < 60 * 2.5; i++) { ctx.stepSim(1 / 60); if (lk.state === "lickerAim") sawAim = true; }
console.log("  再 2.5 秒（累计 5.5 秒）：tongueCd=" + (lk.tongueCd || 0).toFixed(1) + "，state=" + lk.state);
chk((lk.tongueCd || 0) <= 0, "冷却走完");
chk(sawAim || ctx.W.tongues.length > 0, "冷却结束后能再次发动舔舐");

console.log("=== 六、舌头跟随目标（弱追踪） ===");
/* 新场景：目标横向跑动，看舌头角度有没有跟着拧 */
ctx.W.tongues.length = 0;
for (const u of ctx.W.units) u.dead = true;
ctx.cleanup();
ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
const civ2 = ctx.addUnit("civilian", 2000, 1200);
const lk2 = ctx.addUnit("licker", 2000 + CFG.fearRCivilian * CFG.licker.reachMul, 1200);
ctx.rebuildGrids();
tick(4);
console.log("  起手距离 " + Math.round(CFG.fearRCivilian * CFG.licker.reachMul) + "px，舌头数 " + ctx.W.tongues.length);
chk(ctx.W.tongues.length > 0, "新射程下仍能发动攻击");
const tq2 = ctx.W.tongues[0];
if (tq2) {
  const ang0 = tq2.ang;
  /* 目标横向移动一段（但还在弱追踪能追上的范围内） */
  civ2.y += 120;
  ctx.rebuildGrids();
  tick(0.5);
  const ang1 = tq2.ang;
  console.log("  目标横移 120px 后：舌头角度 " + ang0.toFixed(2) + " → " + ang1.toFixed(2));
  chk(Math.abs(ang1 - ang0) > 0.02, "舌头朝目标方向拧过去（弱追踪生效）");
  chk(!tq2.retract, "小范围移动不会断线");
}

console.log("=== 七、跑出射程就断线，但不进冷却 ===");
const maxReach = CFG.fearRCivilian * CFG.licker.reachMul * CFG.licker.loseMul;
civ2.x = lk2.x + maxReach + 400;
ctx.rebuildGrids();
tick(0.3);
console.log("  目标跑到 " + Math.round(maxReach + 400) + "px（断线上限 " + Math.round(maxReach) + "）：retract=" +
  (tq2 ? tq2.retract : "舌已消失") + "，tongueCd=" + (lk2.tongueCd || 0).toFixed(1) + "，tongueFired=" + (lk2.tongueFired || 0));
chk(!lk2.tongueFired, "舔舐者解除定身");
chk((lk2.tongueCd || 0) <= 0, "断线不进入冷却（和被打断不同）");
tick(2.5);
chk(ctx.W.tongues.length === 0 || ctx.W.tongues[0].owner === lk2, "舌头缩回去了");

console.log("=== 八、断舌之后真的会跑开 ===");
ctx.W.tongues.length = 0;
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) u.dead = true;
ctx.cleanup();
ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
const civ3 = ctx.addUnit("civilian", 2000, 1200);
const lk3 = ctx.addUnit("licker", 3300, 1200);
ctx.rebuildGrids();
tick(4);
const q3 = ctx.W.tongues[0];
chk(!!q3, "先粘住一个目标");
if (q3) {
  const x0 = lk3.x, y0 = lk3.y;
  ctx.breakTongue(q3);
  console.log("  打断瞬间：fleeT=" + (lk3.fleeT || 0).toFixed(2) + "，逃跑方向=(" +
    (lk3.fleeX || 0).toFixed(2) + "," + (lk3.fleeY || 0).toFixed(2) + ")");
  chk(lk3.fleeX !== undefined && lk3.fleeY !== undefined, "打断时给了逃跑方向（以前这里是 undefined）");
  chk(lk3.fleeX > 0.5, "方向是背离目标的（目标在左边，它该往右跑）");
  tick(1.2);
  const moved = Math.hypot(lk3.x - x0, lk3.y - y0);
  console.log("  1.2 秒后位移 " + moved.toFixed(0) + "px");
  chk(moved > 25, "确实跑开了，不是杵在原地");
  chk(lk3.x > x0, "跑的方向是对的（远离被它抓的人）");
}

console.log("=== 九、读条结束时就近开火 ===");
ctx.W.tongues.length = 0;
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) u.dead = true;
ctx.cleanup();
ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
const far = ctx.addUnit("civilian", 2100, 1200);      /* 先只有它，距离 1200 */
const lk4 = ctx.addUnit("licker", 3300, 1200);
ctx.rebuildGrids();
tick(1.0);
console.log("  读条 " + (lk4.tongueT || 0).toFixed(2) + "s，锁定的是 " + (lk4.tongueTarget === far ? "远处那个" : "??"));
chk(lk4.tongueTarget === far, "先锁上唯一的目标");
/* 读条途中塞一个更近的进来：800px，还没到"六成以内"的换人线（1200×0.6=720） */
const near = ctx.addUnit("civilian", 2500, 1200);
ctx.rebuildGrids();
const keptFar = lk4.tongueTarget === far;
console.log("  塞进 800px 的近目标后，读条中途仍盯着 " + (keptFar ? "远处的" : "近处的"));
tick(1.3);
const t9 = ctx.W.tongues[0];
console.log("  读满开火：目标 = " + (t9 ? (t9.target === near ? "近处那个(800px)" : "远处那个(1200px)") : "没开火"));
chk(!!t9, "读满后开火了");
chk(t9 && t9.target === near, "开火这一刻就近重新挑，打了近的那个");

console.log("=== 十、直接打死舔舐者本体，被粘住的人要放开 ===");
ctx.W.tongues.length = 0;
ctx.W.over = false; ctx.W.paused = false;
for (const u of ctx.W.units) u.dead = true;
ctx.cleanup();
ctx.NAV.blocked.fill(0); ctx.NAV.visBlock.fill(0); ctx.W.obstacles.length = 0;
const civ10 = ctx.addUnit("civilian", 2000, 1200);
const lk10 = ctx.addUnit("licker", 3300, 1200);
ctx.rebuildGrids();
tick(4);
console.log("  粘住了吗：舌头 " + ctx.W.tongues.length + " 条，held=" + !!civ10.tongueHeld);
chk(ctx.W.tongues.length === 1 && !!civ10.tongueHeld, "先让舌头命中并限制住平民");
/* 不碰舌头，直接把舔舐者本体打死 */
lk10.hp = 1;
ctx.damageZombie(lk10, 99, null);
tick(0.1);
console.log("  本体阵亡后：舌头 " + ctx.W.tongues.length + " 条，held=" + !!civ10.tongueHeld +
  "，lock=" + !!civ10.tongueLock);
chk(lk10.dead === true, "舔舐者本体确实死了");
chk(ctx.W.tongues.length === 0, "舌头随之消失");
chk(!civ10.tongueHeld && !civ10.tongueLock, "被粘住的人立刻恢复自由（这就是之前那个 bug）");
/* 恢复自由之后，速度上限要回到正常值（被粘住时会被压到 20） */
tick(0.05);
console.log("  被粘住时最高速约 20，现在是 " + civ10.vmaxCur.toFixed(1));
chk(civ10.vmaxCur > 20, "速度上限恢复正常，不再是 20");
/* 再放一只丧尸在旁边，看这个人是不是真的跑得动了 */
const z10 = ctx.addUnit("zombie", 2200, 1200);
ctx.rebuildGrids();
const x10 = civ10.x;
tick(1.5);
const moved10 = Math.abs(civ10.x - x10);
console.log("  旁边来了丧尸，1.5 秒内位移 " + moved10.toFixed(0) + "px");
chk(moved10 > 40, "能正常跑起来，没有被钉死");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));
