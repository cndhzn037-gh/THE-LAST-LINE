/**
 * 信令服务器 —— 一个只管传话的房间。
 *
 * 它不懂 WebRTC，也不懂游戏。WebRTC 的两个端点要先交换 offer / answer / ICE
 * 才能直连，这些东西加起来几 KB，交换完就没用了。这里只负责让 A 说的话
 * 能被同房间的 B 听到，反过来也一样。
 *
 * 每个房间号映射到一个 Durable Object 实例：实例由名字寻址、单线程、有状态，
 * 天然就是"房间"。多个请求落在同一个实例上，才可能共享连接列表。
 */

// 一个房间最多几个人：联机对局是 1v1，留一点余量给重连
const MAX_PEERS = 2;

export class Room {
  constructor(state, env) {
    this.state = state;
  }

  async fetch(request) {
    if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
      return new Response("这个端点只接受 WebSocket", { status: 426 });
    }

    const peers = this.state.getWebSockets();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    if (peers.length >= MAX_PEERS) {
      // 先建再关：让客户端收到一个明确的"房间已满"，而不是连接超时
      this.state.acceptWebSocket(server);
      try { server.close(1013, "room full"); } catch (e) {}
      return new Response(null, { status: 101, webSocket: client });
    }

    // 用 Hibernation API 接管：没有消息时这个实例可以被驱逐，醒来仍能拿到连接
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // 收到谁的消息就原样转发给同房间其他人，不看内容
  webSocketMessage(ws, message) {
    const peers = this.state.getWebSockets();
    for (let i = 0; i < peers.length; i++) {
      const p = peers[i];
      if (p === ws) continue;
      try {
        p.send(message);
      } catch (e) {
        // 对端已经断了，忽略；它自己的 close 事件会负责清理
      }
    }
  }

  webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch (e) {}
  }

  webSocketError(ws, err) {
    try { ws.close(1011, "error"); } catch (e) {}
  }
}

// 房间号只允许简单字符，避免拿路径搞事情
function cleanRoom(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s.length > 32) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  return s;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 一个给人看的自检页：浏览器直接访问能确认服务活着
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("zangbishahe signal 在线。用法：wss://<这个域名>/?room=<房间号>", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    const room = cleanRoom(url.searchParams.get("room") || url.pathname.slice(1));
    if (!room) return new Response("缺房间号，或者房间号不合法", { status: 400 });

    // 同一个房间号永远映射到同一个 DO 实例
    const id = env.ROOM.idFromName(room);
    return env.ROOM.get(id).fetch(request);
  }
};
