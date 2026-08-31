# 番茄 Mail M2 Outlook 高保真界面设计

## 目标

在不改变正文、导航、进度和恢复底座的前提下，将当前“Outlook 配色三栏外壳”重建为高保真的 Outlook 邮件工作区信息架构。M2 只负责界面结构、视觉系统、图标、状态展示和安全响应式布局，不恢复或修订目录功能。

## 当前边界

- M1 目录功能冻结为已知缺陷：真实点击后显示“目录点击成功但目录未出现”。
- M2 不修改目录 finder、原生目录事件、catalog controller、等待器或解析器。
- M2 不显示目录按钮，也不宣称目录可用。
- 没有目录数据时，章节列表只显示当前章节这一条真实快照；不制造其他章节、未读数或文件夹数量。
- 搜索、筛选、密度设置和完整章节工作流仍属于 M3。

## Outlook 实测基线

在 2560×1305 的 Outlook Web 中文界面中只读测得：

- 顶栏：48px。
- 左侧应用轨：40px，位于 x=4。
- 功能区：y=48，高 77px。
- 第二层命令栏：y=85，高 40px。
- 导航窗格：宽 214px，内部文件夹树宽 188px。
- 邮件列表：宽 351px，4px 顶部圆角，轻量双层阴影。
- 阅读窗格：占用余下宽度。
- 搜索区：350×32px，4px 圆角。
- 主要字体：Segoe UI / Microsoft YaHei UI，14px。
- 主操作蓝：`#0f6cbd`。
- 主要正文色：`#242424` / `#424242`。

M2 采用这些尺寸作为结构基线，不复制用户账户、邮件内容或 Outlook 私有代码。

## 信息架构

### 1. 顶栏

- 高度固定 48px，背景 `#0f6cbd`。
- 左侧提供 48×48 的应用启动器视觉入口和“番茄 Mail”产品名。
- 中部保留 350×32 的章节搜索外形，但设置为明确禁用：文案“搜索章节（目录功能暂停）”，`disabled` 与 `aria-disabled=true`，不可聚焦、不可输入。
- 右侧只显示非交互的“本地阅读”状态标签，不模拟账户头像、通知、设置或帮助。

### 2. 应用轨

- 桌面完整模式宽 40px，背景使用 Fluent 中性色。
- 只显示两个状态入口：Mail（当前选中）和 Book Open（当前阅读）。
- 两个入口用于表达当前工作区，不触发未实现的应用切换；使用 `aria-current` 与 tooltip 说明，不伪装为可导航按钮。
- 不显示日历、联系人、Teams 或更多应用。

### 3. 功能区与命令栏

- 功能区总高 77px；第一行 37px 显示当前书名和当前章节上下文，第二行 40px 为命令栏。
- 命令栏只保留真实可用操作：上一封、下一封、恢复番茄、停用皮肤。
- 上一封/下一封继续代理原生上一章/下一章；恢复和停用继续使用既有可逆生命周期。
- 不显示目录、删除、归档、回复、转发等无功能控件。
- 状态信息始终位于命令栏右侧，支持 `ready/loading/success/error/disabled`，不包含正文或存储值。

### 4. 导航窗格

- 完整桌面宽 188px，加外层间距后总占用约 214px。
- 标题为当前书名。
- 只显示“当前阅读”一个可用项，显示当前章节标题的截断摘要。
- 显示一个非交互限制说明：“目录功能暂停；章节筛选将在后续恢复”。
- 不创建“全部、未读、已读”等尚未实现的筛选入口。

### 5. 章节邮件列表

- 完整桌面宽 351px，面板顶部 4px 圆角并使用轻量双层阴影。
- 标题区高 48px，显示“章节”和“当前 1 项”。
- 列表只渲染当前章节快照为一封选中的邮件：章节标题、状态“正在阅读”、本地已读标记。
- 当前章节变化时替换这一条记录，不累积伪目录。
- 底部显示受控空态说明：“完整章节列表等待目录功能恢复”。

### 6. 阅读窗格

- 占用剩余宽度，保持原生 `.muye-reader-box` 的同一 DOM 节点和动态字体。
- 顶部阅读标题区使用当前章节标题；正文滚动容器仍是 `.fqmail-reader-pane`。
- 不读取正文 `textContent`，不复制正文，不改变进度存储键。

## Fluent SVG 图标

来源固定为微软官方 `microsoft/fluentui-system-icons`：

- 仓库：https://github.com/microsoft/fluentui-system-icons
- 固定提交：`4d685f77b2cb8f3f412a74ec8d920c8c91149528`
- 许可：MIT，Copyright (c) 2020 Microsoft Corporation

M2 只内置所需的 20px regular/filled 图标路径：

- Apps 20 Regular
- Mail 20 Filled
- Book Open 20 Regular
- Arrow Previous 20 Regular
- Arrow Next 20 Regular
- Arrow Reset 20 Regular
- Search 20 Regular

实现采用 `createElementNS` 创建 SVG 与 path，不使用 `innerHTML`，不加载 CDN，不增加 npm 运行时依赖。新增第三方许可副本与来源说明；图标默认为 `currentColor`，装饰图标使用 `aria-hidden=true`，按钮仍以可见文字或 `aria-label` 提供名称。

## 视觉令牌

```js
{
  colorBrand: "#0f6cbd",
  colorBrandHover: "#115ea3",
  colorBrandPressed: "#0c3b5e",
  colorNeutralForeground1: "#242424",
  colorNeutralForeground2: "#424242",
  colorNeutralForeground3: "#616161",
  colorNeutralBackground1: "#ffffff",
  colorNeutralBackground2: "#fafafa",
  colorNeutralBackground3: "#f5f5f5",
  colorNeutralStroke1: "#d1d1d1",
  colorSubtleHover: "#f5f5f5",
  colorSelected: "#ebf3fc",
  radiusSmall: "4px",
  commandHeight: "32px"
}
```

所有 CSS 选择器继续使用 `fqmail-` 前缀；禁止全局 `button/input/p/h1/body/html` 选择器。

## 响应式规则

### ≥1280px

- 48px 顶栏。
- 40px 应用轨。
- 188px 导航树。
- 351px 章节列表。
- 阅读窗格占剩余宽度。
- 77px 功能区完整显示。

### 720–1279px

- 隐藏应用轨。
- 导航窗格压缩为 160px。
- 章节列表压缩为 300px；低于 960px 时压缩为 260px。
- 命令文字保持可见；状态允许省略号但不能完全消失。

### <720px

- 顶栏 48px；隐藏应用轨和禁用搜索框。
- 功能区保持两行，命令栏允许横向滚动，不换行遮挡状态。
- 导航摘要、当前章节卡片和阅读窗格按纵向排列。
- 阅读窗格最小高度 50vh；恢复番茄必须始终可达。

## 可访问性

- 所有真实按钮使用原生 `button`、32px 最小高度、清晰 hover/focus-visible/disabled。
- 图标不可作为唯一名称。
- 当前应用、当前导航项和当前章节分别使用 `aria-current` 或 `aria-selected`。
- 禁用搜索框同时提供可见原因，不用 placeholder 代替标签。
- 颜色不作为已读/当前状态的唯一表达。

## 组件划分

- `fluent-icons.js`：只负责创建已许可的 SVG 节点。
- `tokens.js`：暴露不可变视觉令牌，供 skin 与样式契约测试使用。
- `outlook/index.js`：创建 Outlook 五区结构、渲染当前章节和状态。
- `outlook/styles.css`：实现尺寸、布局、状态和响应式规则。
- `controller.js`：只适配新的 skin refs 和当前章节渲染；不接管视觉细节，不改目录链路。

## 测试策略

自动测试必须先 RED 再 GREEN，覆盖：

- 顶栏、应用轨、功能区、导航、章节列表、阅读窗格的语义结构和唯一实例。
- 基线尺寸、令牌、阴影、按钮状态和三个响应式断点。
- 禁用搜索框不可输入且有明确说明。
- 只渲染当前章节一项，不伪造目录数量。
- Fluent SVG 使用 `createElementNS`、正确 viewBox、`currentColor` 和许可文件。
- 没有目录按钮、目录槽位或目录修复代码变化。
- 上下章、进度、快捷键和恢复回归通过。
- Manifest 权限与静态安全约束保持不变。

## 实机验收

M2 完成后由用户手动重新加载扩展，只用 Browser/Chrome 验证：

- 2560、1440、1280、960、720px 五个宽度的结构截图与尺寸对照。
- 顶栏、应用轨、功能区、导航、列表和阅读窗格层级。
- 上一封、下一封、恢复番茄、停用皮肤、状态栏、动态字体和滚动进度。
- 目录按钮不存在，目录缺陷未被误报为通过。
- 非阅读页不注入。

浏览器首个失败即停止并提交结构化报告；自动测试不能代替真实页面证据。
