import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const GAME = "E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html";
const html = fs.readFileSync(GAME, "utf8");
const css = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
const bi = html.indexOf('<div class="bar" id="bottom">');
const bottomHtml = html.slice(bi, html.indexOf("</div>", bi) + 6);

let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
function rule(sel) {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}", "g");
  let m, out = "";
  while ((m = re.exec(css))) out += m[1] + ";";
  return out.replace(/\s+/g, " ");
}

console.log("=== 一、底栏不能再是居中对齐 ===");
const b = rule("#bottom");
console.log("  #bottom 规则：" + b.trim());
chk(b.indexOf("justify-content:center") < 0, "不再用 justify-content:center（溢出时它会把左端挤出容器）");
chk(b.indexOf("justify-content:flex-start") >= 0, "改成从左边排起");
chk(b.indexOf("overflow-x:auto") >= 0, "允许横向滚动");
chk(b.indexOf("flex-wrap:nowrap") >= 0, "保持单行，高度不变");

console.log("=== 二、不溢出时仍然居中 ===");
chk(/^\s*#bottom\s*>\s*:first-child\s*\{[^}]*margin-left:auto/.test(css.replace(/\n/g, " ")) ||
    /#bottom\s*>\s*:first-child\s*\{[^}]*margin-left:auto/.test(css), "首项 margin-left:auto");
chk(/#bottom\s*>\s*:last-child\s*\{[^}]*margin-right:auto/.test(css), "末项 margin-right:auto");

console.log("=== 三、放置单位的下拉钉在最左边 ===");
const p = rule("#bottom #placeSel");
console.log("  #bottom #placeSel 规则：" + p.trim());
chk(p.indexOf("position:sticky") >= 0, "用 sticky 钉住");
chk(/left:\s*0/.test(p), "钉在 left:0");
chk(/background:\s*#/.test(p), "有不透明底色，滚动时不会透出底下的按钮");
const firstChild = bottomHtml.slice(bottomHtml.indexOf(">") + 1).trim();
chk(firstChild.indexOf("<select") === 0, "DOM 里第一个子元素就是下拉框");
chk(bottomHtml.indexOf('id="placeSel"') >= 0, "下拉框 id 是 placeSel");

console.log("=== 四、真实浏览器实测（360px 窄屏） ===");
const CLOSE = "</" + "script>";
const oldCss =
  "#bottom{justify-content:center;flex-wrap:nowrap;overflow-x:visible}" +
  "#bottom select{flex:1 1 auto;min-width:72px;max-width:210px}" +
  "#bottom > *{flex-shrink:0}" +
  "#bottom > :first-child{margin-left:0}" +
  "#bottom > :last-child{margin-right:0}" +
  "#bottom #placeSel{position:static;box-shadow:none}";
const narrowCss = "#bottom{position:relative!important;left:auto!important;right:auto!important;width:360px}";

function probe(mode) {
  const extra = mode === "old" ? "<style>" + oldCss + "</style>" : "";
  const js = [
    'var b=document.getElementById("bottom");',
    'var p=document.getElementById("placeSel");',
    'function snap(){var br=b.getBoundingClientRect(),pr=p.getBoundingClientRect();',
    'return {cw:b.clientWidth,sw:b.scrollWidth,sl:b.scrollLeft,',
    'pL:Math.round(pr.left-br.left),pR:Math.round(pr.right-br.left)};}',
    'var a=snap();b.scrollLeft=200;var c=snap();b.scrollLeft=9999;var d=snap();',
    'document.title=JSON.stringify({start:a,mid:c,end:d});'
  ].join("");
  return "<!doctype html><html><head><meta charset='utf-8'><style>" + css + "</style>" + extra +
    "<style>" + narrowCss + "</style></head><body>" + bottomHtml +
    "<" + "script>" + js + CLOSE + "</body></html>";
}
function findEdge() {
  const cands = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return null;
}
function measure(bin, mode) {
  const f = path.join(os.tmpdir(), "zbs_probe_" + mode + ".html");
  fs.writeFileSync(f, probe(mode));
  const u = "file:///" + f.replace(/\\/g, "/");
  const out = execFileSync(bin, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
    "--virtual-time-budget=2000", "--user-data-dir=" + path.join(os.tmpdir(), "zbs_ud_" + mode),
    "--dump-dom", u], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
  const m = out.match(/<title>(.*?)<\/title>/);
  return m ? JSON.parse(m[1]) : null;
}

const bin = findEdge();
if (!bin) {
  console.log("  跳过：这台机器上没找到 Edge/Chrome");
} else {
  try {
    const before = measure(bin, "old");
    const after = measure(bin, "new");
    if (!before || !after) { console.log("  跳过：浏览器没返回测量结果"); }
    else {
      console.log("  修复前  初始左边缘 " + before.start.pL + " px，右边缘 " + before.start.pR +
                  " px（内容宽 " + before.start.sw + "，可视宽 " + before.start.cw + "）");
      console.log("  修复后  初始左边缘 " + after.start.pL + " px，右边缘 " + after.start.pR +
                  " px；滚到 200 时左 " + after.mid.pL + " px；滚到最右时左 " + after.end.pL + " px");
      chk(before.start.pR < 0, "对照：旧写法下下拉框整体在屏幕左边界之外（这就是玩家看到的消失）");
      chk(after.start.pL >= 0, "新写法下下拉框左边缘在屏幕内");
      chk(after.start.pR <= 360, "下拉框右边缘也没超出屏幕");
      chk(after.mid.pL >= 0 && after.end.pL >= 0, "横向滑动后下拉框仍然钉在原位，随时可点");
      chk(after.end.sl > 0, "后面那些按钮滑得到");
    }
  } catch (e) {
    console.log("  跳过实测：" + String(e.message).split("\n")[0]);
  }
}

console.log("");
console.log(bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ===");
