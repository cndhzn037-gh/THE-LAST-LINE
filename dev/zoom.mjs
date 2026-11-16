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
const ctx=vm.createContext(sb);
vm.runInContext(code,ctx,{filename:"game.js"});

let fail = 0;
function expect(tag, ok, extra) {
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + tag + (extra === undefined ? "" : "  " + extra));
}
const wheel = (dy, x, y) => ctx.onWheel({ preventDefault: noop, deltaY: dy, clientX: x, clientY: y });
const frames = (n) => { for (let i = 0; i < n; i++) ctx.stepZoom(1 / 60); };

// ---- 1) 不再瞬间跳变 ----
ctx.CAM.x = 2000; ctx.CAM.y = 1000; ctx.CAM.zoom = 0.5;
ctx.ZOOM_TO = null;
const z0 = ctx.CAM.zoom;
wheel(-100, 320, 210);
expect("滚轮后 zoom 没有立刻跳", Math.abs(ctx.CAM.zoom - z0) < 1e-9, ctx.CAM.zoom.toFixed(4));
const target = ctx.ZOOM_TO;
expect("目标值已记下且大于当前", target > z0, "target=" + target.toFixed(4));

frames(1);
const afterOne = ctx.CAM.zoom;
expect("一帧后只推进了一部分", afterOne > z0 && afterOne < target * 0.5 + z0 * 0.5,
  afterOne.toFixed(4) + " (目标 " + target.toFixed(4) + ")");

frames(60);
expect("一秒内平滑到位", Math.abs(ctx.CAM.zoom - target) < 1e-4, ctx.CAM.zoom.toFixed(4));
expect("到位后动画结束", ctx.ZOOM_TO === null);

// ---- 2) 锚点世界坐标不动 ----
ctx.CAM.x = 2000; ctx.CAM.y = 1000; ctx.CAM.zoom = 0.5; ctx.ZOOM_TO = null;
const mx = 320, my = 210;
const wx0 = ctx.s2wx(mx), wy0 = ctx.s2wy(my);
wheel(-100, mx, my);
frames(60);
expect("放大后鼠标下的世界坐标不变",
  Math.abs(ctx.s2wx(mx) - wx0) < 0.05 && Math.abs(ctx.s2wy(my) - wy0) < 0.05,
  "dx=" + (ctx.s2wx(mx) - wx0).toFixed(4) + " dy=" + (ctx.s2wy(my) - wy0).toFixed(4));

// ---- 3) 连续滚轮会累积 ----
ctx.CAM.x = 2000; ctx.CAM.y = 1000; ctx.CAM.zoom = 0.5; ctx.ZOOM_TO = null;
wheel(-100, mx, my);
const t1 = ctx.ZOOM_TO;
wheel(-100, mx, my);
const t2 = ctx.ZOOM_TO;
expect("连滚两格目标继续累加", t2 > t1, t1.toFixed(3) + " -> " + t2.toFixed(3));
expect("累加幅度是 1.12^2", Math.abs(t2 - 0.5 * 1.12 * 1.12) < 1e-6, t2.toFixed(5));

// ---- 4) 反向滚轮能立刻回退 ----
wheel(100, mx, my);
expect("反向滚动把目标拉回来", ctx.ZOOM_TO < t1 + 1e-9, ctx.ZOOM_TO.toFixed(4));

// ---- 5) 上下限夹紧 ----
ctx.CAM.zoom = 2.39; ctx.ZOOM_TO = null;
wheel(-100, mx, my);
frames(60);
expect("不超过最大缩放", ctx.CAM.zoom <= ctx.CAM.maxZ + 1e-9, ctx.CAM.zoom.toFixed(3));
ctx.CAM.zoom = 0.121; ctx.ZOOM_TO = null;
wheel(100, mx, my);
frames(60);
expect("不低于最小缩放", ctx.CAM.zoom >= ctx.CAM.minZ - 1e-9, ctx.CAM.zoom.toFixed(3));

console.log(fail === 0 ? "=== 缩放测试全部通过 ===" : "=== 有 " + fail + " 项失败 ===");
process.exit(fail === 0 ? 0 : 1);
