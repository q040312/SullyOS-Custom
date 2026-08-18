# 架构与边界

本仓库是以清单为主的迁移包。根清单固定上游提交和正式发布参照。记忆链须严格按 `core-integration → emotion-safety → memory-ombre` 应用，其中 emotion 相对 core、memory 相对 emotion；`anthropic-api-cache` 与 `free-activity-mcp` 都是直接相对 core 的独立分支，不能与记忆链或彼此继续堆在同一目标 tree 上。free-activity 的 MCP/Cedar 去重、进度和上下文状态严格限于单次运行，没有 Stage F 跨运行状态。其余模块只保存描述性元数据。production/review evidence 只确认指定归档标记或候选重放事实，不是完整源码快照，也不推断正式路由运行、APK/current-dist、外部 Worker 或 Shadow 的部署状态。

执行方仅可在**独立且可丢弃的工作副本**中应用 ready 模块：上游工作副本提供输入，本迁移包提供经审查的候选补丁，顾砚进行人工集成与验收。小云是任何正式发布的批准方。

应用器默认 dry-run；只有显式 `--write` 才会写入目标。它同时校验基线 HEAD、未合并索引和由临时 Git index 计算的完整工作树 tree 指纹；不会只看 HEAD。每个可应用模块声明精确 `base.tree` 与 `resultTree`，因此已应用模块保留在可见工作树中的改动可以成为后续模块的 patch base，而错误顺序、重复应用或任何额外改动都会拒绝。目标仓库不写隐藏安装状态：安装状态只由可复算 tree 指纹推导。patch 模块在预检和写入后都验证结果 tree；无写入前提模块如未来存在也只验证。Windows 的 CRLF clone 仅在前后 tree 指纹精确匹配时使用 EOL 容忍的 hunk 预检。应用器不自动解决冲突或部署。

`shadow` 是明确的实验性研究目录，不属于当前正式功能，也不应进入正式集成候选，除非未来另有小云批准和独立设计审查。
