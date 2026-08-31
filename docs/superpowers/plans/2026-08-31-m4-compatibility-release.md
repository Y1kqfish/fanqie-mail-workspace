# M4.1 Compatibility and Release Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task with verification checkpoints.

**Goal:** 建立 M4 兼容与发布验收基线，准确记录 M3 当前状态，并完成不改变运行时行为的自动、安全和清单验证。

**Architecture:** 本批只做文档和验证，不新增运行时代码，不删除或修改现有性能计时入口。独立验收表分离用户手工结果、Browser 连接超时、自动测试和未验证项；后续兼容与发布工作按 M4.2–M4.4 分批确认。

**Tech Stack:** Markdown 文档、Chrome/Edge Manifest V3 清单、Node.js 内置 test runner、PowerShell 静态扫描。

**Spec:** 用户批准的 M4.1 收尾与兼容发布验收要求（本计划记录其执行边界）。

## Global Constraints

- 只修改 `D:\番茄`，项目不是 Git 仓库，不初始化 Git、不创建 worktree、不提交。
- 本批只执行 M4.1；不进入 M4.2，不操作浏览器，不使用 Computer Use。
- 不修改目录、导航、搜索、筛选、存储、正文、动态字体、恢复或性能计时运行时行为。
- 不增加权限、依赖、网络请求、隐藏接口或正文缓存。
- Manifest 继续仅声明 `storage`；reader 内容脚本只匹配 `https://fanqienovel.com/reader/*`，page 脚本只承担最小目录采集。
- 性能量化尚未由真实浏览器验证；不得宣称 `<=1s` 或 `<=100ms` 已达标。
- 无匹配空态提示是已接受的非阻断限制；隐藏行键盘焦点留给 M4。

### Task 1: 建立 M4.1 文档基线

**Files:**
- Create: `docs/superpowers/plans/2026-08-31-m4-compatibility-release.md`
- Create/Update: `docs/product/2026-08-31-fanqie-m3-closeout-acceptance.md`

- [x] 保存本计划，明确 M4.1–M4.4 路线和每批确认门槛。
- [x] 收尾验收表记录 Chrome 基线、皮肤目录行 1089、Browser 连接超时的未定性，以及用户已确认的搜索/筛选/已读/换章/刷新/前进后退/取消同步结果。
- [x] 单独列出未验证键盘焦点、已接受的无匹配空态限制、性能未量化和 M4 后续范围。

### Task 2: 同步 README 与 PRD

**Files:**
- Modify: `README.md`
- Modify: `docs/product/fanqie-mail-prd.md`

- [x] 订正章节列表说明：目录未同步时回退显示当前章节，目录同步后显示真实章节列表。
- [x] 订正章节选择为经校验的同源 `/reader/<id>` 链接整页导航，不猜章节来源、不读正文。
- [x] 标记 M3 为“功能手工验收完成，性能量化未验证且不再阻塞阶段交接”，不声称 M3 全部完成。
- [x] 链接独立收尾验收表，保留 M4.2–M4.4 边界。

### Task 3: M4.1 自动与安全验证

**Files:**
- Read-only verification: `manifest.json`, `src/**/*.js`, `src/**/*.css`, `tests/**/*.js`

- [x] 运行 `npm test`，记录实际通过/失败数。
- [x] 对全部 `src/**/*.js` 执行 `node --check`，记录文件数和失败数。
- [x] 验证 Manifest 只有 `storage`、没有 `host_permissions`，reader 脚本仅匹配 `reader/*`，page 脚本仅加载最小目录采集器，且计时模块在皮肤/controller 前加载。
- [x] 静态扫描 `fetch`、`XMLHttpRequest`、`WebSocket`、隐藏接口、正文复制/缓存、宽泛 CSS 和合成目录点击；区分源码静态结果与站点自身 iframe/page 导航网络行为，不扩大扫描结论。
- [x] 确认本批没有修改性能模块、目录链路或运行时业务。
- [x] 记录当前默认原生目录同步与用户明确触发的作品页回退：`catalog-page-source.js`/旧 handoff 模块不在 Manifest 加载链，`catalog-page-workflow.js` 仍加载但仅在用户调用 `startFallback` 时服务显式作品页回退，其遗留 `load`/静默分支不走默认原生同步路线。

### Task 4: M4.1 检查点与交接

- [x] 记录项目不是 Git 仓库、没有创建 worktree 或提交。
- [x] 交回主任务等待批次确认，不自动进入 M4.2。
- [x] 交接内容必须明确：自动测试、用户手工反馈、Browser 超时、未验证项和真实性能数据彼此分层。

## 后续路线（仅记录，不在 M4.1 执行）

- **M4.2 Chrome 核心流程：** 目录同步、跨章会话保留、搜索/筛选/已读、上一章/下一章、刷新进度、快捷键、取消同步、恢复和单份正文。
- **M4.3 Edge 与兼容矩阵：** Edge 核心流程；2560/1920/1280/960/720/375px；键盘焦点；慢加载、启动失败和恢复边界。
- **M4.4 安装与发布：** 安装/重载、发布包、许可证、README、已知限制和发布确认；不自动发布。
