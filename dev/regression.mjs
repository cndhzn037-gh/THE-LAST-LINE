import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const game = read("丧尸沙盒.html");
const checks = [];
const ok = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });

const ver = (game.match(/var GAME_VERSION = "([^"]+)"/) || [])[1] || "";
const patch = (game.match(/v: "([^"]+)", d:/) || [])[1] || "";
const hist = (read("历代更新.txt").match(/当前版本 ([^\s]+)/) || [])[1] || "";
const ann = (read("更新公告.txt").match(/版本：([^\s]+)/) || [])[1] || "";
const hand = read("丧尸沙盒/交接文档/丧尸沙盒-交接文档.md");

ok("主程序版本号存在", !!ver, ver);
ok("游戏内公告与主程序一致", ver === patch, "主程序 " + ver + " / 公告 " + patch);
ok("历代更新与主程序一致", ver === hist, "主程序 " + ver + " / 历史 " + hist);
ok("更新公告与主程序一致", ver === ann, "主程序 " + ver + " / 公告文件 " + ann);
ok("交接文档包含当前版本", hand.indexOf(ver) >= 0, ver);

const h = (p) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, p))).digest("hex");
const mainHash = h("丧尸沙盒.html");
const depHash = h("deploy/index.html");
ok("deploy 与主程序一致", mainHash === depHash, mainHash.slice(0, 16) + " / " + depHash.slice(0, 16));

for (const c of checks) {
  console.log((c.pass ? "PASS" : "FAIL") + "  " + c.name + (c.detail ? "  [" + c.detail + "]" : ""));
}
const fails = checks.filter((c) => !c.pass).length;
console.log("\n" + (fails ? fails + " 项失败" : "全部通过") + "，当前版本 " + ver);
process.exit(fails ? 1 : 0);
