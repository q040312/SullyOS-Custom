# Sully 定制功能迁移包

这是一个**私有、元数据优先**的迁移包，用于将 Sully 定制能力从已确认的上游基线整理为可审查的集成候选。

## 目标

- 固定上游基线、正式发布参照和模块清单。
- 为每个候选模块保留依赖与正式/实验边界。
- 在实际迁移前提供只读预检与仓库安全检查。

## 非目标

- `core-integration → emotion-safety → memory-ombre` 是记忆链；`anthropic-api-cache` 与 `free-activity-mcp` 是从 core 分出的独立分支。五者均为可重放 `ready` 补丁，其余模块仍为 `inventory`。
- 不包含密钥、部署配置或生产数据；生产 evidence 只记录可复核事实，不替代完整源码快照。
- 不会自动修改目标仓库、解决冲突、生成发布包或部署。

## 后续操作与批准

后续由顾砚在独立工作副本中逐项整理、审查并生成集成候选；发生冲突立即停止并交回人工决策。任何正式发布、上线或对外分发均须先取得小云明确批准。

## 验证

```powershell
npm run check
$env:SULLY_BASELINE_REPO = 'C:\\path\\to\\frozen-sully-baseline'
npm test
node scripts/preflight.mjs --target .\sully-baseline-copy
npm run verify:memory -- --target .\sully-baseline-copy
npm run verify:anthropic -- --target .\another-clean-baseline-copy
npm run verify:free-activity -- --target .\third-clean-baseline-copy
```

不设置 `SULLY_BASELINE_REPO` 时，真实 clone 应用器测试会被明确跳过；它只能用于本地快速检查，不能作为发布或迁移验收。发布门禁必须设置该变量并运行完整测试。

详见 [架构说明](docs/architecture.md) 与 [验收标准](docs/acceptance.md)。
