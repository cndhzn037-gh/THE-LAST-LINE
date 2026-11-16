import fs from "node:fs";
const [accId, token] = fs.readFileSync("E:\\开发小游戏\\HTML 代码文件夹\\signal\\.cred", "utf8").split("\n");
const H = { "Authorization": "Bearer " + token, "Content-Type": "application/json" };
async function api(p, opt) {
  const r = await fetch("https://api.cloudflare.com/client/v4" + p, Object.assign({ headers: H }, opt || {}));
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, json: j, text: t };
}
const proj = await api("/accounts/" + accId + "/pages/projects");
for (const p of proj.json.result) {
  console.log("=== Pages 项目: " + p.name + " ===");
  console.log("  子域: " + p.subdomain + ".pages.dev");
  console.log("  生产分支: " + (p.production_branch || "-"));
  console.log("  构建配置: " + (p.build_config ? JSON.stringify({ cmd: p.build_config.build_command, dir: p.build_config.destination_dir, root: p.build_config.root_dir }) : "无（直接上传）"));
  const st = await api("/accounts/" + accId + "/pages/projects/" + p.name + "/deployments?per_page=3");
  if (st.json && st.json.success) {
    for (const d of (st.json.result || [])) {
      const files = d.files_count !== undefined ? d.files_count : (d.deployment_trigger ? "-" : "-");
      const trig = d.deployment_trigger && d.deployment_trigger.type ? d.deployment_trigger.type : "-";
      console.log("  部署 " + String(d.id).slice(0, 8) + "  环境=" + (d.environment || "-") +
        "  触发=" + trig + "  文件数=" + files + "  时间=" + (d.created_on || "").slice(0, 16));
    }
  }
  const dom = await api("/accounts/" + accId + "/pages/projects/" + p.name + "/domains");
  if (dom.json && dom.json.success) console.log("  绑定域名: " + (dom.json.result || []).map(x => x.name).join(", "));
}
const wk = await api("/accounts/" + accId + "/workers/scripts");
console.log("=== Worker 脚本 ===");
for (const w of (wk.json.result || [])) console.log("  " + w.id + "  修改时间 " + (w.modified_on || "").slice(0, 16));