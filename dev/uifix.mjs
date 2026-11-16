import fs from "node:fs";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }
console.log("=== 顶栏/底栏的 overflow 归属 ===");
chk(html.indexOf("#bottom,#editbar,#editTabs{overflow-x:auto") >= 0, "横向滚动只给了底栏与编辑器工具栏");
chk(html.indexOf("#top{overflow:visible}") >= 0, "顶栏明确放行溢出");
chk(html.indexOf(".bar,#editbar,#editTabs{overflow-x") < 0, "没有哪个 .bar 选择器再去碰顶栏");
/* 菜单必须挂在顶栏里，且是绝对定位往下弹 */
const topIdx = html.indexOf('<div class="bar" id="top">');
const popIdx = html.indexOf('<div id="menuPop">');
chk(topIdx >= 0 && popIdx > topIdx, "菜单确实是顶栏的子元素");
chk(html.indexOf("#menuPop{display:none;position:absolute;top:100%") >= 0, "菜单用绝对定位从顶栏下方弹出");
console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));