# 番茄邮箱式阅读工作区技术规格

状态：M0 目标规格，后续行为按 M1–M4 分阶段实现

## 系统边界

扩展是无构建步骤、无运行时依赖的 Manifest V3 内容脚本：阅读工作区匹配 `https://fanqienovel.com/reader/*`，目录兜底采集器单独匹配 `https://fanqienovel.com/page/*`。它不连接真实邮箱、不建立服务端、不调用番茄未公开接口，也不提取、复制、缓存或持久化章节正文。

正文始终使用番茄当前页面的同一个 `.muye-reader-box`。动态字体依赖该节点及其原生 class，扩展不得尝试解码混淆文本。

## 目标模块边界

经典脚本继续按 Manifest 顺序加载并注册到 `globalThis.Fqmail`，不引入打包器。

```text
adapters/fanqie/*             页面识别、受限选择器、身份与目录解析
core/native-catalog-sync.js   原生阅读页目录同步状态机
core/catalog-page-parser.js   显式作品页回退链接解析与校验
core/catalog-page-workflow.js 显式作品页回退编排
core/catalog-transfer.js      短 TTL、一次性目录记录
core/reader-transfer.js       正文搬运、恢复与滚动进度
core/storage.js               最小本地状态与批量已读读取
core/controller.js            生命周期、导航、模块组合与恢复兜底
skins/outlook/*               高保真布局、可访问控件与视图渲染
content.js                    页面匹配、启动与运行时消息入口
```

`controller.js` 不再拥有目录解析、筛选和搜索细节。适配器不渲染 UI；皮肤不查询番茄 DOM；页面源模块不读取正文。M3.1 的筛选与搜索不属于本轮目录同步实现。

## 身份模型

统一接口：

```js
resolveReaderIdentity(documentLike, locationLike)
// => { bookId: string, chapterId: string }
```

- `chapterId` 优先取 `chapter_id`/`chapterId`，否则取 `/reader/<id>` 路径段；阅读路径中的数字视为章节 ID。
- `bookId` 优先取页面中 `/page/<bookId>` 原生书籍链接。
- 找不到书籍链接时，使用 `title:<encoded-normalized-title>`。
- 不迁移或删除旧错误键，新版本只停止继续写入错误身份。

状态键保持兼容：

```text
fqmail:settings                         { enabled, density }
fqmail:read:<bookId>:<chapterId>        true | false
fqmail:progress:<bookId>:<chapterId>    0..1
```

新增批量读取接口：

```js
store.getReadMany(bookId, chapterIds)
// => Record<chapterId, boolean>
```

搜索词、筛选项和目录加载状态只存在当前页面会话，不写入存储。

## 原生 DOM 与事件契约

### 正文

接管时在 `.muye-reader-box` 原位置插入唯一注释占位符，将同一节点移动到阅读窗格。`mount()` 返回：

```js
{
  scrollElement,
  getProgress(),
  setProgress(value),
  restore()
}
```

恢复时优先放回原占位符位置并恢复原 style、窗口滚动和盒子滚动。占位符已脱离文档时返回 `false`；只有用户主动停用路径可以在保存 `enabled=false`、清理监听与外壳后刷新当前页面一次。

### 目录同步

同步邮件不移动或覆盖原生工具栏，也不调用目录 `element.click()`。点击后暂时隐藏邮箱外壳并提示用户真实点击番茄原生“目录”；扩展观察 `#app > .muye-reader` 中实际出现的 `.reader-catalog .chapter[data-item-id]`，目录关闭后才原子渲染。失败后只有用户明确点击“打开作品页同步”才进入官方作品页的一次性回退；作品页 content script 只匹配 `/page/*`，仅在合法 hash token 下运行 collector。

接口：

```js
Fqmail.nativeCatalogSync.create({
  documentLike,
  windowLike,
  adapter,
  skin,
  currentChapterId,
  onSuccess,
  onError
})
// => { start(), cancel(), dispose() }
```

### 换章过渡与标签页外观

reader 页另有一个 `document_start` 的轻量过渡脚本，主 controller 继续在 `document_idle` 运行。过渡只显示扩展自己的蓝色顶栏和“正在加载邮件”，不读取或复制正文、不搬运 `.muye-reader-box`，并从入口开始计时：启用设置超过 300ms 未返回、读取失败、启动失败、停用、恢复或达到 5 秒硬上限时释放；`ready()`/`release()` 幂等，迟到结果不得重新遮挡页面。原生目录同步期间不得重新挂载过渡层。

皮肤启用后，标签页标题固定为“收件箱 - Outlook”，并使用本地打包的官方 Outlook 彩色 favicon。外观模块在当前文档内存中保存并跟踪站点最新原生 title、多个 favicon 节点及后续替换/新增/移除；停用或恢复时删除自有节点并恢复最新原生状态。Fanqie 身份解析必须使用外观模块提供的原始标题，不能把固定 Outlook 标题当作书名。

## 目录、筛选与搜索

用户点击皮肤自己的“同步邮件”按钮后，扩展立即进入 `loading`，提示用户点击原生“目录”。动态目录同步最长 30 秒；失败显示受控错误和可选的显式作品页回退。读取成功且原生目录关闭前不得清空当前邮件或正文，成功后一次性提交实际有效章节。

阅读页目录只读取严格校验的 `.reader-catalog .chapter[data-item-id]`，映射：

```js
{
  chapterId,
  title,
  href,
  order,
  active,
  visited,
  locked
}
```

目录成功后一次批量读取本地已读状态并一次性提交列表。M3.1 再实现筛选与搜索状态；本轮不把它们作为 M3.0 运行时承诺。

```js
filter: "all" | "current" | "unread" | "read"
query: string
density: "comfortable" | "compact"
catalogState: "idle" | "loading" | "ready" | "error"
```

搜索只匹配已加载的章节标题；未加载目录时不搜索正文，也不自动合成目录点击。筛选与搜索可组合，结果保持原目录顺序。

## Outlook 视图规格

- 顶栏：48px，`#0f6cbd`，包含产品标识和章节搜索。
- 应用轨：40–48px，仅保留章节工作区等真实入口。
- 筛选树：目标宽度约 188px，提供全部、当前、未读、已读及计数。
- 章节列表：目标宽度约 350px，支持 comfortable/compact 密度。
- 阅读窗格：占用剩余宽度，承载原生阅读盒子。
- 命令栏：40px，使用 32px 高的上一封、下一封、同步邮件和恢复番茄控件。
- 视觉：Segoe UI、4px 圆角、Fluent 中性色、轻量阴影及明确 hover/focus/disabled 状态。

断点：

- `>=1280px`：完整五区布局。
- `720–1279px`：隐藏应用轨并压缩筛选树和章节列表。
- `<720px`：筛选项转为横向选项，章节列表与正文纵向排列；只保证安全可用。

所有扩展节点和样式使用 `fqmail-` 前缀。禁止广泛覆盖番茄全局元素；仅允许对 bridge 绑定节点和阅读窗格内的原生阅读盒子使用窄范围规则。

## 生命周期与错误状态

状态限定为 `ready`、`loading`、`success`、`error`、`disabled`。状态信息不得包含正文、Cookie、存储值或完整错误栈。

- 非阅读页或找不到阅读盒子：不注入外壳。
- 找不到原生目录控件、目录未打开或目录节点失联：同步邮件 fail closed 并显示明确错误；用户明确点击后才进入作品页兜底。
- 作品页无有效章节链接、缺少当前章节或记录失效：保留当前邮件和正文，并显示受控错误。
- 导航 1.5 秒内身份未变化：显示“章节切换未生效”。
- 存储失败：当前页面以内存状态继续，不影响正文。
- 恢复锚点失效：按规定顺序清理后刷新当前页面一次。

## 验收

自动测试覆盖身份、原生事件路径、dock 恢复、目录互斥/超时、SPA 重挂载、批量状态、筛选搜索、进度、恢复兜底、响应式 CSS 和 Manifest 权限。

真实验收固定包含参考页面，目录数量使用实际 DOM 数量，不写死章节总数。Chrome 与 Edge 分别验证目录、章节选择、上下章、进度、快捷键、恢复、非阅读页和窗口降级；自动测试不得作为真实页面通过证据。

安全扫描继续要求无 `host_permissions`、`fetch`、`XMLHttpRequest`、`WebSocket`、正文 `textContent` 提取、正文 HTML 复制或正文缓存。
