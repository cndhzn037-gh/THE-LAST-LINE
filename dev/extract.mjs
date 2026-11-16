import fs from "node:fs";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8;
const i1 = html.indexOf("</script>", i0);
const js = html.slice(i0, i1);
fs.writeFileSync("E:\\开发小游戏\\HTML 代码文件夹\\dev\\_game_js.mjs", js);
console.log("脚本长度 " + js.length);