import fs from "node:fs";
const html = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\丧尸沙盒.html", "utf8");
const i0 = html.indexOf("<script>") + 8, i1 = html.indexOf("</script>", i0);
const gcode = html.slice(i0, i1);
let bad = 0;
function chk(ok, msg) { if (!ok) bad++; console.log("  " + (ok ? "OK " : "XX ") + msg); }

console.log("=== 死锁三处关键点 ===");
/* LOCK.tick 里不应该再有帧号上报 */
const lockTickStart = gcode.indexOf("LOCK.tick = function");
const lockTickEnd = gcode.indexOf("};", gcode.indexOf("if (this.frame - this.lastCheck", lockTickStart));
const lockTickBody = gcode.slice(lockTickStart, lockTickEnd);
chk(lockTickBody.indexOf('t: "tick"') < 0, "模拟循环里不再上报帧号（原来就死在这）");

/* 渲染循环里应该有独立心跳 */
const frameStart = gcode.indexOf("function frame(now)");
const frameBody = gcode.slice(frameStart, frameStart + 4000);
chk(frameBody.indexOf('t: "tick"') >= 0, "渲染循环里有独立的帧号心跳");
chk(frameBody.indexOf("lastTickMs") >= 0, "心跳带时间戳，停下也会定期发");

/* 等待要有两道超时保险 */
const waitIdx = gcode.indexOf("var waitPeer = LOCK.on");
const waitBody = gcode.slice(waitIdx, waitIdx + 700);
console.log("  等待判据附近代码：");
waitBody.split("\n").slice(0, 12).forEach(l => console.log("    " + l.trim().slice(0, 90)));
chk(waitBody.indexOf("peerFrameT") >= 0, "保险一：对面太久没消息就不等");
chk(waitBody.indexOf("waitSince") >= 0, "保险二：自己等太久也放弃");

console.log("=== 收到帧号会刷新时间戳 ===");
chk(gcode.indexOf("LOCK.peerFrameT = Date.now()") >= 0, "每收到一次帧号就记一次时间");

console.log("\n" + (bad === 0 ? "=== 全部通过 ===" : "=== 有 " + bad + " 项失败 ==="));