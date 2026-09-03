# 03 · 前端规范

> 仅适用于 **前端 list/CRUD 页面**。本文件即全部规则,无外部依赖。

## 基准样板

`Devices.tsx` 是 **所有表格类列表页的基准**,写新列表前先打开它对齐结构。

## 前置约束 (必须满足)

1. **必须双端适配** — PC (≥768px)渲染 Table;移动端 (<768px)渲染卡片网格。
2. **唯一 UI 库 = HeroUI** — 禁止自造按钮/Select/Input/Pagination 等基础交互组件。
3. **接口签名固定** — 后端必须成对实现 `POST /xxx/query` + `POST /xxx/count`,入参 `QueryBody`; **禁用 GET 分页**。
4. **分页/排序/计数** — **必须用 `useQueryList<T>`**,禁止手写 `useQuery` 维护 page/size。

## `useQueryList<T>` 必填入参

| 参数          | 说明                                                                 |
|---------------|----------------------------------------------------------------------|
| `queryKey`    | react-query 缓存键前缀                                               |
| `queryFn`     | `(body: QueryBody) => RequestChain<T[]>`(对接 `/xxx/query`)          |
| `countFn`     | `(body: QueryBody) => RequestChain<number>`(对接 `/xxx/count`)       |
| `defaultSize` | 字符串型:`'15' / '30' / '60' / '100'`(必须是字符串,否则页大小不回显) |

## 筛选搜索栏模板

外层容器:`<div className="flex flex-wrap items-center gap-2">`

组件三件套 **全部 `size="sm"`**,禁止手动加 `h-xx` 高度覆盖:

- 搜索框:`<Input size="sm" startContent={搜索图标} placeholder={...} aria-label={...} />` — **不用 label**
- 维度筛选:`<Select size="sm" placeholder={...} aria-label={...} />` — **不用 label**
- 重置按钮:`<Button size="sm" variant="flat" />`

搜索防抖固定模板 (300ms,严格复制):

```tsx
const [searchText, setSearchText] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');
useEffect(() => {
  const t = setTimeout(() => setDebouncedSearch(searchText), 300);
  return () => clearTimeout(t);
}, [searchText]);
```

## 加载态 / 空态

- **加载**:外层 `<div className="rounded-2xl bg-content1 p-4">` → 1 个 `h-8` 头部骨架 + 6 个 `h-10` 行骨架。
- **空态 - PC Table**: `<TableBody emptyContent="暂无xxx">`
- **空态 - 移动卡片**:
  `<div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">暂无 xxx</div>`

## PC 表格 (`≥768px`)

容器: `<Table aria-label="..." isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>`

列断点显隐:`hidden sm:table-cell` / `md:table-cell` / `lg:table-cell`

| 单元格类型   | 写法                                                                                                     |
|--------------|----------------------------------------------------------------------------------------------------------|
| 操作列按钮   | 外层套 `<Tooltip>`,按钮属性 `isIconOnly size="sm" variant="light"`;危险操作外层再套 `<Popover>` 二次确认 |
| 状态         | `<Chip size="sm" variant="flat" color={...}>`(颜色映射用常量管理)                                        |
| ID/编码/数字 | `<code className="text-xs text-foreground-600">`                                                         |
| 超长文本     | `<span className="max-w-[280px] truncate">`                                                              |

## 移动端卡片 (`<768px`)

网格外层:

```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
```

效果:手机 1 列 / 平板 2 列 / PC 3 列 / 宽屏 4 列。

使用 `<EntityCard>`:`title` / `subtitle` / `badge` / `actions` / `children`(+ `FieldRow label value`)。

⚠️ **移动端操作按钮必须带文字,禁止纯图标**(点击区域过小)。

## 分页组件 — 无条件始终渲染

即便 `total=0` 也要渲染,避免布局抖动:

```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <span className="text-sm text-foreground-500">共 {total} 条</span>
    <Select size="sm" variant="bordered" className="w-24"
      selectedKeys={[String(size)]}                              // ⚠️ 必须受控
      onSelectionChange={(keys) => setSize(Number(Array.from(keys)[0]))}>
      {['15', '30', '60', '100'].map((s) => (<SelectItem key={s}>{s}</SelectItem>))}
    </Select>
  </div>
  <Pagination total={totalPages} page={page + 1}
    onChange={(p) => setPage(p - 1)} showControls isCompact />
</div>
```

## 默认排序 (只初始化一次)

```tsx
useEffect(() => setOrder([...]), [setOrder]);
```

事件/历史类列表 → 时间字段降序 (`occurTime` / `time` / `createdAt DESC`);设备类按需。

## 变更操作 (增删改)

1. 使用 `useApiMutation` 发请求。
2. 成功 → `addToast` 提示 + **`refetch()` 刷新列表**。
3. ❌ 禁止用 `setPage(page)` 刷新,会循环死渲染。
4. 删除/禁用等高风险 → 必须 `<Popover>` 二次确认。

## 🚫 黑名单 (违反即返工)

| 禁止写法                             | 后果                               |
|--------------------------------------|------------------------------------|
| 手写 `useQuery` 维护 page/size       | 脱离封装,丢缓存、丢 refetch        |
| `<Input label="xxx" />` 浮动标签     | 高度变大,与 Select/Button 同行错位 |
| `<Input className="h-9" />` 叠高度   | HeroUI 内部 padding 与外尺寸冲突   |
| 移动端操作按钮只放图标               | 点击区过小                         |
| `total=0` 隐藏 Pagination            | 页面闪屏                           |
| `<Select defaultSelectedKeys={...}>` | 非受控,页面进入不回显页大小        |
| `GET /xxx?page=&size=`               | 与 `useQueryList` 不兼容           |
