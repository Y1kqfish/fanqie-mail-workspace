# 番茄原生阅读页目录同步实施计划

项目不是 Git 仓库；不创建 worktree、不初始化仓库、不提交 commit。每个任务采用 RED → 确认预期失败 → 最小 GREEN → 聚焦回归。

## Task 1：原生目录同步状态机

- 新增 `src/core/native-catalog-sync.js` 与聚焦测试。
- 覆盖原生节点留在 `#app`、禁止 synthetic click、动态目录等待、整批校验、同一 promise、取消/超时/失联/关闭。
- 目录成功只在原生目录关闭后回调，失败不改现有邮件。

## Task 2：皮肤同步提示与显式回退

- 增加独立同步提示 API：`enterNativeCatalogSync`、`updateNativeCatalogSync`、`exitNativeCatalogSync`。
- 同步时隐藏邮箱 shell 的命中，不移动 reader box；提示不覆盖原生工具栏。
- 失败后才显示“打开作品页同步”，回退按钮只触发一次。

## Task 3：控制器组合与生命周期

- “同步邮件”进入原生同步状态机，不调用原生目录打开 helper。
- 成功关闭目录后批量合并本地已读并原子渲染；SPA/停用/恢复/dispose 清理同步资源。
- 作品页回退只复用已存在的一次性 token collector，不再默认创建隐藏 iframe。

## Task 4：运行时入口、文档与验证

- Manifest 加载新模块；移除 reader content script 对旧 dock、hidden source load 的运行时依赖。
- 更新 README、PRD、验收矩阵及相关说明，保留 M3.1 边界。
- 运行聚焦测试、全量 `npm test`、所有 `src/**/*.js` 的 `node --check`、Manifest 与安全静态扫描，最后只交付手动重载复验清单。
