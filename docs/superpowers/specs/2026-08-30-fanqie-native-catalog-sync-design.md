# 番茄原生阅读页目录同步替代方案

## 目标

在不移动番茄 React 所有的阅读器节点、不调用脚本点击、不复制正文的前提下，将阅读页已经打开的原生目录同步为邮箱中栏章节列表。

## 交互决策

“同步邮件”只进入同步模式并暂时隐藏邮箱外壳，随后提示用户点击番茄原生“目录”。扩展只观察 `#app > .muye-reader` 中真实出现的 `.reader-catalog .chapter[data-item-id]`，目录成功后提示用户关闭番茄目录；目录卸载后再一次性恢复邮箱外壳并渲染列表。若原生同步失败，用户可明确点击“打开作品页同步”作为次级页面回退。

同步模式不能覆盖或接管番茄原生工具栏，不能使用 `element.click()`、clone、React 私有状态、隐藏 iframe 或正文提取。reader box 保持既有可逆搬运和单节点约束。

## 接口与状态

`Fqmail.nativeCatalogSync.create({documentLike, windowLike, adapter, skin, currentChapterId, timeoutMs, onSuccess, onError})` 返回 `start()`、`cancel()`、`dispose()`。内部状态为 `idle`、`awaiting-open`、`captured`、`awaiting-close`、`error`。一次同步只有一个 promise/观察器/计时器。

章节模型为 `{chapterId,title,order,active,visited,locked,href}`。只接受数字且唯一的 `data-item-id`，标题只读取 `.chapter-text` 并限制长度；整批校验通过后才交给 UI。href 只由同源 `/reader/<数字>` 生成，锁定章节只显示为不可用。

## 生命周期与回退

同步模式取消、超时、目录不完整、当前章节缺失、节点失联或 SPA 章节变化时，保持现有邮件/正文/进度并恢复外壳。目录关闭后原子地渲染成功结果；同书在页面会话内保留目录元数据，完整章节导航另将受限元数据按标签页隔离写入 `storage.session`，目标页可重复恢复，换书、停用或标签页关闭时清理，不含正文或 DOM。次级作品页同步只能由用户显式点击，token 一次性消费，采集完成后立即清理。

## 非目标

M3.1 的章节行、已读合并、标题筛选/搜索与页面内会话交接已经在实现范围内；M4 继续负责 Edge、完整断点、刷新进度和发布前矩阵。不改变上一章/下一章、reader-transfer、动态字体、权限或 Manifest 匹配范围。
