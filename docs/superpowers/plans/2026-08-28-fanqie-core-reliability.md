# 番茄邮箱阅读皮肤核心可靠性完善计划

## 工作方式与边界

- 仅修改 D:\番茄，来源任务不修改代码。
- 使用测试驱动：每个行为先写失败测试并确认预期失败，再做最小实现。
- 不增加依赖，不改变 Manifest 权限或匹配范围，不接入真实邮箱、未公开接口、网络请求或正文缓存。
- 后续真实 Chrome 验收只使用 Browser/Chrome 插件，永久不使用 Computer Use。

## 实施任务

1. 在 Fanqie 适配器增加 resolveReaderIdentity(documentLike, locationLike)，统一解析 bookId 与 chapterId：章节参数优先，其次使用阅读路径；书籍链接优先，其次使用规范化书名键；停止继续写入旧错误键。
2. 调整 transfer.mount() 返回 {scrollElement, getProgress(), setProgress(value), restore()}，由右侧阅读窗格承载滚动监听、保存和恢复；切换章节前保存旧进度并在新盒子挂载后恢复新进度。
3. 加固原生按钮查找、目录等待、目录加载互斥和导航后的单次重新挂载，统一 popstate、hashchange 与 DOM 变化的防抖刷新。
4. 增加 skin.setStatus(state, message)，限制状态枚举并将状态写入根元素 data-fqmail-state；启动异常使用 [Fqmail] 前缀输出；移除未实现的章节搜索输入框。
5. 增加覆盖身份、滚动容器、章节切换、侧边栏目录按钮、目录成功/超时/重复点击、状态栏隐私、搜索框移除和 Manifest 静态约束的自动测试。
6. 运行完整测试、JS 语法检查、Manifest 核对和静态扫描；完成后只报告“可重新加载扩展复验”，不把自动测试当作真实页面通过证据。

## 验收约束

- 真实页面复验固定使用 https://fanqienovel.com/reader/7504850255494529561。
- 实机复验若失败，停止改动并提交结构化报告；不擅自扩大修改范围。
