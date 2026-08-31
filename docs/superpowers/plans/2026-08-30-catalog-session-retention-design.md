# 番茄 Mail 目录跨章节会话保留设计

## 目标

让一次成功的真实目录同步在同一阅读标签页的后续章节页面中继续可用，不要求再次同步；目录只保存章节元数据，不保存正文、HTML、DOM 或网络响应。

## 身份模型

`resolveReaderIdentity(documentLike, locationLike)` 返回 `{bookId, chapterId}`。

- `chapterId` 仍优先取 `chapter_id`、`chapterId`，否则取 `/reader/<id>`。
- `bookId` 优先取阅读页内同源 `/page/<数字>` 链接，兼容相对和绝对 href。
- 没有独立书籍链接时，只在能从标题中可靠去除当前章节标题与站点尾缀后生成 `title:<encoded-title>`。
- 无法得到独立书名时返回空的未知 bookId，不用 `title:unknown`，也不把章节 ID当作书籍 ID。
- 恢复时，如果当前章节属于已保存目录成员，则成员关系优先；只有双方都有可靠数字作品 ID时才强制同书校验。

## 会话存储

后台使用 `chrome.storage.session`（兼容 `browser.storage.session`）按消息发送者的 `sender.tab.id` 隔离目录记录。后台 worker 不依赖进程内 Map 作为真源；浏览器/扩展重启时由 session 存储自然清空。

页面通过窄消息接口调用：

```text
catalogSession.save({entries, sourceChapterId, bookId})
catalogSession.restore({currentChapterId, bookId})
catalogSession.clear()
```

消息只能来自顶层阅读页内容脚本；后台从 `sender.tab.id` 取得标签 ID，不接受页面自行指定 tab ID。保存数据仅包含数字 chapterId、标题、顺序、同源 `/reader/<数字>` href、locked、visited。限制为最多 10000 条、单标题最多 200 字符、单份序列化记录不超过 4 MiB。保存失败明确返回失败且保留旧目录。

## 生命周期

- 原生同步或作品页回退成功后，整批确认并原子保存，再更新当前目录。
- 同书 SPA 重挂载保留页面会话；整页新文档启动时自动 restore。
- 章节导航前等待旧进度和已读状态写入，然后使用已验证 href 导航；handoff 不再承担目录真源。
- 当前章节属于目录时恢复完整列表并更新 active/read；不属于目录时不显示旧目录且不删除旧记录。
- 换书、停用、恢复、页面失效和标签关闭清理对应会话；后台清理只删除本标签记录，不使用 `storage.clear()`。
- 旧 `fqmail:catalog-handoff` 只做弃用清理，不再参与运行时恢复。

## 并发与安全

每次保存、恢复和清理使用 revision/generation 防止旧异步结果覆盖新页面。后台验证来源 tab、顶层 frame、同源阅读路径和 schema；不接受跨标签读写。所有不支持、配额不足、格式错误和超限场景 fail closed，保留现有可用列表。

## 非目标

不修改 Outlook 视觉、原生目录点击链、目录 parser/waiter、正文搬运、动态字体、上下章语义或权限；不新增网络请求、隐藏接口、依赖或正文缓存。
