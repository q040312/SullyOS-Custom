# push-runtime

这是运行时迁移盘点，不是可应用模块：`status=inventory`、`applySupported=false` 保持不变。源码存在、静态 bundle 存在，或仓库曾出现部署说明，都不证明任何 Web、Worker、D1、Cron、原生通知或 APK 已部署；前端发布物和外部 Worker 必须分别取得可复现证据。

当前内容不能安全地封装为一个 patch。它至少包含两套不同的客户端/Worker 协议，以及一个应独立处理的 Proactive 候选。提取前必须先选定其中一个候选，确认上游版本与平台配置，再从干净基线做可重放验证。

## 候选 A：Instant Push 客户端 + Worker

目标是浏览器前台 SSE 与 Web Push 双通道的 Instant 消息；它不是 AMSG2 的通用租户客户端。建议的初始白名单仅包括：

- 客户端：`utils/instantPushClient.ts`、`utils/instantWorkerVersion.ts`、`utils/nativePush.ts`、`utils/pushVapid.ts`、`utils/pushSubscribeShared.ts`、`components/WorkerUpdateReminderEvent.tsx` 及其必要的调用接线；
- Worker 源码：`worker/instant-push/src/`、该子目录的 `package.json` 与仅含占位符的 `wrangler.toml`；
- 已证明必要的共享接收契约，必须单独列明并与候选 B 一起评审：`utils/activeMsgStore.ts`、`utils/activeMsgRuntime.ts`、`worker/sw-keep-alive.ts`。

禁止把 `worker.bundle.js`、`worker.deno.bundle.js`、Deno loader、真实 Worker URL、VAPID 私钥、FCM service-account JSON、客户端 token、Cloudflare 凭据、D1 绑定/数据或任何环境文件放进模块。默认只支持 multipart；D1 BlobStore 只能作为另行批准、另行验证的扩展。

验收至少应锁定 `@rei-standard/amsg-*` 版本，运行现有 `utils/instantPushClient.test.ts` 与 `worker/instant-push/src/{pushDecision,fcm,classifier,anthropicCompat}.test.ts`，重建 Worker 后比较源码与生成物，并在隔离浏览器环境验证：SSE 拒绝不能直接判送达失败、Web Push/SSE 按 `messageId` 去重、唯一送达判定为 SW 的 `active-msg-received`。不得用真实订阅、真实 LLM 凭据或已部署 Worker 作测试前提。

## 候选 B：AMSG2 客户端 + Service Worker

目标是 `@rei-standard/amsg-client` / `amsg-sw` 的租户、收件箱、离线恢复与 Service Worker 协议；它不包含 Instant Worker 的 LLM 执行与 Web Push 部署。建议初始白名单为：

- `utils/activeMsgClient.ts`、`utils/activeMsgStore.ts`、`utils/activeMsgRuntime.ts`、`utils/instantToolRunner.ts`；
- `worker/sw-keep-alive.ts`；
- 只为上述协议不可避免的类型、启动接线与既有测试。

该候选和 Instant Push 共享 IndexedDB、SW 广播与消息形状，不能各自复制一份实现，也不能在未做兼容矩阵前独立应用。`utils/activeMsgStore.test.ts` 是最低回归门槛；还必须在 fake IndexedDB/隔离 SW 环境证明 upgrade、连接关闭重试、multipart 去重、inbox 落库与冷启动消费。任何数据库 URL、init secret、tenant key、真实订阅或生产 API base 都不应进入 patch、fixture 或日志。

## 候选 C：Proactive（单独盘点）

Proactive 不是 Instant/AMSG2 的子功能。先区分可本地运行的定时器（`utils/proactiveChat.ts`）和远端加速器（`utils/proactivePushConfig.ts`、`worker/proactive-push/src/`）。建议先只评估本地定时器及必要的 UI/Service Worker 消息契约；远端加速器需要 D1、cron、VAPID 和访问控制，必须作为新的、显式授权的部署模块处理。

不得收录 `worker/proactive-push/worker.bundle.js`、`schema.sql` 的真实执行结果、D1 数据/ID、cron、Worker URL、VAPID 私钥、`CLIENT_TOKEN` 或任何真实订阅。若以后允许远端候选，验收需要从空的模拟 D1 和模拟 Push service 开始，覆盖 schedule 的 start/stop/resume、去重、防止无心跳唤醒，以及关闭加速器后本地定时路径仍保持工作；不能用真实订阅或真实 Cron 验收。

## 共同发布边界

任何未来 patch 都必须：从干净上游 tree 重放；以白名单核对 diff；不携带 secrets、D1、真实订阅、bundle、APK 或部署配置值；在前端构建和目标测试通过后，仍保持为未部署状态。只有客户端与对应 Worker 各自的版本、配置模板、依赖锁定、回滚步骤及隔离运行证据齐全，才可以提议把某一个候选从 inventory 拆成独立模块；不得把三类候选合并发布。
