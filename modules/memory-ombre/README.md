# memory-ombre

此模块只能在 `core-integration → emotion-safety` 的精确结果 tree 上应用：其直接 patch base 是 emotion 的 `3a81d3442f5786f6a2c9dd2549a4fd1746a6b8b0`，应用结果为 `e471f180c670888bf07184f653482db2c3a25d6b`。它实现 Ombre 权威写入/删除确认与可重建本地缓存、提供者中立的远程向量门面、稳定认知与已采纳自我叙事的受控注入，并把滚动周期状态纳入文本/完整备份。

Web 默认不会开启权威模式；只有 APK debug 候选中的 `VITE_OMBRE_AUTHORITATIVE=1` 才会将配置解析为 Ombre。该开关不携带 token，远程失败时不会把权威写入伪装成本地成功。滚动周期只在显式开关下隔离本地暂存节点，提交/归档仍须 Ombre 确认。

排除：Room ambient/roomPlates、Nursery、Shadow、Relay、`useChatAI` 混合业务、secrets、`.env.capacitor`、bundle、Android、VPS 快照同步和 schema/index 迁移。

默认仅演练：`node scripts/apply-module.mjs memory-ombre --target <已依次应用-core-emotion-的副本>`；`npm run verify:memory -- --target <干净基线副本>` 会按 core、emotion、memory 分别执行 dry-run 与 write，再执行 13 个白名单测试及 `git diff --check`。滚动测试锁定提交前零远端写入、失败周期可重试、跨操作串行、并发/延迟新节点不删除、旧账本 fail-closed、空周期可清理及旧 UI cleanup 参数兼容。`production-evidence.json` 仅记录已检查静态 Web bundle 标记；它不证明 APK、worker 或任何运行时部署。
