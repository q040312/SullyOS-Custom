# 验收标准

当前版本允许且仅允许 `emotion-safety` 应用；其他模块仍为 inventory。

- 根清单的上游提交和正式发布参照准确，只有 emotion-safety 为 `ready`/`applySupported=true`。
- `node scripts/apply-module.mjs emotion-safety --target <目录>` 默认 dry-run；`--write` 仅在目标干净且 HEAD 为基线、`git apply --check` 成功后写入。
- 每个模块有元数据与 README，明确依赖、正式/实验边界和“不可应用”状态。
- `node scripts/preflight.mjs --target <目录>` 以禁用 Git 可选锁的方式检查目录、HEAD 基线、干净工作树、未合并索引与敏感文件名；任一门禁不符均非零退出。
- `node scripts/repo-safety.mjs` 不输出秘密内容，并拒绝仓库候选中的禁止文件名或常见秘密模式。
- `npm run check` 与 `npm test` 通过。

未来真正集成时，顾砚须重新确认上游基线、调用链、缓存与状态边界，并只生成供人工审核的候选。若出现冲突或范围歧义，立即停止。任何部署或正式发布必须获得小云明确批准；本仓库不提供自动部署能力。
