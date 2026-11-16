import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(process.argv[2], "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
const code = m[1];
const htmlLines = html.split("\n");
const scriptStart = html.slice(0, m.index).split("\n").length;
try { new vm.Script(code, { filename: "game.js" }); console.log("OK 语法通过"); }
catch (e) {
  console.log("错误: " + e.message);
  const mm = (e.stack || "").match(/game\.js:(\d+)/);
  if (mm) {
    const ln = parseInt(mm[1]);
    const lines = code.split("\n");
    console.log("脚本行 " + ln + "  (HTML 行 " + (ln + scriptStart - 1) + ")");
    for (let i = Math.max(0, ln - 8); i < Math.min(lines.length, ln + 4); i++) {
      console.log((i + 1) + "| " + lines[i]);
    }
  } else console.log(e.stack);
}
