# 验收标准

当前版本允许依次应用记忆链 `core-integration → emotion-safety → memory-ombre`，也允许在各自独立的干净副本中应用 `core-integration → anthropic-api-cache` 与 `core-integration → free-activity-mcp` 分支；其他模块仍为 inventory。

- 根清单的上游提交和正式发布参照准确；core、emotion、memory、anthropic 与 free-activity 均为 `ready`/`applySupported=true`。emotion 精确依赖 core 的结果 tree，memory 直接精确依赖 emotion 的结果 tree且依赖闭包包含 core；anthropic 与 free-activity 都直接精确依赖 core，是与 emotion/memory 分离、彼此不可堆叠的候选分支。
- `node scripts/apply-module.mjs <模块> --target <目录>` 默认 dry-run；它先在临时 Git index 演算并精确比对 `resultTree`，`--write` 才会执行原子 `git apply`。写后 tree 异常时，只反向应用本次审查补丁并验证恢复原 base tree；恢复失败须人工处理。重复、错序或额外脏改动必须拒绝。
- 安装状态是 Git 可表示的 tree（跟踪文件加未忽略候选）的可复算指纹，不是 HEAD 或隐藏 marker；ignored 文件不参与，submodule 只以 gitlink SHA 表示、不读取其内部工作树。每个 patch 的 `base.module` 是声明列表末尾的直接前驱，且该前驱的祖先闭包必须覆盖所有其余 `dependsOn`；缺失、假链与环均拒绝。
- 每个模块有元数据与 README，明确依赖、正式/实验边界和“不可应用”状态。
- `node scripts/preflight.mjs --target <目录>` 以禁用 Git 可选锁的方式检查目录、HEAD 基线、干净工作树、未合并索引与敏感文件名；任一门禁不符均非零退出。
- `node scripts/repo-safety.mjs` 不输出秘密内容，并拒绝仓库候选中的禁止文件名或常见秘密模式。
- `npm run check` 与 `npm test` 通过。发布/迁移验收必须设置 `SULLY_BASELINE_REPO` 指向冻结基线，使真实 clone 应用器测试实际运行；未设置时该组测试会跳过，不能作为验收。

未来真正集成时，顾砚须重新确认上游基线、调用链、缓存与状态边界，并只生成供人工审核的候选。若出现冲突或范围歧义，立即停止。任何部署或正式发布必须获得小云明确批准；本仓库不提供自动部署能力。
