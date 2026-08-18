# free-activity-mcp

此模块只能在 `core-integration` 的精确结果 tree `8c3f03a2f1ad26b0b84bb614368cc0d8d453ba03` 上应用，结果为 `eea3cc83e2daa1898459b8b5045ee2a70af963f7`。它为自由活动增加角色可见的通用 MCP 工具选择、可选独立 API 配置，以及对 MCP 调用的最小化审计与安全摘要。

它直接依赖 core，**不依赖** `anthropic-api-cache`；两者可以在各自独立的 core 工作副本上验证。Cedar 的工具准备、进度、去重、错误纠正和上下文历史均只保存在一次 `XhsFreeRoamEngine.run` 调用中的局部变量。没有 Stage F、跨会话/跨运行缓存、Worker、bundle、secret、Android 或部署变更。

默认仅 dry-run：`node scripts/apply-module.mjs free-activity-mcp --target <已应用-core-的副本>`；`npm run verify:free-activity -- --target <干净基线副本>` 会依次应用 core 与本模块（先 dry-run，再 write），执行三个白名单专项测试文件和 `git diff --check`。候选验证记录为 21 项专项测试及 59 个 MCP 调用链断言通过；该证据不证明外部 MCP、Worker 或生产部署的运行状态。
