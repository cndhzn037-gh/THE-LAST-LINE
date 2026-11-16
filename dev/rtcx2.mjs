import fs from "node:fs";
const js = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\dev\\_rtc_extracted.js", "utf8");
const lines = js.split("\n");
for (let i = 138; i < 168; i++) console.log(String(i + 1).padStart(4) + ": " + lines[i]);