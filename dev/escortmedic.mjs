import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
const noop = function () {};
const gradStub = { addColorStop: noop };
const c2 = new Proxy({ createLinearGradient: () => gradStub, createRadialGradient: () => gradStub },
  { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true; } });
function makeEl() { return { style: {}, className: "", textContent: "", innerHTML: "", value: "40", files: [], width: 800, height: 600, scrollTop: 0,
  addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop, setAttribute: noop,
  getAttribute: () => null, click: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  getContext: () => c2, querySelectorAll: () => [], querySelector: () => null }; }
const els = {}; const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, isFinite, parseInt, parseFloat, Infinity, NaN,
  Uint8Array, Int32Array, Float32Array, Map, Set, Error, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: () => 1,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { getElementById: (id) => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), querySelectorAll: () => [], body: { appendChild: noop } } };
sb.window = sb; sb.globalThis = sb; sb.window.innerWidth = 1280; sb.window.innerHeight = 720;
sb.window.devicePixelRatio = 1; sb.window.addEventListener = noop;
sb.navigator = { serviceWorker: { register: function () { return Promise.reject(new Error("t")); } } };
sb.location = { protocol: "https:" };
const ctx = vm.createContext(sb);
vm.runInContext(gcode, ctx, { filename: "game.js" });
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
const raw = html;

console.log("=== 一、小队展开包含医疗兵 ===");
const ex = ctx.expandSquad({ rifle: 2, mg: 1, sniper: 0, shield: 0, medic: 3 });
console.log("  expandSquad 结果：" + ex.join(", "));
chk(ex.length === 6, "六个人都在");
chk(ex.filter(k => k === "medic").length === 3, "三名医疗兵都被展开出来");
chk(raw.indexOf("function rebuildFactionKinds") >= 0, "有阵营兵种库");
chk(raw.indexOf("for (i = 0; i < HUMAN_KINDS.length; i++)") >= 0, "展开按阵营库走，不再是手写名单");
chk(raw.indexOf('var order = ["sniper", "shield", "mg", "rifle", "medic"]') >= 0, "超支裁剪顺序里仍有医疗兵");

console.log("=== 二、价格计入 ===");
const c1 = ctx.squadCostOf({ rifle: 1, medic: 2 });
console.log("  1 步枪 + 2 医疗兵 = " + c1);
chk(c1 === CFGcost("rifle") + CFGcost("medic") * 2, "医疗兵按 100 计入小队总价");
function CFGcost(k) { return ctx.CFG.econ.cost[k]; }

console.log("=== 三、超支时先裁贵的，医疗兵留到最后 ===");
ctx.START.civCount = 4;                    /* 4 × 600 = 2400 经济 */
ctx.START.squad = { rifle: 5, mg: 1, sniper: 0, shield: 0, medic: 2 };
const before = ctx.squadCostOf(ctx.START.squad);
ctx.trimSquad();
const after = ctx.squadCostOf(ctx.START.squad);
console.log("  裁剪前 " + before + " → 裁剪后 " + after + "，编制 " + JSON.stringify(ctx.START.squad));
chk(after <= 2400, "裁到经济上限以内");
chk((ctx.START.squad.medic | 0) === 2, "医疗兵一个都没被裁掉（它最便宜）");

console.log("=== 四、真能开局，场上出现医疗兵 ===");
ctx.START.squad = { rifle: 2, mg: 1, sniper: 0, shield: 0, medic: 2 };
ctx.LAST_CIV_COUNT = 4;
ctx.LAST_SQUAD = ctx.expandSquad(ctx.START.squad);
console.log("  本次小队：" + ctx.LAST_SQUAD.join(", "));
ctx.buildEscortScenario(20240607, 4, ctx.LAST_SQUAD);
const medics = ctx.W.units.filter(u => !u.dead && u.kind === "medic");
const rifles = ctx.W.units.filter(u => !u.dead && u.kind === "rifle");
console.log("  开局后场上：医疗兵 " + medics.length + " 人，步枪兵 " + rifles.length + " 人");
chk(ctx.GAME_MODE === "escort", "进的是护送模式");
chk(medics.length === 2, "两名医疗兵都上场了");
chk(medics.every(u => u.x > 3000), "和队友一起站在右侧出生点");

console.log("=== 五、能正常跑，不出异常 ===");
ctx.W.over = false; ctx.W.paused = false;
for (let i = 0; i < 600; i++) ctx.stepSim(1 / 60);
const alive = ctx.W.units.filter(u => !u.dead).length;
console.log("  跑了 10 秒：存活 " + alive + "，健康单位数 " + ctx.countUnits().h);
chk(alive > 0, "演算没崩");
chk(ctx.W.units.every(u => isFinite(u.x) && isFinite(u.y)), "没有出现 NaN 坐标");

console.log("=== 六、医疗兵能解除封锁大门 ===");
ctx.START.squad = { rifle: 1, mg: 0, sniper: 0, shield: 0, medic: 2 };
ctx.LAST_SQUAD = ctx.expandSquad(ctx.START.squad);
ctx.buildEscortScenario(20240607, 4, ctx.LAST_SQUAD);
ctx.W.over = false; ctx.W.paused = false;
chk(ctx.W.doorOpen === false, "开局大门是封锁的");
const pd = ctx.W.prisonDoor;
const dcx = pd.x + pd.w / 2, dcy = pd.y + pd.h / 2;
const testDoor = (kind) => {
  ctx.W.doorOpen = false;
  ctx.W.phase = "infiltrate";
  const u = ctx.addUnit(kind, dcx, dcy);
  ctx.rebuildGrids();
  ctx.stepSim(1 / 60);
  const ok = ctx.W.doorOpen;
  u.dead = true;
  return ok;
};
const byRifle = testDoor("rifle");
const byMedic = testDoor("medic");
const byCiv = testDoor("civilian");
console.log("  步枪兵摸门 → 解封=" + byRifle + "；医疗兵摸门 → 解封=" + byMedic + "；平民摸门 → 解封=" + byCiv);
chk(byRifle === true, "步枪兵能解封");
chk(byMedic === true, "医疗兵也能解封（以前不行）");
chk(byCiv === false, "平民仍然不行");
chk(raw.indexOf("!isArmed(u) && u.kind !== \"medic\"") >= 0, "开门判定确实放行了医疗兵");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));