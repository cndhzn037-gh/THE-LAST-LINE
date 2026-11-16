
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const mf = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
console.log("manifest.name =", mf.name);
console.log("manifest.display =", mf.display, "| start_url =", mf.start_url);
console.log("icons =", mf.icons.map(i => i.src + " " + i.sizes).join(", "));
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
console.log("index.html 含 manifest link:", html.indexOf('rel="manifest"') >= 0);
console.log("index.html 含 sw 注册:", html.indexOf("serviceWorker.register") >= 0);
const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8");
console.log("sw.js 缓存名单条数:", (sw.match(/"\.\/js\//g) || []).length + 6);
let total = 0, n = 0;
(function walk(p) {
  for (const f of fs.readdirSync(p)) {
    const q = path.join(p, f);
    const st = fs.statSync(q);
    if (st.isDirectory()) walk(q);
    else { total += st.size; n++; }
  }
})(dir);
console.log("文件数", n, "合计", (total / 1024).toFixed(1), "KB");
