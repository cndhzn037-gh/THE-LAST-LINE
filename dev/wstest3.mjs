function mk(room, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://zangbishahe.pages.dev/api/signal/?room=" + room);
    const t = setTimeout(() => reject(new Error(name + " 超时")), 12000);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error(name + " 出错")); };
  });
}
async function trial(idx) {
  const room = "t" + Math.random().toString(36).slice(2, 8);
  const a = await mk(room, "A");
  const b = await mk(room, "B");
  const ra = [], rb = [];
  a.onmessage = e => ra.push(String(e.data));
  b.onmessage = e => rb.push(String(e.data));
  await new Promise(r => setTimeout(r, 400));
  a.send("A1"); await new Promise(r => setTimeout(r, 700));
  b.send("B1"); await new Promise(r => setTimeout(r, 700));
  a.send("A2"); await new Promise(r => setTimeout(r, 700));
  b.send("B2"); await new Promise(r => setTimeout(r, 900));
  console.log("第" + idx + "轮  B收到[" + rb.join(",") + "]  A收到[" + ra.join(",") + "]");
  a.close(); b.close();
  return { ra, rb };
}
for (let i = 1; i <= 3; i++) {
  try { await trial(i); } catch (e) { console.log("第" + i + "轮失败: " + e.message); }
  await new Promise(r => setTimeout(r, 600));
}