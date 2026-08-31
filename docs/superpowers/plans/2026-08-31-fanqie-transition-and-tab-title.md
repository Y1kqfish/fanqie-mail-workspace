# 番茄 Mail 换章过渡与标签页外观实施计划

**目标：** 在不改变真实章节导航、目录链路、正文节点或权限边界的前提下，减少整页换章时原生页面短暂暴露，并为当前阅读标签提供可逆的 Outlook 标题与本地图标。

**架构：** 新增一个只匹配 reader 页、在 `document_start` 运行的轻量过渡模块；现有依赖完整 DOM 的 controller 继续在 `document_idle` 运行。新增独立标签页外观模块由 controller 生命周期组合，使用内存保存原生 title/favicon，站点后续变更时持续跟踪并在启用期间重施固定外观。

**技术栈：** Manifest V3 classic content scripts、原生 DOM/MutationObserver、`browser.storage.local`/`chrome.storage.local`、Node 内置 test runner；不增加依赖。

## 全局约束

- 只修改 `D:\番茄`，项目不是 Git 仓库，不初始化 Git、不创建 worktree、不提交。
- 永久不使用 Computer Use；实现阶段不操作真实浏览器，完成本地验证后交回手动 Browser/Chrome 验收。
- 不修改目录采集、目录 parser/waiter、目录会话存储、章节 URL 校验、正文搬运、动态字体、权限或网络行为。
- 过渡层只匹配 `https://fanqienovel.com/reader/*`，最长覆盖 5 秒，设置读取失败、停用、恢复或启动失败均释放。
- 标签页外观只使用固定可逆的标题与本地 Outlook 彩色 favicon；不读取账户、Cookie、历史或邮箱数据，不使用运行时外链。
- 所有扩展 CSS 使用 `fqmail-` 前缀，不修改原生页面的宽泛样式。

### Task 1：基线与失败回归

**Files:**
- Create: `docs/superpowers/plans/2026-08-31-fanqie-transition-and-tab-title.md`
- Test: `tests/early-transition.test.js`
- Test: `tests/tab-appearance.test.js`
- Modify: `tests/manifest.test.js`

- [x] 写出早期脚本顺序、设置读取、超时释放、body/head 未就绪和标题/favicon 生命周期的最小 RED 测试。
- [x] 运行聚焦测试，确认因模块/接口尚不存在而失败，而非夹具错误。

### Task 2：早期换章过渡

**Files:**
- Create: `src/core/early-transition.js`
- Create: `src/core/early-transition.css`
- Modify: `manifest.json`
- Modify: `src/content.js`
- Test: `tests/early-transition.test.js`

- [x] 实现一次性 `start/ready/release`，从入口时刻计时，300ms 内拿不到启用设置即释放，5 秒硬上限，迟到结果不得重新挂载。
- [x] 仅在 body 可用时创建轻量状态外壳；head/body 未就绪安全等待或释放，不创建重复文档根节点。
- [x] 主流程成功挂载后调用 `ready()`；停用、恢复、启动异常和目录同步临时模式不被过渡层阻塞。
- [x] 聚焦 RED→GREEN，并验证主脚本仍为 `document_idle`。

### Task 3：标签页外观模块

**Files:**
- Create: `src/core/tab-appearance.js`
- Create: `src/skins/outlook/outlook-favicon.js`
- Modify: `src/adapters/fanqie/parser.js`
- Modify: `src/core/controller.js`
- Modify: `src/content.js`
- Test: `tests/tab-appearance.test.js`
- Test: `tests/fanqie-adapter.test.js`

- [x] 实现 `create({documentLike,windowLike})` 的 `enable/restore/dispose/getNativeTitle` 生命周期。
- [x] 启用时固定标题 `收件箱 - Outlook`，同时保留“番茄个人阅读工作区”无账户语义；原始标题与 favicon 只在当前文档内存中保存。
- [x] 监听 title/head 与 favicon 的替换、新增、属性变化和移除；过滤自身写入，停用时移除自身节点并恢复最新原生状态。
- [x] 使用官方 Microsoft Office/Outlook SVG 的本地数据 URL；在 NOTICE 中记录来源 URL，不引入 CDN 运行时请求。
- [x] parser 的 document-title fallback 优先读取外观模块保存的原始标题，避免固定 Outlook 标题污染 bookId。

### Task 4：生命周期组合

**Files:**
- Modify: `src/core/controller.js`
- Modify: `src/content.js`
- Test: `tests/controller.test.js`
- Test: `tests/controller-session.test.js`

- [x] 仅在主 controller 成功接管正文、完成会话恢复或受控失败后释放过渡；同步目录模式继续使用现有临界区。
- [x] SPA title 更新不改变身份/目录会话；上下章沿用当前导航等待，不新增过渡动画。
- [x] disable/restore/mount failure 释放过渡和标签外观，恢复最新原生标题/favicon。

### Task 5：文档与安全验证

**Files:**
- Modify: `README.md`
- Modify: `docs/product/fanqie-mail-prd.md`
- Modify: `docs/superpowers/specs/2026-08-28-fanqie-mail-workspace-design.md`
- Modify: `tests/manifest.test.js`

- [x] 说明早期过渡、固定标签标题、本地 favicon 来源、已知 CSP/浏览器限制及 M4 边界。
- [x] 运行全量 npm test、全部 src JS 语法检查、Manifest/权限检查和网络/正文复制/运行时外链/宽泛 CSS 扫描。
- [x] 记录本地测试不等于真实网页通过，并给出用户手动重载与 Browser/Chrome 验收清单。

### Task 6：最终交接

- [x] 汇报每个 RED→GREEN 证据、变更文件、测试和扫描精确计数。
- [x] 明确未覆盖的 Chrome/Edge 实机边界，不宣称零闪烁或 M3 全部通过。
