# 番茄原生目录停靠轨设计（已废弃）

> 本文是 M1 历史方案。M3.0 已改用原生阅读页目录同步，不再运行 nativeCatalogDock、透明命中层或跨区域投射；当前基线见 `2026-08-30-fanqie-native-catalog-sync-design.md`。

## 背景

番茄目录由 React 管理。此前两种映射均在真实 Chrome 失败：

- 独立 Outlook 视觉按钮叠加透明原生命中层：节点有几何位置，但用户点击无法进入 bridge，状态停留在“正文已连接”。
- 将原生节点设为可见 fixed 控件并投射到邮箱工具栏：重载后目录按钮消失。

自动测试只使用简化 DOM，不能模拟真实浏览器的祖先裁剪、stacking context、hit testing 与 React 重建，因此不能证明跨区域投射可靠。

## 决策

M1 停止把目录控件映射到邮箱顶部命令栏。原生目录节点保持原父节点、原几何位置和 `#app` 事件树；邮箱外壳为它保留一个“原生目录停靠轨”。用户看到并点击的始终是番茄原生节点。

本设计以功能可靠性优先于顶部命令栏高保真。M2 可将停靠轨自然映射为 Outlook 应用轨，但本轮不扩展视觉系统。

## 交互与布局

- 顶部邮箱工具栏不再渲染目录按钮或目录槽位。
- 番茄原生目录节点不移动、不克隆、不 fixed、不透明、不执行脚本 click。
- 原生目录所在的番茄工具栏继续留在原 DOM；仅对已验证的目录节点增加前缀化外观类，使其接近 Outlook 命令按钮。
- 邮箱外壳不得遮挡该节点的真实矩形。布局在原生目录侧预留窄轨；非交互背景允许点击穿透，邮箱正文、章节列表和其他按钮仍正常接收事件。
- 状态栏初始显示“正文已连接”；真实目录 click 的捕获监听只启动目录读取，不阻止或重放事件。
- 目录成功后渲染实际章节数；失败仍区分未找到控件、原生目录未出现和解析失败。

## 组件边界

### native catalog dock

替换当前 `nativeControlBridge` 的跨区域定位职责。新接口只管理原位增强：

```js
Fqmail.nativeCatalogDock.mount({
  nativeNode,
  shell,
  windowLike,
  onTrustedClick
})
// => { sync(), isConnected(), restore() }
```

职责：

- 验证节点仍属于 `#app` 且不属于 `.fqmail-shell`。
- 保存并恢复 class/style/ARIA/tabindex。
- 添加单一可信 click 监听；不调用 `preventDefault`、`stopPropagation` 或 `.click()`。
- 根据原生节点真实矩形更新 shell 的停靠轨 CSS 变量/占位，不改变 nativeNode 的几何位置。
- SPA 替换后恢复旧节点并绑定新节点，保持单实例。

### Outlook skin

- 删除 `catalogSlot`。
- 增加只用于布局的 `nativeDockRegion` 或等价 CSS 变量，不创建“目录”文字或按钮。
- 外壳在停靠轨范围内不拦截指针，也不以不透明背景遮盖原生控件。

### catalog controller

目录等待、`#app`/`body` 观察、最终检查、批量已读读取和解析保持不变。本轮不修改这些已通过测试的边界。

## 生命周期与恢复

- mount：先发现原生目录节点及其真实矩形，再创建邮箱外壳和停靠轨，最后安装可信 click 监听。
- refresh/SPA：发现节点身份变化时，先恢复并清理旧 dock，再为当前节点创建一个 dock。
- disable/restore：先移除监听和外观类、还原全部属性，再恢复正文并销毁 shell；既有恢复失败 reload 兜底保持不变。
- 无原生目录节点：不创建伪按钮，状态显示“未找到番茄原生目录按钮”。

## TDD 验收

必须先得到对应 RED，再实施最小 GREEN：

1. 原生目录节点的 parent、DOM 顺序与矩形在 mount 前后保持一致。
2. 源码和 skin 中不存在目录视觉按钮、透明 hit target、fixed 投射或 synthetic click。
3. 真实用户 pointer/click 命中 nativeNode 后，站点处理和目录加载各执行一次，状态进入 loading。
4. shell 的停靠轨不遮挡原生目录矩形，交互区允许点击穿透；其他邮箱区域仍可交互。
5. SPA 替换只保留一个节点、一个监听和一个 dock 状态。
6. restore 精确还原属性、样式和监听。
7. 目录等待、1085 条批量状态、上下章、进度与恢复回归不变。

## 安全与范围

- 仍仅声明 `storage` 权限并精确匹配 `https://fanqienovel.com/reader/*`。
- 不调用网络、隐藏接口或 React 内部属性。
- 不提取、复制或缓存正文。
- 不进入 M2 的完整 Outlook 应用轨、筛选、搜索和响应式重构。

## 实机退出门槛

用户重载扩展后，在 Chrome 单项验证：原生目录入口可见、可悬停、可真实点击；状态进入 loading；原生目录出现；邮箱章节列表显示实际数量。首个失败即停止。Chrome 通过后再在 Edge 复验，不能用自动测试代替。
