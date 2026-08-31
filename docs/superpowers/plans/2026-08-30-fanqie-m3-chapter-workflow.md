# 番茄 Mail M3.0/M3.1 章节工作流实施计划（历史草案）

> M3.0 原生阅读页同步的当前执行基线已改为 `2026-08-30-fanqie-native-catalog-sync.md`；本文件保留为历史记录，M3.1 章节工作流已完成本地实现，真实浏览器仍待独立验收。

## 边界与基线

- 工作目录为 `D:\番茄`；项目不是 Git 仓库，不初始化 Git、不创建 worktree、不提交。
- 仅实现 M3.0 可信目录同步和 M3.1 章节列表、筛选、搜索。
- 不使用 Computer Use，不操作真实浏览器；本地验证结束后交给用户手动重载。
- 保持 `storage` 唯一权限、精确 `reader/*` 匹配、无网络/隐藏接口、无正文提取/复制/缓存。
- 不改变正文搬运、动态字体、导航、进度、恢复和既有安全边界；目录 finder/parser/waiter 的既有约束只在 M3 的真实启用路径上组合，不扩大选择器。

## Task 1：基线与测试夹具

1. 读取现有皮肤、controller、native catalog dock、catalog controller、storage、Manifest 和测试。
2. 为原生可信目录节点、目录状态、章节过滤/搜索、批量渲染和性能基准补最小真实 DOM 夹具。
3. 先运行新增聚焦测试，记录因接口尚未存在或运行时仍关闭而产生的 RED。

Checkpoint：RED 失败原因必须对应缺失的 M3 行为，不接受测试语法或夹具错误。

## Task 2：native catalog dock M3 兼容

1. 在现有 native catalog dock 契约上补 M3 的 `slot` 几何定位和严格文字目标校验。
2. 原生节点保留原 parent、顺序和 React 事件树，不移动、不克隆、不调用脚本 click，不生成透明代理。
3. 只在已验证的目录文字后代使用 fqmail 前缀外观标记/伪元素显示“同步邮件”；保存所有被改属性并实现幂等 restore。
4. 缺失节点、文字目标或几何条件时 fail closed。

Checkpoint：native parent、文字目标、单 listener、resize、restore、SPA 重挂载回归通过。

## Task 3：catalog controller 与 controller 组合

1. 让 controller 默认实际启用 catalog，组合已有目录 controller 的 5 秒 app/body 等待、最终检查、互斥和 dispose。
2. 可信点击捕获阶段只设置 loading 并触发一次目录加载，不调用 synthetic click。
3. 维护同书页面会话目录元数据；切书、停用、失联或 dispose 时清理，旧 Promise 不得回写。
4. SPA 后按 chapterId 重新绑定 live element，断开条目禁止伪导航并显示受控提示。

Checkpoint：成功、超时、空目录、失联、再次同步、同书缓存和 controller 回归通过。

## Task 4：批量已读状态

1. 使用现有 `getReadMany`，确保 1085 条目录只执行一次批量读取并保持原顺序。
2. 合并原生 `visited`、本地已读和当前 active 状态；不存储正文，页面会话目录保留在内存并由标签页隔离的 `storage.session` 元数据支持跨整页导航恢复。

Checkpoint：storage 调用次数、状态合并和 persona 稳定性测试通过。

## Task 5：章节列表与皮肤接口

1. 增加 `catalogSyncSlot`，加入“同步邮件”视觉槽位，不恢复独立“目录”按钮。
2. 实现 `renderCatalog(entries, {currentChapterId})`：首次使用一次 DocumentFragment 提交，后续复用相同行节点并切换 hidden。
3. 实现 `setCatalogState` 和皮肤内部 `{filter, query, catalogState}`，不把展示控件回调扩散进 controller。
4. 文件夹映射 all/current/unread/read；其他文件夹保持展示；重点/其他仍仅视觉标签。

Checkpoint：1085 条顺序、单次首批提交、后续节点复用、空态和文件夹/条目语义测试通过。

## Task 6：搜索与筛选

1. 目录 ready 前搜索只提示先同步邮件；ready 后只对规范化章节标题搜索。
2. 组合 query 与 all/current/unread/read，支持清空搜索、切章后 active/read 更新。
3. 不读取正文、不搜索书名以外的未授权数据、不重建章节行。

Checkpoint：全部组合矩阵及无正文访问测试通过。

## Task 7：响应式与性能回归

1. 复用现有响应式 CSS，不引入密度切换或 M2 无关视觉重构。
2. 记录稳定性能基准：目录合并/首屏提交 <=1s，搜索/筛选 <=100ms；记录运行环境与实测值。
3. 回归上下章、进度、快捷键、More、单 reader box、动态字体、白底和恢复。

Checkpoint：全量测试、断点测试和性能测试通过。

## Task 8：文档、静态检查与交接

1. 同步 PRD、技术 spec、README 和验收矩阵，移除 M2 目录冻结及过时目录状态，明确 M3/M4 边界。
2. 执行 `npm test`、所有 `src/**/*.js` 的 `node --check`、Manifest 核对和网络/正文/宽泛 CSS/synthetic click 扫描。
3. 审计改动文件，确认没有触碰无关目录链路或增加权限。
4. 输出 RED→GREEN、测试精确计数、性能数据、真实浏览器未验证项和手动重载步骤。

最终门槛：只报告本地证据和“可手动重载复验”，不宣称 Chrome/Edge 实机通过。
