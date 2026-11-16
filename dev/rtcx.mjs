import fs from "node:fs";
const r = await fetch("https://zangbishahe.pages.dev/rtc");
const html = await r.text();
const i0 = html.indexOf("<script>");
const i1 = html.indexOf("</script>", i0);
const js = html.slice(i0 + 8, i1);
fs.writeFileSync("E:\\开发小游戏\\HTML 代码文件夹\\dev\\_rtc_extracted.js", js);
/* 逐行找可疑点：某些行如果提前结束会破坏结构 */
const lines = js.split("\n");
console.log("共 " + lines.length + " 行");
const bad = [];
lines.forEach((l, i) => {
  if (l.indexOf("</script") >= 0 || l.indexOf("<!--") >= 0 || l.indexOf("-->") >= 0) bad.push(i + 1);
});
console.log("含可疑标记的行: " + (bad.length ? bad.join(",") : "无"));
/* 看看第 1 行到第 12 行 */
lines.slice(0, 12).forEach((l, i) => console.log("  " + (i + 1) + ": " + l.slice(0, 100)));