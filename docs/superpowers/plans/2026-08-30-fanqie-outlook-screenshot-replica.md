# 番茄 Mail Outlook 截图级复刻 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将番茄阅读皮肤从“Outlook 风格”重做为以 2560×1305 Outlook Web 截图和真实页面实测坐标为基线的截图级复刻，同时保留唯一原生正文节点、上下章、恢复与快捷键。

**Architecture:** 保持 `Fqmail.outlook.create()` 与主控制器的现有边界，把本地 Fluent SVG 注册、无业务 UI 组件、页面组合和 CSS 几何拆成独立文件。所有邮箱命令默认是皮肤内部展示交互；只有邮件列表导航按钮和 More 菜单中的恢复/停用继续调用既有真实回调。目录运行时维持关闭，适配器、目录控制器和目录等待器不参与本轮改动。

**Tech Stack:** Chrome/Edge Manifest V3、无构建步骤的原生 JavaScript IIFE、原生 DOM/CSS、Node.js `node:test`、本地 Microsoft Fluent UI System Icons SVG path。

**Spec:** `docs/superpowers/specs/2026-08-30-fanqie-outlook-screenshot-replica-design.md`

## Global Constraints

- 实施根目录固定为 `D:\番茄`；该目录当前不是 Git 仓库，不初始化 Git、不伪造 commit。每个任务以聚焦测试通过和变更清单作为检查点。
- 永久不使用 Computer Use；真实页面验收只使用 Browser/Chrome 插件，未打包扩展重载由用户执行。
- Manifest 继续只声明 `permissions: ["storage"]`，匹配只允许 `https://fanqienovel.com/reader/*`，不得新增 `host_permissions`。
- 不连接真实邮箱，不读取或保存 Outlook 邮件、账户、Cookie、浏览历史或页面内部 SVG/path。
- 不调用番茄隐藏接口，不复制、提取或持久化正文；`.muye-reader-box` 始终是同一个唯一节点。
- 不增加运行时依赖、CDN、字体图标、远程图片或网络请求。
- Fluent 图标固定使用批准提交 `4d685f77b2cb8f3f412a74ec8d920c8c91149528`，保留 `third_party/fluentui-system-icons/LICENSE` 与来源说明。
- 目录功能维持冻结：界面不得出现目录按钮、目录数量、章节筛选或目录搜索；controller 的 `catalogEnabled` 默认值不得改为 `true`。
- 2560×1305 桌面基线中主要区域坐标和尺寸误差不超过 ±2px，图标尺寸及中心点误差不超过 ±1px。
- 所有新增 CSS 选择器使用 `fqmail-` 前缀，不使用 `innerHTML`，不增加 `body`、`html`、裸 `button/input/p/h1/h2/h3` 等宽泛规则。

---

## File Structure

- Create `src/skins/outlook/components.js`: 只负责无业务 DOM 组件，包括图标按钮、分裂按钮、标签、文件夹行、邮件行、菜单和底部任务标签。
- Modify `src/skins/outlook/fluent-icons.js`: 扩充语义图标注册表、regular/filled 变体和上游来源元数据。
- Modify `src/skins/outlook/index.js`: 只组合 Outlook 页面、维护展示提示与 More 菜单，并把四个既有真实回调接到指定位置。
- Modify `src/skins/outlook/styles.css`: 作为唯一视觉和响应式来源，落实实测坐标、尺寸、阴影、焦点与菜单状态。
- Modify `src/skins/outlook/tokens.js`: 补齐实测颜色、尺寸、阴影和层级 token，避免组件散落魔法值。
- Modify `manifest.json`: 在图标和皮肤组合脚本之间加载 `components.js`。
- Modify `tests/helpers/fake-dom.js`: 只补本轮组件测试需要的焦点、事件、`contains`、`closest` 和 style 能力。
- Create `tests/outlook-components.test.js`: 验证组件语义、分裂按钮、菜单和零副作用边界。
- Create `tests/outlook-screenshot-structure.test.js`: 验证八区单实例、DOM 顺序、命令清单和真实回调位置。
- Create `tests/outlook-screenshot-css.test.js`: 验证 2560 基线、断点、阴影、图标尺寸和前缀安全。
- Modify `tests/fluent-icons.test.js`, `tests/skin.test.js`, `tests/outlook-layout.test.js`, `tests/outlook-m2-1to1.test.js`, `tests/outlook-m2-review-fixes.test.js`, `tests/outlook-responsive.test.js`, `tests/manifest.test.js`, `tests/content-script-scope.test.js`: 将旧 M2 断言迁移到截图级结构并保留安全回归。
- Modify `README.md`, `NOTICE.md`: 更新当前状态、操作入口、实机验收清单和新增图标来源记录。

---

### Task 1: 建立可复用 Outlook 组件边界

**Files:**
- Create: `src/skins/outlook/components.js`
- Create: `tests/outlook-components.test.js`
- Modify: `tests/helpers/fake-dom.js`
- Modify: `manifest.json`
- Modify: `tests/manifest.test.js`
- Modify: `tests/content-script-scope.test.js`

**Interfaces:**
- Consumes: `Fqmail.fluentIcons.create(documentLike, name, options)`。
- Produces: `Fqmail.outlookComponents`，包含 `makeNode`、`addIcon`、`createIconButton`、`createSplitCommand`、`createFolderRow`、`createMessageRow`、`createMenu`、`createTaskTab`。

- [ ] **Step 1: 写组件模块加载顺序 RED 测试**

在 `tests/manifest.test.js` 增加：

```js
assert.ok(scripts.indexOf("src/skins/outlook/fluent-icons.js") < scripts.indexOf("src/skins/outlook/components.js"));
assert.ok(scripts.indexOf("src/skins/outlook/components.js") < scripts.indexOf("src/skins/outlook/index.js"));
```

在 `tests/content-script-scope.test.js` 增加：

```js
assert.equal(typeof context.Fqmail.outlookComponents.createIconButton, "function");
assert.equal(typeof context.Fqmail.outlookComponents.createSplitCommand, "function");
assert.equal(typeof context.Fqmail.outlookComponents.createMenu, "function");
```

- [ ] **Step 2: 运行 RED 测试**

Run: `node --test tests/manifest.test.js tests/content-script-scope.test.js`

Expected: FAIL，原因是 `components.js` 尚未位于 Manifest，且 `Fqmail.outlookComponents` 未定义。

- [ ] **Step 3: 写组件行为 RED 测试**

在 `tests/outlook-components.test.js` 明确断言：

```js
test("split command separates main and dropdown events", () => {
  const events = [];
  const command = components.createSplitCommand(documentLike, {
    label: "新邮件",
    icon: "compose",
    className: "fqmail-command fqmail-command--compose",
    onMain: () => events.push("main"),
    onDropdown: () => events.push("dropdown"),
  });
  command.mainButton.click();
  command.dropdownButton.click();
  assert.deepEqual(events, ["main", "dropdown"]);
  assert.equal(command.root.querySelectorAll(".fqmail-command-main").length, 1);
  assert.equal(command.root.querySelectorAll(".fqmail-command-dropdown").length, 1);
});

test("disabled icon button has native disabled semantics", () => {
  const button = components.createIconButton(documentLike, {
    label: "撤消",
    icon: "undo",
    disabled: true,
  });
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute("aria-label"), "撤消");
});
```

同时扩展 `tests/helpers/fake-dom.js`：`focus()` 更新 `documentLike.activeElement`，事件对象支持 `preventDefault`/`stopPropagation`，节点支持 `contains()`、`closest()`、`style.setProperty()`/`removeProperty()`，但不要引入浏览器库依赖。

- [ ] **Step 4: 运行组件 RED 测试**

Run: `node --test tests/outlook-components.test.js`

Expected: FAIL，原因是组件工厂尚不存在。

- [ ] **Step 5: 实现最小组件模块并注册加载顺序**

`components.js` 使用普通 content script IIFE，导出固定签名：

```js
(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  function createIconButton(documentLike, {
    label,
    icon,
    className = "",
    onClick = () => {},
    disabled = false,
    iconSize = 20,
  }) {
    const button = documentLike.createElement("button");
    button.type = "button";
    button.className = `fqmail-icon-button ${className}`.trim();
    button.disabled = Boolean(disabled);
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.append(globalThis.Fqmail.fluentIcons.create(documentLike, icon, {size: iconSize}));
    button.addEventListener("click", (event) => {
      if (!button.disabled) onClick(event);
    });
    return button;
  }

  function createSplitCommand(documentLike, options) {
    const root = documentLike.createElement("div");
    root.className = options.className;
    const mainButton = createIconButton(documentLike, {
      label: options.label,
      icon: options.icon,
      className: "fqmail-command-main",
      onClick: options.onMain,
    });
    const label = documentLike.createElement("span");
    label.className = "fqmail-command-label";
    label.textContent = options.label;
    mainButton.append(label);
    const dropdownButton = createIconButton(documentLike, {
      label: `${options.label}选项`,
      icon: "chevronDown",
      iconSize: 12,
      className: "fqmail-command-dropdown",
      onClick: options.onDropdown,
    });
    root.append(mainButton, dropdownButton);
    return {root, mainButton, dropdownButton};
  }

  globalThis.Fqmail.outlookComponents = {
    makeNode,
    addIcon,
    createIconButton,
    createSplitCommand,
    createFolderRow,
    createMessageRow,
    createMenu,
    createTaskTab,
  };
})();
```

其余导出函数采用以下精确契约，不得包含 controller、storage、目录或 URL 逻辑：

| Function | Input | Return |
| --- | --- | --- |
| `makeNode` | `(documentLike, tagName, className, text = "")` | 创建并返回一个节点；只有 `text` 非空时设置 `textContent` |
| `addIcon` | `(documentLike, parent, name, {size = 20, variant = "regular"} = {})` | 创建 SVG、追加到 parent，并返回 SVG |
| `createFolderRow` | `(documentLike, {label, icon, selected = false, onClick = () => {}})` | `{root, labelNode}`；root 是 button，selected 同步 `aria-current` |
| `createMessageRow` | `(documentLike, {chapterId, sender, subject, preview, selected})` | `{root, checkbox, avatar, senderNode, subjectNode, previewNode, timeNode}` |
| `createMenu` | `(documentLike, {label, items})`，其中 item 为 `{id, label, icon, onClick}` | `{root, itemButtons}`；root 使用 `role="menu"`，按钮使用 `role="menuitem"` |
| `createTaskTab` | `(documentLike, {label, selected, showEdit, showClose, onEdit, onClose})` | `{root, labelNode, editButton, closeButton}`；未请求的 edit/close 为 `null` |

把 `src/skins/outlook/components.js` 加入 Manifest，位置严格在 `fluent-icons.js`、`tokens.js` 之后和 `index.js` 之前。

- [ ] **Step 6: 运行聚焦测试并记录检查点**

Run: `node --test tests/outlook-components.test.js tests/manifest.test.js tests/content-script-scope.test.js`

Expected: 全部 PASS；检查变更仅包含组件模块、测试帮助器和脚本加载顺序。

---

### Task 2: 扩充固定来源 Fluent 语义图标注册表

**Files:**
- Modify: `src/skins/outlook/fluent-icons.js`
- Modify: `tests/fluent-icons.test.js`
- Modify: `third_party/fluentui-system-icons/NOTICE.md`
- Modify: `NOTICE.md`

**Interfaces:**
- Consumes: `documentLike.createElementNS()`。
- Produces: `Fqmail.fluentIcons.create(documentLike, name, {size, title, variant})`、`Fqmail.fluentIcons.has(name)`、`Fqmail.fluentIcons.names()`、`Fqmail.fluentIcons.sources()`。

- [ ] **Step 1: 写图标覆盖和来源 RED 测试**

在 `tests/fluent-icons.test.js` 定义完整语义清单：

```js
const requiredIcons = [
  "launcher", "search", "feedback", "premium", "notification", "settings",
  "navigation", "mail", "calendar", "people", "task", "moreApps",
  "compose", "chevronDown", "delete", "archive", "shieldError", "folderMove",
  "reply", "replyAll", "forward", "mailRead", "flag", "appFolder", "community",
  "undo", "more", "chevronRight", "inbox", "send", "draft", "junk", "note",
  "checkbox", "sort", "pin", "close", "edit", "selectAll", "filter", "outlookLogo",
];
assert.ok(requiredIcons.length >= 35);
for (const name of requiredIcons) assert.equal(icons.has(name), true, name);
assert.deepEqual(icons.names().sort(), [...new Set(icons.names())].sort());
for (const source of icons.sources()) {
  assert.equal(source.commit, "4d685f77b2cb8f3f412a74ec8d920c8c91149528");
  assert.match(source.file, /^assets\/ic_fluent_[a-z0-9_]+\.svg$/);
}
```

再创建每个图标，断言 `data-fqmail-icon-name` 精确等于语义名称、`data-fqmail-icon-variant` 是 `regular` 或 `filled`，并断言命令区的 `compose/delete/archive/shieldError/folderMove/replyAll/mailRead/flag/appFolder/community/undo/more` 名称互不相同。

- [ ] **Step 2: 运行图标 RED 测试**

Run: `node --test tests/fluent-icons.test.js`

Expected: FAIL，至少因图标数量不足、`has/names/sources` 未实现。

- [ ] **Step 3: 从锁定提交导入本地 SVG path 与元数据**

只允许从官方仓库锁定提交对应的下列文件读取 `<path d>`，不得从 Outlook 页复制：

```js
const SOURCE_COMMIT = "4d685f77b2cb8f3f412a74ec8d920c8c91149528";
const ICON_SOURCES = {
  launcher: "assets/ic_fluent_waffle_20_regular.svg",
  search: "assets/ic_fluent_search_20_regular.svg",
  feedback: "assets/ic_fluent_person_feedback_20_regular.svg",
  premium: "assets/ic_fluent_diamond_20_regular.svg",
  notification: "assets/ic_fluent_alert_20_regular.svg",
  settings: "assets/ic_fluent_settings_20_regular.svg",
  navigation: "assets/ic_fluent_navigation_20_regular.svg",
  mail: "assets/ic_fluent_mail_20_regular.svg",
  calendar: "assets/ic_fluent_calendar_20_regular.svg",
  people: "assets/ic_fluent_people_20_regular.svg",
  task: "assets/ic_fluent_clipboard_task_20_regular.svg",
  moreApps: "assets/ic_fluent_grid_20_regular.svg",
  compose: "assets/ic_fluent_compose_20_regular.svg",
  chevronDown: "assets/ic_fluent_chevron_down_12_regular.svg",
  delete: "assets/ic_fluent_delete_20_regular.svg",
  archive: "assets/ic_fluent_archive_20_regular.svg",
  shieldError: "assets/ic_fluent_shield_error_20_regular.svg",
  folderMove: "assets/ic_fluent_folder_arrow_right_20_regular.svg",
  reply: "assets/ic_fluent_arrow_reply_20_regular.svg",
  replyAll: "assets/ic_fluent_arrow_reply_all_20_regular.svg",
  forward: "assets/ic_fluent_arrow_forward_20_regular.svg",
  mailRead: "assets/ic_fluent_mail_read_20_regular.svg",
  flag: "assets/ic_fluent_flag_20_regular.svg",
  appFolder: "assets/ic_fluent_app_folder_20_regular.svg",
  community: "assets/ic_fluent_people_community_20_regular.svg",
  undo: "assets/ic_fluent_arrow_undo_20_regular.svg",
  more: "assets/ic_fluent_more_horizontal_20_regular.svg",
};
```

对剩余 folder/list/task 图标按同一规则登记精确官方文件名；若锁定提交不存在某个文件，改用同一提交中语义最接近且实际存在的 Fluent 文件，并在 `NOTICE.md` 逐项记录“语义键 → 上游文件”，不得复用不相干图标蒙混测试。`outlookLogo` 仅使用仓库中已许可且锁定来源的官方 Outlook 标志资产；若锁定提交没有该资产，则用 `appFolder` 的官方 Fluent 图标并把 UI 文案保留为 Outlook，不能手绘商标。

- [ ] **Step 4: 实现注册表 API 和 regular/filled 变体**

`create()` 应设置：

```js
svg.setAttribute("data-fqmail-icon-name", name);
svg.setAttribute("data-fqmail-icon-variant", resolvedVariant);
svg.setAttribute("viewBox", icon.viewBox);
svg.setAttribute("width", String(size));
svg.setAttribute("height", String(size));
path.setAttribute("d", icon.paths[resolvedVariant] || icon.paths.regular);
path.setAttribute("fill", "currentColor");
```

`names()` 返回新数组，`sources()` 返回 `{name, file, commit}` 新对象数组，避免调用者修改注册表。

- [ ] **Step 5: 运行图标测试和静态网络扫描**

Run: `node --test tests/fluent-icons.test.js`

Run: `rg -n "https?://|fetch\(|XMLHttpRequest|WebSocket|data:image" src/skins/outlook`

Expected: 测试 PASS；扫描不得在运行时代码中发现远程加载或 base64 图标。来源 URL 只允许出现在 NOTICE/文档。

---

### Task 3: 重建顶栏、应用轨与双层功能区

**Files:**
- Modify: `src/skins/outlook/index.js`
- Create: `tests/outlook-screenshot-structure.test.js`
- Modify: `tests/skin.test.js`
- Modify: `tests/outlook-m2-1to1.test.js`

**Interfaces:**
- Consumes: `Fqmail.outlookComponents` 和 `Fqmail.fluentIcons`。
- Produces refs: `topbar`, `searchBox`, `appRail`, `ribbon`, `commandBar`, `status`；保持 `Fqmail.outlook.create(options)` 调用签名。

- [ ] **Step 1: 写八区顺序和顶栏 RED 测试**

断言根节点直接或规定容器内只有以下单实例，并按顺序出现：

```js
const orderedClasses = [
  "fqmail-topbar",
  "fqmail-app-rail",
  "fqmail-ribbon",
  "fqmail-folder-pane",
  "fqmail-message-list-pane",
  "fqmail-reader-pane",
  "fqmail-ad-rail",
  "fqmail-taskbar",
];
for (const className of orderedClasses) {
  assert.equal(skin.root.querySelectorAll(`.${className}`).length, 1, className);
}
```

顶栏精确断言 launcher、Outlook 品牌、只读搜索框、反馈、Microsoft 365、通知、设置、本地头像各一份；所有右侧展示按钮点击后不得触发 `onPrev/onNext/onRestore/onToggle`。

- [ ] **Step 2: 写功能区命令 RED 测试**

定义固定命令表并逐项检查 DOM：

```js
const commands = [
  ["compose", "新邮件", true],
  ["delete", "删除", true],
  ["archive", "存档", false],
  ["shieldError", "报告", true],
  ["folderMove", "移至", false],
  ["replyAll", "全部答复", true],
  ["mailRead", "已读/未读", false],
  ["flag", "标记/取消标记", true],
  ["appFolder", "应用", false],
  ["community", "发现组", false],
  ["undo", "撤消", false],
  ["more", "更多", false],
];
```

断言“文件 / 主页 / 查看 / 帮助”都存在，主页为唯一选中标签；12 项命令顺序一致；split 项各有主段和下拉段；撤消为原生 disabled；功能区不含“上一封 / 下一封 / 恢复番茄 / 停用皮肤 / 目录”。

- [ ] **Step 3: 运行结构 RED 测试**

Run: `node --test tests/outlook-screenshot-structure.test.js tests/skin.test.js tests/outlook-m2-1to1.test.js`

Expected: FAIL，原因包括缺少反馈/M365、命令不全、真实操作仍位于旧 command bar。

- [ ] **Step 4: 重写顶栏和应用轨组合**

顶栏 DOM 固定为：

```text
.fqmail-topbar
  .fqmail-launcher
  .fqmail-brand
  .fqmail-search-shell > Search icon + input
  .fqmail-topbar-spacer
  .fqmail-topbar-actions
    feedback / Microsoft 365 / notification / settings / local avatar
```

应用轨顺序固定为邮件、日历、人员、待办、Office 装饰入口、更多应用；邮件用 filled/selected 状态，其余按钮调用皮肤内部 `showPresentationNotice()`，不把展示回调交给 controller。

- [ ] **Step 5: 重写双层功能区**

第一行创建导航按钮、文件按钮和四个标签；第二行按命令表用 `createIconButton` 或 `createSplitCommand` 创建。每个展示命令的主段和下拉段都只调用：

```js
() => showPresentationNotice("此控件仅作界面展示")
```

撤消传入 `disabled: true`。状态节点保留在命令容器右侧但使用 visually unobtrusive 样式，不挤压已实测命令宽度。

- [ ] **Step 6: 运行聚焦测试并记录检查点**

Run: `node --test tests/outlook-screenshot-structure.test.js tests/skin.test.js tests/outlook-m2-1to1.test.js`

Expected: 顶栏、应用轨、标签和完整命令清单 PASS；真实回调事件数组仍为空。

---

### Task 4: 重建文件夹树、单邮件列表与章节导航

**Files:**
- Modify: `src/skins/outlook/index.js`
- Modify: `src/skins/outlook/components.js`
- Modify: `tests/outlook-components.test.js`
- Modify: `tests/outlook-screenshot-structure.test.js`
- Modify: `tests/skin.test.js`

**Interfaces:**
- Consumes callbacks: `onPrev()`, `onNext()`。
- Produces refs: `folderPane`, `messageListPane`, `messageList`, `prevButton`, `nextButton`；`skin.focusCurrentMessage()`。

- [ ] **Step 1: 写文件夹与邮件列表 RED 测试**

断言文件夹树包含两个本地组：收藏夹和当前书名；行清单及图标键固定为：

```js
const folderRows = [
  ["收件箱", "inbox"],
  ["已发送邮件", "send"],
  ["草稿", "draft"],
  ["垃圾邮件", "junk"],
  ["已删除邮件", "delete"],
  ["便笺", "note"],
  ["存档", "archive"],
  ["对话历史记录", "folderMove"],
  ["转到组", "community"],
];
```

断言没有截图中的邮箱地址或邮件数量；收件箱为唯一选中行。邮件列表只有一条 `.fqmail-message-row`，`data-chapter-id`、书名、章节标题来自 snapshot，不生成第二章或假邮件。

- [ ] **Step 2: 写上下章真实回调位置 RED 测试**

```js
assert.equal(skin.refs.prevButton.closest(".fqmail-message-list-header") !== null, true);
assert.equal(skin.refs.nextButton.closest(".fqmail-message-list-header") !== null, true);
skin.refs.prevButton.click();
skin.refs.nextButton.click();
assert.deepEqual(events, ["prev", "next"]);
assert.equal(skin.root.querySelectorAll(".fqmail-command-bar .fqmail-real-command").length, 0);
```

并断言 `previousButton` 缺失时上一项为 disabled，`nextButton` 缺失时下一项为 disabled。

- [ ] **Step 3: 运行 RED 测试**

Run: `node --test tests/outlook-components.test.js tests/outlook-screenshot-structure.test.js tests/skin.test.js`

Expected: FAIL，原因是旧文件夹统一信封图标、上一/下一仍在功能区、邮件行结构不足。

- [ ] **Step 4: 实现文件夹和单邮件行组件**

`createFolderRow()` 返回可聚焦 button，接受 `{label, icon, selected, onClick}`；`createMessageRow()` 返回 article，结构固定为 checkbox、头像、发送者、主题、预览状态和时间。`renderSnapshot(snapshot)` 每次先 `replaceChildren()`，再且只再建一条当前邮件：

```js
const currentMessage = components.createMessageRow(documentLike, {
  chapterId: snapshot.chapterId,
  sender: "番茄小说",
  subject: snapshot.chapterTitle || "当前章节",
  preview: snapshot.bookTitle || "当前书籍",
  selected: true,
});
messageList.replaceChildren(currentMessage.root);
```

收件箱点击只调用 `focusCurrentMessage()`，其他文件夹行调用展示提示。

- [ ] **Step 5: 把上下章移到邮件列表标题行**

创建图标按钮 `previousItem`/`nextItem`，分别绑定 `onPrev`/`onNext`，并在 `renderSnapshot()` 中根据 `snapshot.previousButton`、`snapshot.nextButton` 更新原生 `disabled`。不得通过展示按钮间接代理真实回调。

- [ ] **Step 6: 运行聚焦测试并记录检查点**

Run: `node --test tests/outlook-components.test.js tests/outlook-screenshot-structure.test.js tests/skin.test.js`

Expected: 全部 PASS；事件顺序严格是一次 prev、一次 next；邮件行数量恒为 1。

---

### Task 5: 重建阅读邮件卡片、右侧广告区和底部任务栏

**Files:**
- Modify: `src/skins/outlook/index.js`
- Modify: `src/skins/outlook/components.js`
- Modify: `tests/outlook-screenshot-structure.test.js`
- Modify: `tests/outlook-m2-review-fixes.test.js`
- Modify: `tests/reader-transfer.test.js`

**Interfaces:**
- Consumes: snapshot `{bookTitle, chapterId, chapterTitle, previousButton, nextButton}`；reader-transfer 只接收 `skin.refs.readerPane`。
- Produces refs: `readerRegion`, `readerPane`, `utilityRail`（指向 `.fqmail-ad-rail` 以兼容 controller/旧测试）、`taskbar`。

- [ ] **Step 1: 写阅读区结构 RED 测试**

断言 `.fqmail-reader-region` 内依次只有一份主题条和白色邮件卡片；白色卡片内依次为发件人行、消息操作区和 `.fqmail-reader-pane` 正文承载/滚动容器。动作图标固定为 reply/replyAll/forward/appFolder/more。断言旧 `.fqmail-utility-card` 数量为 0，`.fqmail-ad-rail` 为 1，`.fqmail-taskbar` 为 1。

底部任务栏只允许三个视觉标签：收件箱、回复草稿、当前章节；当前章节来自 snapshot，其他标签不能伪造章节 ID。

- [ ] **Step 2: 写原生正文唯一性 RED 回归**

在 `tests/reader-transfer.test.js` 使用新 `readerPane` 结构挂载同一个 box，断言：

```js
assert.equal(box.parentNode, skin.refs.readerPane);
assert.equal(documentLike.querySelectorAll(".muye-reader-box").length, 1);
assert.equal(transfer.scrollElement, skin.refs.readerPane);
assert.equal(transfer.restore(), true);
assert.equal(box.parentNode, originalParent);
```

不要在测试或实现中读取 `box.textContent`。

- [ ] **Step 3: 运行 RED 测试**

Run: `node --test tests/outlook-screenshot-structure.test.js tests/outlook-m2-review-fixes.test.js tests/reader-transfer.test.js`

Expected: FAIL，原因是当前右栏仍为自定义卡片、没有任务栏、阅读区不是白色邮件卡片结构。

- [ ] **Step 4: 实现白色阅读邮件卡片**

建立 `.fqmail-reader-region` 作为网格中的阅读区域：它包含 subject strip 和 `.fqmail-message-card`。卡片头部包含发件人行与消息操作区；卡片剩余区域使用 `.fqmail-reader-pane`，并让 `refs.readerPane` 精确指向这个节点。controller 继续把同一个原生 box 直接搬入 `refs.readerPane`，所以它同时是正文承载和实际滚动容器；不得再加一个要求 reader-transfer 改 API 的正文内层，也不得复制 box。

`renderSnapshot()` 只更新主题、发送者视觉行、邮件行和任务标签文字，不读取正文内容。

- [ ] **Step 5: 实现 305px 本地广告构图和 41px 任务栏**

右栏固定包含 Outlook 标志/通用应用图标、说明文字和“广告”标签；不创建 iframe、图片请求或真实广告链接。任务标签使用 `createTaskTab()`，关闭/编辑按钮都是展示交互，当前章节标签为唯一选中态。

- [ ] **Step 6: 运行聚焦测试并记录检查点**

Run: `node --test tests/outlook-screenshot-structure.test.js tests/outlook-m2-review-fixes.test.js tests/reader-transfer.test.js`

Expected: 全部 PASS；正文节点仍为单实例并可逆恢复。

---

### Task 6: More 菜单承载恢复与停用，展示交互零副作用

**Files:**
- Modify: `src/skins/outlook/index.js`
- Modify: `src/skins/outlook/components.js`
- Modify: `tests/outlook-components.test.js`
- Modify: `tests/skin.test.js`
- Modify: `tests/outlook-m2-review-fixes.test.js`

**Interfaces:**
- Consumes callbacks: `onRestore()`, `onToggle()`。
- Produces refs: `restoreButton`, `toggleButton`, `moreButton`, `moreMenu`, `status`；methods `showPresentationNotice(message)`, `openMoreMenu()`, `closeMoreMenu()`, `focusCurrentMessage()`。

- [ ] **Step 1: 写 More 菜单和真实回调 RED 测试**

```js
skin.openMoreMenu();
assert.equal(skin.refs.moreButton.getAttribute("aria-expanded"), "true");
assert.equal(skin.refs.moreMenu.hidden, false);
assert.equal(skin.refs.restoreButton.closest(".fqmail-more-menu") !== null, true);
assert.equal(skin.refs.toggleButton.closest(".fqmail-more-menu") !== null, true);
skin.refs.restoreButton.click();
skin.refs.toggleButton.click();
assert.deepEqual(events, ["restore", "toggle"]);
```

再断言 Escape 关闭菜单、外部 pointer/click 关闭菜单、关闭后焦点返回 moreButton，重复打开不会增加第二个菜单或第二组监听。

- [ ] **Step 2: 写展示提示恢复 RED 测试**

使用可控计时器：先 `setStatus("ready", "正文已连接")`，点击任一展示按钮后状态为“此控件仅作界面展示”，1200ms 后恢复 `ready/正文已连接`。在提示期间点击真实 next 后，计时器不得把“正在切换章节”覆盖回旧状态。

展示按钮事件数组必须保持：

```js
assert.deepEqual(events, []);
assert.equal(storageWrites, 0);
assert.equal(catalogCalls, 0);
assert.equal(locationChanges, 0);
```

- [ ] **Step 3: 运行 RED 测试**

Run: `node --test tests/outlook-components.test.js tests/skin.test.js tests/outlook-m2-review-fixes.test.js`

Expected: FAIL，原因是 More 菜单 API、焦点返回和状态代际保护尚不存在。

- [ ] **Step 4: 实现菜单生命周期和提示代际保护**

`create()` 内维护 `noticeTimer`、`statusRevision`、`menuOpen`；`setStatus()` 每次真实状态更新先增加 revision。展示提示记录 revision，仅当结束时 revision 未改变才恢复：

```js
function showPresentationNotice(message = "此控件仅作界面展示") {
  const revision = statusRevision;
  const previousState = root.getAttribute("data-fqmail-state") || "ready";
  const previousMessage = status.textContent;
  status.textContent = message;
  clearNoticeTimer();
  noticeTimer = setTimer(() => {
    if (revision !== statusRevision) return;
    root.setAttribute("data-fqmail-state", previousState);
    status.textContent = previousMessage;
  }, 1200);
}
```

More 菜单设置 `aria-haspopup="menu"`、`aria-expanded`，菜单项使用 `role="menuitem"`；`destroy()` 必须清除计时器和 document/window 监听。

- [ ] **Step 5: 运行聚焦测试并记录检查点**

Run: `node --test tests/outlook-components.test.js tests/skin.test.js tests/outlook-m2-review-fixes.test.js`

Expected: 全部 PASS；restore/toggle 各一次，所有展示控件零外部副作用。

---

### Task 7: 落实 2560 截图基线与响应式 CSS

**Files:**
- Modify: `src/skins/outlook/tokens.js`
- Modify: `src/skins/outlook/styles.css`
- Create: `tests/outlook-screenshot-css.test.js`
- Modify: `tests/outlook-layout.test.js`
- Modify: `tests/outlook-m2-1to1-css.test.js`
- Modify: `tests/outlook-responsive.test.js`
- Modify: `tests/outlook-tokens.test.js`
- Modify: `tests/catalog-style.test.js`

**Interfaces:**
- Consumes class contract from Tasks 3–6。
- Produces static CSS geometry and breakpoints; JS token object remains `Fqmail.outlookTokens` and frozen.

- [ ] **Step 1: 写 token 与几何 RED 测试**

Token 断言至少包含：

```js
assert.equal(t.topbarHeight, "48px");
assert.equal(t.appRailWidth, "40px");
assert.equal(t.ribbonHeight, "77px");
assert.equal(t.contentTop, "125px");
assert.equal(t.folderOuterWidth, "214px");
assert.equal(t.messageListWidth, "351px");
assert.equal(t.utilityWidth, "305px");
assert.equal(t.taskbarHeight, "41px");
assert.equal(t.outlookShadow, "rgba(0, 0, 0, .133) 0 1.6px 3.6px, rgba(0, 0, 0, .11) 0 .3px .9px");
```

CSS 静态断言验证：顶栏 48、搜索 x=264/y=8/w=350/h=32、内容 y=125、文件夹 214、列表 351 且 top 8、阅读起点 617、右栏 305、任务栏 41。命令类逐项带宽度 CSS custom property或明确规则，宽度表与 spec 一致。

- [ ] **Step 2: 写响应式和安全 RED 测试**

断点必须精确出现：

```css
@media (max-width: 1919px)
@media (max-width: 1279px)
@media (max-width: 959px)
@media (max-width: 719px)
```

并断言 1280–1919 右栏为 48px 工具轨；960–1279 隐藏右栏、文件夹 160px、列表约 300px；720–959 隐藏应用轨和文件夹；<720 切换列表/正文纵向结构。继续断言无目录 CSS、无宽泛选择器、无 `display: contents` 破坏交互命中。

- [ ] **Step 3: 运行 CSS RED 测试**

Run: `node --test tests/outlook-screenshot-css.test.js tests/outlook-layout.test.js tests/outlook-m2-1to1-css.test.js tests/outlook-responsive.test.js tests/outlook-tokens.test.js tests/catalog-style.test.js`

Expected: FAIL，原因是旧样式仍为五区简化布局且右栏/任务栏/功能区几何不符。

- [ ] **Step 4: 重写桌面基线 CSS**

根采用固定视口覆盖但不改变页面滚动：

```css
.fqmail-shell {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: grid;
  grid-template-columns: 49px 214px 354px minmax(0, 1fr) 305px;
  grid-template-rows: 48px 77px minmax(0, 1fr);
  color: #242424;
  background: #f5f5f5;
  font: 14px/1.4 "Segoe UI", "Microsoft YaHei UI", sans-serif;
}
```

通过 grid-area 和内部 8px/4px 浮层偏移得到 x=50/262/617；阅读区底部预留 41px。邮件列表使用 spec 中实测双阴影。所有图标按钮建立 32×32 命中区、20px 图标和 `:hover/:active/:focus-visible/:disabled` 状态；分裂按钮共享外边框但主段与下拉段独立 hover。

- [ ] **Step 5: 实现阅读正文作用域和响应式规则**

仅在 `.fqmail-shell .muye-reader-box` 内隐藏重复章节标题/元数据的已验证选择器；禁止隐藏正文内容容器。保留动态字体继承，不能给正文段落强制 `font-family`。按四个断点只改变分区宽度/可见性和布局方向，不创建第二正文节点。

- [ ] **Step 6: 运行 CSS 聚焦测试并记录检查点**

Run: `node --test tests/outlook-screenshot-css.test.js tests/outlook-layout.test.js tests/outlook-m2-1to1-css.test.js tests/outlook-responsive.test.js tests/outlook-tokens.test.js tests/catalog-style.test.js`

Expected: 全部 PASS；2560 基线值和四个断点均可由测试定位到明确规则。

---

### Task 8: Controller 集成回归、目录冻结和安全门槛

**Files:**
- Modify: `tests/controller.test.js`
- Modify: `tests/controller-reliability.test.js`
- Modify: `tests/controller-catalog-default.test.js`
- Modify: `tests/content-script-scope.test.js`
- Modify: `tests/manifest.test.js`
- Modify: `src/core/controller.js` only if an existing skin-ref assumption prevents the new DOM contract; otherwise leave unchanged.

**Interfaces:**
- Consumes: unchanged `Fqmail.outlook.create({onToggle,onRestore,onPrev,onNext,onChapterSelect})` and refs `readerPane/status/prevButton/nextButton/restoreButton/toggleButton`。
- Produces: no new controller API.

- [ ] **Step 1: 写真实回调与单外壳 RED 回归**

用完整新 skin 夹具启动 controller，断言：

```js
assert.equal(documentLike.querySelectorAll(".fqmail-shell").length, 1);
assert.equal(documentLike.querySelectorAll(".muye-reader-box").length, 1);
skin.refs.nextButton.click();
assert.equal(nativeNextClicks, 1);
skin.refs.prevButton.click();
assert.equal(nativePrevClicks, 1);
```

SPA snapshot 更新后仍只有一个 shell、一个邮件行、一个 box；进度监听仍绑定 `refs.readerPane`。

- [ ] **Step 2: 写目录冻结和安全 RED 回归**

断言 controller 默认不调用 `nativeCatalogDock.mount`/`catalogFactory.create`，根节点不存在 `/目录|章节筛选|目录已加载/` UI 文案；Manifest 权限和 matches 精确不变；classic content scripts 全部可在同一 VM 作用域执行。

- [ ] **Step 3: 运行集成 RED 测试**

Run: `node --test tests/controller.test.js tests/controller-reliability.test.js tests/controller-catalog-default.test.js tests/content-script-scope.test.js tests/manifest.test.js`

Expected: 若新 skin 已完全兼容则直接 PASS；若失败，只允许修复 ref/生命周期兼容，不改目录、适配器、网络或存储设计。

- [ ] **Step 4: 做最小 controller 兼容修改（仅在 Step 3 失败时）**

允许的修改仅为读取仍存在的 `skin.refs.readerPane/status` 或在 destroy 时消费新 skin 的清理；不允许增加 Outlook 展示按钮回调、恢复目录、改变 `catalogEnabled = false`、改动 `proxyNative()` 原生按钮代理或正文传输协议。

- [ ] **Step 5: 运行集成测试和静态扫描**

Run: `node --test tests/controller.test.js tests/controller-reliability.test.js tests/controller-catalog-default.test.js tests/content-script-scope.test.js tests/manifest.test.js`

Run: `rg -n "fetch\(|XMLHttpRequest|WebSocket|host_permissions|innerHTML|textContent.*muye-reader|cloneNode\(" src manifest.json`

Expected: 测试全部 PASS；扫描无网络、正文复制、`innerHTML` 或新增权限。正常 UI 文案设置用 `textContent` 可以存在，但不得从 `.muye-reader-box` 读取后再写入皮肤。

---

### Task 9: 文档、全量验证与真实浏览器三关交接

**Files:**
- Modify: `README.md`
- Modify: `NOTICE.md`
- Verify: all `src/**/*.js`, `tests/**/*.test.js`, `manifest.json`

**Interfaces:**
- Consumes: Tasks 1–8 的最终外壳和测试证据。
- Produces: 可由用户重载的 `D:\番茄` 扩展、更新后的操作说明和实机验收矩阵。

- [ ] **Step 1: 更新 README 的真实状态和入口说明**

删除“近 1:1 五区已完成”等过时表述，明确当前版本为截图级八区复刻；说明上一/下一位于邮件列表标题行，恢复/停用位于 More 菜单，目录仍冻结；更新 2560 基线和四个断点。不得宣称 Chrome/Edge 实机通过，除非后续三关已经实际完成。

- [ ] **Step 2: 更新图标来源记录**

`NOTICE.md` 逐项列出所有语义键、官方上游文件路径、锁定提交和 MIT 许可位置。确认运行时代码无官方仓库 URL 请求。

- [ ] **Step 3: 运行完整自动测试**

Run: `npm test`

Expected: 全部测试 PASS，失败数、跳过数和待处理数均为 0。

- [ ] **Step 4: 检查所有源码语法**

Run: `Get-ChildItem -Recurse -Filter *.js src | ForEach-Object { node --check $_.FullName }`

Expected: 每个 `src/**/*.js` exit code 0。

- [ ] **Step 5: 运行最终静态安全扫描**

Run: `rg -n "fetch\(|XMLHttpRequest|WebSocket|host_permissions|innerHTML|cloneNode\(|data:image|fqmail-catalog-slot|fqmail-catalog-button" src manifest.json`

Run: `rg -n "(^|\n)\s*(button|input|p|h1|h2|h3|body|html)\s*[{,]" src/skins/outlook/styles.css`

Expected: 无运行时网络、正文复制、base64、目录 UI 和宽泛 CSS 命中；若 `cloneNode` 只出现在无关旧模块，必须确认不针对 reader box，不能用忽略规则掩盖。

- [ ] **Step 6: 提交用户重载前报告**

报告必须包含：修改文件、自动测试数、语法检查数、Manifest 权限、图标数量、锁定提交、目录冻结状态。明确写“自动测试不等于真实页面通过”，请求用户手动重载 `D:\番茄`。

- [ ] **Step 7: 仅用 Browser/Chrome 完成三关实机验收**

关卡 1：在 2560×1305 对照用户截图，记录顶栏、搜索、应用轨、标签、12 项功能区命令、分裂按钮和图标是否逐项匹配；任何通用占位图标即失败。

关卡 2：记录文件夹区、351px 单邮件列表、白色阅读卡片、305px 广告区、41px 任务栏的截图和尺寸表；不得打开或保存 Outlook 邮件内容作为仓库资产。

关卡 3：验证上一章、下一章、More 菜单恢复、停用、Alt+Shift+M、正文滚动、刷新进度和恢复番茄；展示按钮不得改变 URL、存储或正文。

任一关首个失败立即停止，提交 URL、窗口尺寸、操作、现象、截图、失败区域和下一步建议；不在未审批情况下继续扩大修改。Chrome 三关通过后再在 Edge 重复三关。

---

## Completion Matrix

| Spec requirement | Implemented by |
| --- | --- |
| 语义图标 ≥35、固定来源、本地 SVG | Task 2 |
| 顶栏、应用轨、标签和完整功能区 | Task 3 |
| 文件夹树、单真实邮件、上下章位置 | Task 4 |
| 白色阅读卡、305px 右栏、41px 任务栏 | Task 5 |
| More 菜单、恢复/停用、展示提示 | Task 6 |
| 2560 坐标、图标状态、四个断点 | Task 7 |
| 唯一正文、进度、SPA、目录冻结、安全权限 | Task 8 |
| README、NOTICE、全量测试和 Chrome/Edge 实机证据 | Task 9 |

## Execution Order

严格按 Task 1 → 9 执行。Task 1–2 建立公共基础；Task 3–6 可逐区 review，但都依赖前两项；Task 7 只在 DOM class contract 稳定后开始；Task 8–9 是不可省略的集成与证据门槛。不要把真实浏览器验收提前当成调试手段，也不要用自动测试结果代替三关实机证据。
