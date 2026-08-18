# core-integration

正式功能的最小公共接线层。只包含 `utils/deploymentUrls.ts` 与无环境依赖的策略测试：Web 默认保持同源路径/凭据；APK 通过配置的 VPS origin 固定自有服务路径，并在 URL 已固定后才读取 access token，因此备份或 UI 中任意 Ombre URL 不会成为 Bearer 的目标。

不包含 `vpsSync`、Settings、voice、OSContext 或任何服务调用接线；这些仍归各自的后续模块。此 patch 从 `4dc992f` 的 tree `8acf736e5b1bd59a15fc446b99315685b5524bc8` 开始，结果 tree 为 `8c3f03a2f1ad26b0b84bb614368cc0d8d453ba03`，是后续模块精确声明 patch base 的起点。

生产参照仅能说明命名静态归档中存在标记或代码；不构成正式路由运行、APK、Worker 或其他运行时已部署的证明。
