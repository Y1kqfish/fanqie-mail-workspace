# 番茄 Mail Outlook 近 1:1 界面重做实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 在不改变番茄原生正文、导航、恢复或目录冻结边界的前提下，把 Outlook 皮肤重建为按 2560px 坐标基线组织的七区桌面工作区。

**Architecture:** 皮肤负责完整的 Outlook 视觉骨架、展示型命令和当前章节单行；controller 仍只接收上一章、下一章、恢复、停用等既有真实回调。原生 .muye-reader-box 继续由现有 reader-transfer 搬入唯一阅读窗格，目录运行时保持 catalogEnabled=false，不恢复目录链路。

**Tech Stack:** Chrome/Edge Manifest V3、经典内容脚本、原生 JavaScript/CSS、Node 内置测试运行器、现有本地 Fluent SVG 图标模块。

**Spec:** docs/superpowers/specs/2026-08-30-fanqie-outlook-m2-design.md 与本次用户授权的 M2 近 1:1 坐标和交互约束。

## Global Constraints

- 只修改 D:\番茄，项目无 Git worktree；不提交 commit，不覆盖无关用户文件。
- 目录按钮、目录数量、目录筛选、目录搜索保持隐藏，catalogEnabled 默认必须为 false；不修改 adapter、catalog-controller、waiter、parser。
- 仅匹配 https://fanqienovel.com/reader/*，Manifest 权限仍只有 storage，无 host_permissions。
- 不使用 fetch、XMLHttpRequest、WebSocket、隐藏接口、CDN、运行时依赖或网络请求。
- 不提取、复制、缓存正文；继续使用同一个原生 .muye-reader-box 与动态 WebFont。
- 继续保留上下章、进度、Alt+Shift+M、停用和恢复 fallback。
- 展示型控件只显示短暂“此控件仅作界面展示”提示，不调用 controller、不导航、不写 storage、不触发目录/恢复。
- 所有新 CSS 选择器必须以 fqmail- 为边界，不使用全局 button/input/p/h1/body/html 选择器。
- 真实浏览器不在实现阶段操作；自动测试不能替代 Chrome/Edge 实机验收。

---

### Task 1: 建立近 1:1 七区结构与展示行为 RED

**Files:**
- Modify: tests/skin.test.js
- Create: tests/outlook-m2-1to1.test.js
- Modify: src/skins/outlook/index.js

**Interfaces:**
- 保持 Fqmail.outlook.create({documentLike, onToggle, onRestore, onPrev, onNext, onChapterSelect})。
- refs 至少提供 topbar, searchBox, appRail, ribbon, folderPane, messageListPane, readerPane, utilityRail, prevButton, nextButton, restoreButton, toggleButton, status。
- 增加 skin.showPresentationNotice(message)，展示型点击只更新可见提示并在短时间后恢复原状态。

- [ ] Step 1: 写 RED 测试。创建皮肤后断言顶栏、应用轨、功能区、文件夹树、邮件列表、阅读窗格、右侧工具轨均各一份；命令栏只有上一封、下一封、恢复番茄、停用皮肤、状态；目录按钮、槽、计数不出现。断言真实 snapshot 只产生一个带真实 data-chapter-id 的选中邮件行，第二次 snapshot 替换旧行而不累积。创建展示按钮并真实点击，断言提示出现、原按钮状态恢复、controller 回调计数仍为 0；聚焦/输入禁用搜索只触发展示提示，不搜索正文。
- [ ] Step 2: 运行 RED：node --test tests/skin.test.js tests/outlook-m2-1to1.test.js。确认旧皮肤因缺少七区 refs、邮件行和展示提示而失败。
- [ ] Step 3: 最小 GREEN。重建 index.js 的 DOM 层级：section.fqmail-shell > header.fqmail-topbar + div.fqmail-workspace > nav.fqmail-app-rail + section.fqmail-main-surface > section.fqmail-ribbon + div.fqmail-content-grid > nav.fqmail-folder-pane + section.fqmail-message-list-pane + main.fqmail-reader-pane + aside.fqmail-utility-rail。使用已有 Fqmail.fluentIcons.create 生成 SVG，不使用 innerHTML。搜索框设置 disabled、aria-disabled=true、tabIndex=-1。展示型按钮使用 aria-disabled=true，监听器只调用 showPresentationNotice。renderSnapshot 清空并重建一条当前邮件行，使用真实 bookTitle/chapterTitle/chapterId/previousButton/nextButton，绝不生成目录或伪造章节。
- [ ] Step 4: 聚焦回归：再次运行上述测试，确认结构、快照单行、提示无副作用和既有上下章/恢复回调均通过。

### Task 2: 实现顶栏、应用轨、文件夹树、消息列表和阅读邮件头

**Files:**
- Modify: tests/outlook-m2-1to1.test.js
- Modify: src/skins/outlook/index.js

**Interfaces:**
- renderSnapshot 只更新当前邮件和阅读标题，不创建第二份正文。
- renderMessage(message) 与 setStatus(state, message) 保留现有接口。

- [ ] Step 1: 写 RED 语义与副作用测试。断言顶栏存在启动器、品牌、搜索框、设置、帮助、通知和本地账户占位；应用轨存在 Mail、日历、联系人、待办等带 tooltip 的非按钮标记，Mail 为选中态。断言文件夹树包含收藏夹、收件箱、草稿、已发送、已删除；点击展示项不触发 controller 回调。断言消息列表标题、筛选、排序为展示元素，只有一条真实当前邮件。断言阅读窗格包含邮件标题、发件人视觉行和消息命令条；.muye-reader-box 仍只能由 transfer 负责插入，skin 不复制正文。
- [ ] Step 2: 运行 RED：node --test tests/outlook-m2-1to1.test.js。确认旧实现缺少这些区域和节点语义。
- [ ] Step 3: 最小 GREEN。补齐语义节点、Fluent SVG 和 tooltip 属性；展示项不传入 controller，不读账户、邮箱或正文。消息命令条使用展示按钮，真实导航按钮仍只保留既有四个 controller 回调。
- [ ] Step 4: 聚焦回归：node --test tests/outlook-m2-1to1.test.js tests/skin.test.js tests/controller.test.js。

### Task 3: 加入精确坐标契约与响应式 RED/GREEN

**Files:**
- Modify: tests/catalog-style.test.js
- Create: tests/outlook-m2-1to1-css.test.js
- Modify: src/skins/outlook/styles.css

**Interfaces:**
- 2560px 坐标基线：顶栏 48px；启动器 x0/w48；品牌 x48/w216；搜索 x264/y8/w350/h32；应用轨 x4/y48、w40；功能区 x49/y48/h77；内容 y125；导航外框 x50/w214、内部树 x58/w188；消息列表 x262/y133/w351；阅读窗格 x617；右侧 utility 区保留 305px。
- 响应式：>=1920 保留 305px；1280–1919 右侧收为 48px；960–1279 隐藏右侧并使用 160px 导航；720–959 隐藏应用轨和文件夹树；<720 列表/正文纵向。

- [ ] Step 1: 写 RED CSS 合同测试。从 CSS 读取规则并断言目标类的尺寸、位置、层级、阴影、颜色和媒体断点；拒绝旧的简单 40px/188px/351px/剩余宽度直拼规则、目录 CSS 与宽泛选择器。
- [ ] Step 2: 运行 RED：node --test tests/outlook-m2-1to1-css.test.js tests/catalog-style.test.js。确认旧 CSS 不能满足坐标和右侧 305px 契约。
- [ ] Step 3: 最小 GREEN。重写皮肤 CSS 的坐标系、浮层偏移、列表外框、邮件头、右侧空态卡片和命令状态；所有规则使用 fqmail- 前缀。保留 reader pane 滚动和原生 .muye-reader-box 样式边界。加入 max-width:1919px、1279px、959px、719px 响应式规则，确保窄屏恢复按钮和状态栏仍可见。
- [ ] Step 4: 聚焦回归：node --test tests/outlook-m2-1to1-css.test.js tests/catalog-style.test.js tests/skin.test.js。

### Task 4: 图标、许可和 Manifest 顺序回归

**Files:**
- Modify: src/skins/outlook/fluent-icons.js
- Modify: tests/fluent-icons.test.js
- Modify: manifest.json
- Modify: tests/manifest.test.js
- Modify: tests/content-script-scope.test.js
- Modify: third_party/fluentui-system-icons/NOTICE.md only if the pinned SHA/asset list needs correction

**Interfaces:**
- 继续使用固定提交 4d685f77b2cb8f3f412a74ec8d920c8c91149528 的本地 SVG path；不引入 CDN、网络或依赖。
- 图标 API 继续为 Fqmail.fluentIcons.create(documentLike, name, options?)。

- [ ] Step 1: 写 RED 图标使用测试。断言新增顶栏、应用轨和命令按钮中的 SVG 全部来自 fluentIcons.create、使用 SVG namespace、currentColor、可访问属性且不含 innerHTML；未知图标失败关闭。断言 Manifest 中图标模块位于 skin 之前。
- [ ] Step 2: 运行 RED：node --test tests/fluent-icons.test.js tests/manifest.test.js tests/content-script-scope.test.js。
- [ ] Step 3: 最小 GREEN。只补齐皮肤实际需要的现有锁定图标映射和 Manifest 顺序；不恢复目录 UI，不新增权限。
- [ ] Step 4: 聚焦回归：node --test tests/fluent-icons.test.js tests/manifest.test.js tests/content-script-scope.test.js tests/outlook-m2-1to1.test.js。

### Task 5: 文档、范围核对与完整验证

**Files:**
- Modify: README.md
- Modify: docs/product/fanqie-mail-prd.md
- Verify: all src/**/*.js, manifest.json, tests, third_party/fluentui-system-icons/NOTICE.md

- [ ] Step 1: 更新文档。记录近 1:1 七区坐标、响应式断点、展示型控件语义、当前章节单行、目录冻结、Fluent 固定 SHA/许可和真实验收顺序；不宣称真实网页通过。
- [ ] Step 2: 完整自动验证：npm test，记录精确通过/失败/取消数量。
- [ ] Step 3: 源脚本语法：对所有 src/**/*.js 执行 node --check 并记录文件数。
- [ ] Step 4: Manifest 与静态安全扫描：确认 MV3、仅 storage、精确 reader 匹配、无 host_permissions；扫描无网络 API、正文 text 提取/复制/缓存、innerHTML、DOM clone、目录 UI runtime 恢复和宽泛 CSS。
- [ ] Step 5: 变更审计。项目无 Git 时用本轮修改清单和 rg 审计确认只触碰皮肤、测试、Manifest 顺序、计划和文档；明确未修改 src/adapters/fanqie/**、src/core/catalog-controller.js、src/core/reader-transfer.js 与目录 waiter/parser。
- [ ] Step 6: 手工交接。完成本地验证后报告“可重新加载扩展复验”。用户手动重载 D:\番茄 后，使用 Browser/Chrome 在同一真实阅读页先验收 2560px 框架：七区单实例、顶栏坐标、右侧 305px、当前邮件单行、原生正文单份、上下章与恢复。任一失败立即停止，不擅自继续修改。
