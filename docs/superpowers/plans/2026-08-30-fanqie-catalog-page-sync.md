# 番茄 Mail M3.0 作品页目录同步实施计划

## 边界与基线

- 工作目录为 `D:\番茄`；项目不是 Git 仓库，不初始化 Git、不创建 worktree、不提交。
- 本轮只实现 M3.0 作品页目录同步；M3.1 搜索、筛选和千章交互留待后续。
- 不使用 Computer Use，不操作真实浏览器；本地验证结束后交给用户手动重载。
- 保持 `storage` 唯一权限、精确阅读页匹配、无网络 API、无正文提取/复制/缓存。
- 保留现有 Outlook UI、当前章节邮件、上下章、正文搬运、进度、快捷键和恢复番茄。
- 阅读页原生目录/nativeCatalogDock 路线不再接入新运行时；作品页数据源成功前不得清空现有列表。

## Task 1：审计与纯解析契约

1. 核对当前 Manifest、内容脚本顺序、controller、catalog controller、storage、皮肤和测试。
2. 新建纯目录解析/校验模块，严格验证同源 HTTPS 作品页、数字 bookId、数字 chapterId、标题长度、去重和顺序。
3. 先写并运行 RED：实际显示章数与有效章节链接不一致时，取有效唯一链接数；覆盖 1086 条首尾和异常链接拒绝。

Checkpoint：解析测试失败原因必须是模块/接口缺失，而非夹具错误。

## Task 2：一次性 token 与传输存储

1. 新建短 TTL、带 token/bookId/currentChapterId 校验的一次性传输记录。
2. 先写 RED：未匹配 token、过期、重复消费、bookId 不匹配均拒绝，成功消费后立即删除。
3. GREEN 后仅保存短期目录传输记录，不保存正文或长期目录。

## Task 3：作品页最小 collector 与 Manifest 分离

1. 先写 RED：无合法 hash 不运行；合法 token 只解析公开章节链接并写入一次传输记录。
2. 新增 page 内容脚本，仅匹配 `https://fanqienovel.com/page/*`，不加载皮肤、正文或 controller。
3. 页面采集器成功后尝试关闭；不能关闭时仅显示最小提示。

Checkpoint：reader 与 page 内容脚本严格分离，Manifest 仍只有 `storage`，无 `tabs`/`scripting`/`host_permissions`。

## Task 4：阅读页 catalog-page-source 静默同步

1. 先写 RED：iframe 成功、超时、CSP/跨域/空目录/缺当前章节均产生正确结果并清理资源。
2. GREEN：创建 hidden 同源 iframe，使用真实作品页 href，不注入脚本；从 iframe `contentDocument` 的公开 reader 链接解析。
3. 成功前完整校验，成功后原子返回；失败保留现有邮件列表和正文。

## Task 5：controller 接入与可见回退

1. 先写 RED：同步按钮 loading、不调用旧 native catalog；静默失败第一次只提示，第二次真实点击才打开作品页。
2. GREEN：controller 只编排 source、状态和原子提交；启用目录成功后调用 `skin.renderCatalog`，失败不调用 `renderCatalog([])`。
3. 使用来源页真实 `entry.href` 导航，章节切换前保存进度/已读。

## Task 6：皮肤同步槽与状态

1. 先写 RED：保留当前邮件/正文，状态文案为“正在同步邮件”等，成功显示实际数量；不显示旧目录按钮。
2. GREEN：同步槽调用 controller 回调，目录行仅消费真实 entries；保留上下章、恢复和停用。

## Task 7：回归与安全门禁

1. 回归单 shell、单 reader box、动态字体、进度、快捷键、恢复、M2 UI。
2. 静态确认无旧目录运行时调用、无正文复制/缓存、无网络 API。
3. 明确 M3.1、Edge、完整断点和真实浏览器均不在本轮完成声明内。

## Task 8：最终验证与交接

- 运行聚焦 RED→GREEN、全量 `npm test`、所有 `src/**/*.js` 的 `node --check`。
- 核对 Manifest 两个精确 content-script 匹配条目、权限和脚本隔离。
- 报告实际测试数、改动文件、静态扫描和用户 Chrome 手动验收步骤。
- 不宣称真实浏览器通过。
