const ROOM = "room" + Math.random().toString(36).slice(2, 8);
const URL1 = "wss://zangbishahe.pages.dev/api/signal/?room=" + ROOM;
console.log("房间: " + ROOM);
const got = { a: [], b: [] };
let done = false;
function finish(code) { if (!done) { done = true; process.exit(code); } }

function mk(name, key) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL1);
    const t = setTimeout(() => reject(new Error(name + " 连接超时（15秒）")), 15000);
    ws.onopen = () => { clearTimeout(t); console.log(name + " 已连接 ✓"); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error(name + " 连接出错")); };
    ws.onmessage = (ev) => { got[key].push(String(ev.data)); console.log(name + " 收到 ← " + ev.data); };
    ws.onclose = (ev) => console.log(name + " 关闭 code=" + ev.code + " " + (ev.reason || ""));
  });
}
let a, b;
try {
  a = await mk("A", "a");
  b = await mk("B", "b");
} catch (e) {
  console.log("XX " + e.message);
  finish(1);
}
await new Promise(r => setTimeout(r, 500));
a.send("来自 A 的第一条");
await new Promise(r => setTimeout(r, 1000));
b.send("来自 B 的回话");
await new Promise(r => setTimeout(r, 1200));

const ok1 = got.b.includes("来自 A 的第一条");
const ok2 = got.a.includes("来自 B 的回话");
console.log("");
console.log("A→B " + (ok1 ? "成功 ✓" : "失败 ✗") + "   B→A " + (ok2 ? "成功 ✓" : "失败 ✗"));
a.close(); b.close();
setTimeout(() => finish(ok1 && ok2 ? 0 : 1), 300);