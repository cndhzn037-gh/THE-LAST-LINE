const r = await fetch("https://zangbishahe.pages.dev/rtc");
const html = await r.text();
console.log("页面长度 " + html.length);
const i0 = html.indexOf("<script>");
const i1 = html.indexOf("</script>", i0);
console.log("script 起止: " + i0 + " / " + i1);
if (i0 < 0 || i1 < 0) { console.log("找不到 script 块"); process.exit(1); }
const js = html.slice(i0 + 8, i1);
console.log("脚本长度 " + js.length);
/* 严格语法检查 */
try {
  new Function(js);
  console.log("语法检查：通过");
} catch (e) {
  console.log("语法检查：失败 -> " + e.message);
}
/* 找几个关键标识，确认内容没被截断 */
for (const k of ["btnRand", "btnStart", "createOffer", "stCand", "function log"]) {
  console.log("  包含 " + k + ": " + (js.indexOf(k) >= 0));
}