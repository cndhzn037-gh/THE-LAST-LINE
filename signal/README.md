# 联机（信令 + WebRTC）

## 当前状态

| 环节 | 状态 |
|---|---|
| 信令（WebSocket 房间转发） | ✅ 已打通 |
| WebRTC 打洞（P2P 直连） | ✅ 已打通 |
| DataChannel | ✅ 已打通 |
| 游戏输入同步 | 未开始 |
| 帧同步与哈希校验 | 未开始 |

实测：两台设备（电脑 Firefox + 手机 Via），同一房间号，ICE 从 checking 到 connected 约 1 秒，
数据通道建立成功，可互发消息。

---

## 架构

```
浏览器
  ↓  wss://zangbishahe.pages.dev/api/signal/?room=<房间号>
Pages Worker（_worker.js，跑在可达的 pages.dev 域名下）
  ↓  Service Binding（Worker 到 Worker 的内部通道）
信令 Worker（zangbishahe-signal）
  ↓
Durable Object（每个房间号一个实例，负责纯转发）
```

**为什么这么绕**：`*.workers.dev` 在国内被 DNS 污染，换 DNS 也没用；`pages.dev` 是通的。
所以让 pages 这一端接请求，再由边缘内部转发。

**为什么必须用 Service Binding**：Workers 的普通 `fetch()` 不能代理 WebSocket，
它会把升级请求降级成普通 HTTP。只有 Service Binding 能透传。

**为什么房间号要放 `?room=` 而不能放路径**：改 URL 就得重建 Request，
一重建 `Upgrade` 语义就丢了。

---

## 部署

Pages 端用 Dashboard 上传（Direct Upload），包在 `zangbishahe-with-signal.zip`。
API 直接上传试过，Cloudflare 的 manifest 哈希算法反推不出来，文件传上去访问全 500，放弃。

Worker 端（`src/index.js`）和它的 Durable Object 绑定、Pages 的 Service Binding，
都是通过 REST API 配的，不需要装 wrangler：

- `PUT /accounts/{id}/workers/scripts/zangbishahe-signal` —— 推代码 + DO 绑定 + migration
- `PATCH /accounts/{id}/pages/projects/zangbishahe` —— 配 `services` 绑定

注意：`durable_object_bindings` 直接配到 Pages 项目上会被**静默忽略**，只能走 Service Binding。

---

## 排错经验

### 症状：本端候选 0，ICE 立刻 failed

**已确认的原因**：Firefox 的 `about:config` 里 ICE 被限制。

在 `about:config` 搜索 `media.peerconnection.ice`，这几项必须是 `false`：

- `media.peerconnection.ice.proxy_only` ← 凶手，为 true 时 ICE 只走代理
- `media.peerconnection.ice.no_host` ← 为 true 时禁用本地候选
- `media.peerconnection.ice.default_address_only`
- `media.peerconnection.ice.link_local`

以及 `media.peerconnection.enabled` 必须是 `true`。

改完要**彻底重启 Firefox**（不是刷新页面）。

### 自检命令

在浏览器控制台跑这段，不联网，只测本机能不能收集候选：

```js
var pc = new RTCPeerConnection({ iceServers: [] });
pc.onicecandidate = function (e) {
  console.log(e.candidate ? "候选: " + e.candidate.candidate : "收集结束");
};
pc.onicegatheringstatechange = function () {
  console.log("收集状态: " + pc.iceGatheringState);
};
pc.createDataChannel("t");
pc.createOffer().then(function (o) { return pc.setLocalDescription(o); });
```

正常输出：`收集状态: gathering` → 若干条 `typ host` 候选 → `收集结束`。

一条都没有 = 浏览器 WebRTC 被配置禁用，跟网络无关。

---

## 文件

| 文件 | 用途 |
|---|---|
| `src/index.js` | 信令 Worker（房间转发 + Durable Object） |
| `_worker.js` | Pages 侧转发（→ deploy/） |
| `rtc.html` | WebRTC 直连自检页（→ deploy/rtc） |
| `test.html` | 早期纯信令测试页 |
| `zangbishahe-with-signal.zip` | 当前 3.0.1 上传到 Pages 的完整包 |
| `zangbishahe-3.0.1-with-signal.zip` | 3.0.1 版本化副本 |
| `zangbishahe-3.0.0-with-signal.zip` | 3.0.0 历史包，仅回滚 |
| `zangbishahe-2.9.88.1a-with-signal.zip` | 2.9.88.1a 历史包，仅回滚 |

---

## 下一步

1. 把 DataChannel 接进游戏：房主建房间 → 客户端加入 → 交换握手
2. 玩家输入抽象成可序列化命令（操控移动、开火、投放、指挥）
3. 确定性锁步：输入按帧广播，两端各自推进
4. 周期性世界哈希校验，不一致就回滚

前两步验证过模拟层在**同一引擎**下完全确定性（`dev/lockstep.mjs` 和 `dev/lockinput.mjs`，
1200 只丧尸跑 120 秒逐位一致）。

> ⚠ **这条路线后来被证伪了**：真实环境实测（Firefox 对 Android WebView）发现浮点超越函数存在末位差异，
> 累积几十秒后世界状态出现不可逆分叉，纯锁步不成立。现行方案是**房主权威**（房主 100ms 全量广播），
> 详见 `../联机功能报告.md` 与 `../丧尸沙盒/交接文档/丧尸沙盒-交接文档.md` 的 7.2 节。

## 3.0.0 发布包

当前 Pages 上传包为 `zangbishahe-with-signal.zip`，内含 3.0.1 主程序、`rtc.html` 与 `_worker.js`。

- 当前包：7 文件，3.0.1
- 旧 3.0.0 包：`zangbishahe-3.0.0-with-signal.zip`，仅用于回滚
- 旧 2.9.88.1a 包：`zangbishahe-2.9.88.1a-with-signal.zip`，仅用于回滚
- 旧 2.0.0 及更早包：保留在原文件名中，不再作为当前包
