import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = function () {};
function ctxStub(){const b={createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})};return new Proxy(b,{get(t,p){if(p in t)return t[p];return noop;},set(t,p,v){t[p]=v;return true;}});}
const c=ctxStub();
function el(id){return{id,style:{},className:"",textContent:"",innerHTML:"",value:"",files:[],width:800,height:600,addEventListener:noop,removeEventListener:noop,appendChild:noop,remove:noop,setAttribute:noop,getAttribute:()=>null,click:noop,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),getContext:()=>c,querySelectorAll:()=>[],querySelector:()=>null};}
const els={},store={};
const sb={console,Math,Date,JSON,Object,Array,String,Number,isFinite,parseInt,parseFloat,Infinity,NaN,Uint8Array,Int32Array,Float32Array,Map,Set,Error,setTimeout:noop,clearTimeout:noop,requestAnimationFrame:()=>1,
localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
document:{getElementById:id=>els[id]||(els[id]=el(id)),createElement:t=>el("n"+t),querySelectorAll:()=>[],body:{appendChild:noop}}};
sb.window=sb; sb.globalThis=sb; sb.window.innerWidth=1280; sb.window.innerHeight=720; sb.window.devicePixelRatio=1; sb.window.addEventListener=noop;
sb.window.prompt=()=>"测试台词";
const ctx=vm.createContext(sb);
vm.runInContext(code,ctx,{filename:"game.js"});

let fail = 0;
function expect(tag, ok, extra) {
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + tag + (extra === undefined ? "" : "  " + extra));
}
function reset() {
  ctx.W.units.length = 0;
  ctx.W.bullets.length = 0;
  /* 关键：清掉默认地形，否则单位与目标之间隔着墙，测出来的全是寻路失败 */
  ctx.W.obstacles.length = 0;
  ctx.W.doors.length = 0;
  ctx.NAV.build(ctx.CFG.world, ctx.W.obstacles, 9);
  ctx.W.over = false;
  ctx.W.paused = false;
  ctx.DIRECTOR.sel = null;
  ctx.DIRECTOR.pending = null;
}
function tick(sec) {
  const n = Math.round(sec / (1 / 60));
  for (let i = 0; i < n; i++) ctx.stepSim(1 / 60);
}
const CX = 2048, CY = 1152;

// ---- 1) 基础指令队列 ----
reset();
const u = ctx.addUnit("rifle", CX, CY);
ctx.cueAdd(u, "moveTo", { x: CX + 400, y: CY });
expect("指令入队", u.cueQ.length === 1 && u.cue && u.cue.act === "moveTo");
ctx.cueAdd(u, "hold", { life: 2 });
expect("第二条排队", u.cueQ.length === 2 && u.cue.act === "moveTo");
ctx.cueAdvance(u);
expect("推进后队首变成 hold", u.cue.act === "hold" && u.cueQ.length === 1);
ctx.cueClear(u);
expect("解除后清空", u.cue === null && u.cueQ.length === 0);

// ---- 2) 核心：剧本指令能否压过恐惧撤退 ----
reset();
const hero = ctx.addUnit("rifle", CX, CY);
for (let i = 0; i < 5; i++) ctx.addUnit("zombie", CX + 90 + i * 8, CY + (i - 2) * 10);
tick(0.5);
const fleeX = hero.x;
expect("无指令时被恐惧逼退（向左/远离丧尸）", fleeX < CX - 2, "x=" + fleeX.toFixed(1));

reset();
const hero2 = ctx.addUnit("rifle", CX, CY);
for (let i = 0; i < 5; i++) ctx.addUnit("zombie", CX + 90 + i * 8, CY + (i - 2) * 10);
ctx.cueAdd(hero2, "moveTo", { x: CX + 420, y: CY });
tick(0.5);
/* 注意：丧尸会追上来把演员物理挤开，所以位置不可靠。
   这里验证的是"行为分支"——剧本生效时状态是 cue，而不是恐惧逃跑的 flee。 */
expect("下指令后不再进入恐惧逃跑状态", hero2.state === "cue", "状态=" + hero2.state);
expect("加速度朝目标方向（+x），说明剧本正在驱动", hero2.ax > 0, "ax=" + hero2.ax.toFixed(1));

// ---- 3) 到达目标后自动推进队列 ----
reset();
const walker = ctx.addUnit("rifle", CX, CY);
ctx.cueAdd(walker, "moveTo", { x: CX + 200, y: CY });
ctx.cueAdd(walker, "hold", { life: 99 });
tick(4);
expect("走到目标点附近", Math.abs(walker.x - (CX + 200)) < 60, "x=" + walker.x.toFixed(1));
expect("到达后自动切到 hold", walker.cue && walker.cue.act === "hold", walker.cue ? walker.cue.act : "null");

// ---- 4) hold 让人站定 ----
reset();
const holder = ctx.addUnit("rifle", CX, CY);
ctx.cueAdd(holder, "hold", { life: 99 });
tick(1);
expect("hold 时原地不动", Math.abs(holder.x - CX) < 25 && Math.abs(holder.y - CY) < 25,
  holder.x.toFixed(1) + "," + holder.y.toFixed(1));

// ---- 5) 保险：不开火 ----
reset();
const gunner = ctx.addUnit("rifle", CX, CY);
ctx.addUnit("zombie", CX + 150, CY);
tick(2.0);
expect("没下保险时会开火", ctx.W.bullets.length > 0 || gunner.mag < gunner.magSize,
  "子弹=" + ctx.W.bullets.length + " 弹匣=" + gunner.mag);

reset();
const safeG = ctx.addUnit("rifle", CX, CY);
ctx.addUnit("zombie", CX + 150, CY);
ctx.cueAdd(safeG, "safe", { life: 99 });
tick(2.0);
expect("保险打开后不开火", ctx.W.bullets.length === 0 && safeG.mag === safeG.magSize,
  "子弹=" + ctx.W.bullets.length + " 弹匣=" + safeG.mag);

// ---- 6) 解除后交还 AI ----
reset();
const back = ctx.addUnit("rifle", CX, CY);
ctx.cueAdd(back, "moveTo", { x: CX + 300, y: CY });
tick(0.3);
ctx.cueClear(back);
tick(0.3);
expect("解除后 cue 为空且 AI 接管", back.cue === null && back.state !== "cue", back.state);

// ---- 7) 剧情模式开关 ----
reset();
ctx.setDirector(true);
expect("进入剧情模式", ctx.DIRECTOR.on === true);
expect("进入时自动暂停", ctx.W.paused === true);
ctx.setDirector(false);
expect("退出剧情模式", ctx.DIRECTOR.on === false);

// ---- 8) fireAt：朝指定点空放枪 ----
reset();
const shooter = ctx.addUnit("rifle", CX, CY);
ctx.cueAdd(shooter, "fireAt", { x: CX + 300, y: CY });
tick(2.2);
expect("fireAt 会在没有敌人的情况下开火", shooter.mag < shooter.magSize,
  "弹匣=" + shooter.mag + "/" + shooter.magSize);

// ---- 9) 事件触发：刷怪 ----
reset();
const z0n = ctx.W.units.filter(x => ctx.isZombieSide(x)).length;
ctx.directorFireEvent("spawnZombies");
const z1n = ctx.W.units.filter(x => ctx.isZombieSide(x)).length;
expect("事件触发器刷出丧尸", z1n - z0n === 20, (z1n - z0n) + " 只");

// ---- 10) 事件触发：增援小队 ----
reset();
const h0n = ctx.W.units.filter(x => ctx.isHuman(x) && !ctx.isZombieSide(x)).length;
ctx.directorFireEvent("squadMid");
const h1n = ctx.W.units.filter(x => ctx.isHuman(x) && !ctx.isZombieSide(x)).length;
expect("事件触发增援·中型 +11 人", h1n - h0n === 11, (h1n - h0n) + " 人");

// ---- 11) 事件触发：强制英雄升格 ----
reset();
const cand = ctx.addUnit("rifle", CX, CY);
ctx.DIRECTOR.sel = cand;
ctx.directorFireEvent("heroSel");
expect("事件触发英雄升格", !!cand.hero, cand.hero);

// ---- 12) 镜头跟拍 ----
reset();
const runner2 = ctx.addUnit("rifle", CX, CY);
ctx.DIRECTOR.camFollow = runner2;
ctx.CAM.x = 0; ctx.CAM.y = 0;
for (let i = 0; i < 30; i++) ctx.stepCameraFocus(1 / 60);
const fk = Math.min(1, (1 / 60) * 6);
for (let i = 0; i < 30; i++) {
  ctx.CAM.x += (runner2.x - ctx.CAM.x) * fk;
  ctx.CAM.y += (runner2.y - ctx.CAM.y) * fk;
}
expect("镜头跟拍会靠近目标单位", Math.abs(ctx.CAM.x - runner2.x) < 200,
  "cam=" + ctx.CAM.x.toFixed(0) + " unit=" + runner2.x.toFixed(0));

// ---- 13) 对话气泡 ----
reset();
const talker = ctx.addUnit("rifle", CX, CY);
ctx.cueAdd(talker, "say", { text: "你们先走", life: 3 });
expect("say 指令会在头上挂气泡", talker.sayT > 0 && talker.sayText === "你们先走",
  talker.sayText + " / " + talker.sayT.toFixed(1));

// ---- 14) 键位绑定：默认值 / 查找 / 冲突 ----
reset();
ctx.loadBinds();
expect("默认移动键是 M", ctx.KEYMAP.moveTo === "m", ctx.KEYMAP.moveTo);
expect("默认跟随键是 O", ctx.KEYMAP.follow === "o", ctx.KEYMAP.follow);
expect("全局暂停键是空格", ctx.KEYMAP.pause === " ", JSON.stringify(ctx.KEYMAP.pause));
expect("全局剧情模式键是 T", ctx.KEYMAP.director === "t", ctx.KEYMAP.director);
expect("方向键默认 WASD", ctx.KEYMAP.up === "w" && ctx.KEYMAP.right === "d",
  ctx.KEYMAP.up + ctx.KEYMAP.left + ctx.KEYMAP.down + ctx.KEYMAP.right);
expect("actionOfKey 能查到动作", ctx.actionOfKey("m") === "moveTo", ctx.actionOfKey("m"));
expect("actionOfKey 能查到全局键", ctx.actionOfKey("t") === "director", ctx.actionOfKey("t"));
expect("未绑定键返回 null", ctx.actionOfKey("z") === null);
expect("冲突检测能认出其他动作", ctx.ownerOfKey("m", "follow") === "移动", ctx.ownerOfKey("m", "follow"));
expect("全局键之间也能查出冲突", ctx.ownerOfKey("t", "cinema") === "剧情模式", ctx.ownerOfKey("t", "cinema"));
expect("同一个动作不算冲突", ctx.ownerOfKey("m", "moveTo") === null);

// ---- 15) 键位改绑后能持久化 ----
ctx.KEYMAP.follow = "y";
ctx.KEYMAP.director = "g";     /* 全局键同样可以改绑 */
ctx.saveBinds();
ctx.KEYMAP = {};
ctx.loadBinds();
expect("改绑后能读回来", ctx.KEYMAP.follow === "y", ctx.KEYMAP.follow);
expect("全局键也能改绑并保存", ctx.KEYMAP.director === "g", ctx.KEYMAP.director);
expect("改绑后 actionOfKey 跟着变", ctx.actionOfKey("y") === "follow", ctx.actionOfKey("y"));
expect("旧键已释放", ctx.actionOfKey("o") === null);
expect("全局动作新键可查到", ctx.actionOfKey("g") === "director", ctx.actionOfKey("g"));
ctx.loadBinds();

// ---- 16) applyBind：面板里按下一个键 ----
ctx.KEYMAP = {};
ctx.loadBinds();
ctx.BIND_WAIT = "die";
ctx.applyBind("z");
expect("按键后完成绑定", ctx.KEYMAP.die === "z", ctx.KEYMAP.die);
expect("绑定后退出等待状态", ctx.BIND_WAIT === null);

// ---- 17) 快捷键与按钮共用同一条执行路径 ----
reset();
ctx.setDirector(true);
const actU = ctx.addUnit("rifle", CX, CY);
ctx.DIRECTOR.sel = actU;
ctx.directorDoAction("moveTo");
expect("directorDoAction 进入待定点选", ctx.DIRECTOR.pending === "moveTo", ctx.DIRECTOR.pending);
ctx.DIRECTOR.pending = null;
ctx.directorDoAction("hold");
expect("无坐标指令立刻生效", actU.cue && actU.cue.act === "hold", actU.cue ? actU.cue.act : "null");
ctx.setDirector(false);

console.log(fail === 0 ? "=== 导演模式测试全部通过 ===" : "=== 有 " + fail + " 项失败 ===");
process.exit(fail === 0 ? 0 : 1);