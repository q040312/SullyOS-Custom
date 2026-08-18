# anthropic-api-cache

此模块是 `core-integration` 后的独立分支，直接 base 为 core 的 `8c3f03a2f1ad26b0b84bb614368cc0d8d453ba03`，应用结果为 `e8be4591025ec2ea8e85169ef750128675f518ce`；它不依赖 emotion 或 memory。

候选包含 Anthropic Native 请求/响应与图片转换、设置页 Native/缓存/TTL 控件及预设保存、协议一致的连接测试、提示缓存和 TTL 配置、独立文本 API，以及缓存 token 的脱敏计费日志。缓存断点只落在第一个稳定 system 段末尾：5 分钟 TTL 不显式发送 `ttl`，1 小时 TTL 显式发送。工具链由本地 adapter 闭合 `tool_use/tool_result`；只要 Native 请求携带任何 tools，就拒绝 Instant 路径并回落本地工具循环，避免 Worker 静默丢工具。

不包含 Worker/bundle、部署配置、API Key、请求抓包、真实对话、push、Nursery、free activity、emotion 或 memory 业务代码。Core 已拥有的 deployment URL 文件不在此补丁中。Instant 测试入口在 Native 配置下会在订阅或 Worker 调用前失败关闭。Messages 调试日志在持久化前会删去 thinking、signature、redacted data 和 API key；畸形或截断的 Messages 响应只留下状态和类别，不保留原始 preview，同时保留文本、工具诊断及 usage。`review-evidence.json` 只证明候选可重放和白名单测试结果，不代表 Web、APK 或 Worker 已发布。

验证：`npm run verify:anthropic -- --target <干净基线副本>` 会分别 dry-run/write core 与本模块，执行 12 个白名单测试并检查 `git diff --check`。
