# emotion-safety

此模块可应用到干净的 `4dc992f` 工作副本。它只保留经单行化、控制字符过滤和限长处理的 `activeBuffs` 抽象标签与强度，阻止旧事件或临时场景进入跨回合注入，并在 AMSG 回合收尾从 DB 重读角色以避免旧闭包覆盖新情绪状态；`emotionAmsgRace.test.ts` 是该静态接线的回归守卫，不是运行时竞态测试。`core-integration` 是此精确基线已内含的逻辑依赖，应用器不会递归安装它。

应用命令默认只演练：`node scripts/apply-module.mjs emotion-safety --target <副本>`；只有显式 `--write` 才会写入。`production-evidence.json` 记录 20:34 正式 Web 归档中命中的 bundle 标记；它不是完整源码快照，也不证明后续 APK/current-dist 或 worker 已部署。
