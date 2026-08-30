# IOT‑SAAS 前端列表页开发规范（HeroUI · PC/移动端双适配）

> 
> 基准样板：`Devices.tsx`，所有表格类列表页严格对齐此规范；技术栈：React + HeroUI + React‑Query；接口文档位于 `.trae/rules`，每个JSON对应一个接口模块。
> 业务变更操作（新增/编辑/删除/状态修改）完成后必须调用 `refetch()` 刷新列表数据。

## 通用前置约束

1. 必须同时适配 PC端(≥768px)、手机端(<768px)，PC渲染Table，移动端渲染卡片网格。
2. 全部UI组件使用 **HeroUI**，禁止自定义组件替换基础交互组件。
3. 接口统一：后端提供 `POST /xxx/query`、`POST /xxx/count`，入参为`QueryBody`，禁止使用GET分页参数。
4. 列表数据钩子统一：**强制使用 `useQueryList<T>`**，禁止手写 `useQuery` 自行维护page/size。

---

## 1. useQueryList 使用约束

### 必填入参

| 参数 | 说明 |
| --- | --- |
| `queryKey` | react‑query缓存键前缀 |
| `queryFn` | `(body: QueryBody) => RequestChain<T[]>`，对接 `/xxx/query` |
| `countFn` | `(body: QueryBody) => RequestChain<number>`，对接 `/xxx/count` |
| `defaultSize` | 默认分页大小，可选：`15 / 30 / 60 / 100`, 注意使用字符串类型否则无法正常回显 |

> 
> 后端必须成对实现接口：
> 
> 
> - `/xxx/query`：POST QueryBody → 返回实体数组
> - `/xxx/count`：POST QueryBody → 返回总条数number

---

## 2. 筛选搜索栏

### 外层容器

```
<div className="flex flex-wrap items-center gap-2">
```

### 组件三件套（全部设置 `size="sm"`，禁止手动加`h‑xx`高度覆盖）

1. 搜索框：`Input size="sm"`，配置`startContent`搜索图标、`placeholder`、`aria‑label`，**不使用label属性**
2. 维度筛选：`Select size="sm"`，配置`placeholder`、`aria‑label`，**不使用label属性**
3. 重置按钮：`Button size="sm" variant="flat"`

### 搜索防抖固定模板（300ms）

```
const [searchText, setSearchText] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');
useEffect(() => {
  const t = setTimeout(() => setDebouncedSearch(searchText), 300);
  return () => clearTimeout(t);
}, [searchText]);
```

### predicate筛选条件同步模板

```
const defaultPredicate = useMemo<Predicate | undefined>(() => {
  const items: PredicateItem[] = [];
  if (debouncedSearch.trim()) {
    items.push({ condition: { field: 'xxx', op: 'like', value: `%${debouncedSearch.trim()}%` } });
  }
  if (filterX !== 'ALL') {
    items.push({ condition: { field: 'x', op: 'eq', value: filterX } });
  }
  return items.length > 0 ? { and: items } : undefined;
}, [debouncedSearch, filterX]);

useEffect(() => {
  setPredicate(defaultPredicate);
  setPage(0);
}, [defaultPredicate, setPredicate, setPage]);
```

---

## 3. 加载状态 & 空状态

### 加载骨架

外层容器：`<div className="rounded-2xl bg-content1 p-4">`
内部：1个`h‑8`头部骨架 + 6个`h‑10`行骨架。

### 空态

- PC表格：使用HeroUI原生能力 `<TableBody emptyContent="暂无xxx">`
- 移动端卡片：

```
<div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">暂无 xxx</div>
```

---

## 4. PC端表格布局（≥768px）

### Table容器

```
<Table aria-label="xxx列表" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
```

### 列响应式控制

- 核心字段（名称、编码、时间）：始终展示
- 次要字段：使用 `className="hidden sm:table-cell"` / `md:table-cell` / `lg:table-cell` 做断点显隐

### 单元格规范

1. 操作列：按钮外层包裹`Tooltip`；按钮属性：`isIconOnly size="sm" variant="light"`；危险操作外层套`Popover`做二次确认
2. 状态：`<Chip size="sm" variant="flat" color="xxx">`，颜色映射常量管理
3. ID/编码/数字：`<code className="text-xs text-foreground-600">`
4. 超长文本：`<span className="max-w-[280px] truncate">`

---

## 5. 移动端卡片布局（＜768px）

### 网格外层

```
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
```

> 
> 布局效果：手机1列 / 平板2列 / PC3列 / 宽屏4列

### 组件使用 `EntityCard`

props：

- `title`：主标题
- `subtitle`：副标题（编码/时间）
- `badge`：右上角状态徽章
- `actions`：底部操作按钮区（**按钮必须带文字，禁止纯图标**）
- `children`：内部使用`FieldRow label="xxx" value={xxx}`渲染字段

---

## 6. 分页组件（无条件始终渲染，total=0也渲染，避免布局抖动）

```
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <span className="text-sm text-foreground-500">共 {total} 条</span>
    <Select size="sm" variant="bordered" className="w-24"
      selectedKeys={[String(size)]}
      onSelectionChange={(keys) => setSize(Number(Array.from(keys)[0]))}>
      {['15', '30', '60', '100'].map((s) => (<SelectItem key={s}>{s}</SelectItem>))}
    </Select>
  </div>
  <Pagination total={totalPages} page={page + 1}
    onChange={(p) => setPage(p - 1)} showControls isCompact />
</div>
```

> 
> 关键点：页大小Select必须受控，使用`selectedKeys`，禁止`defaultSelectedKeys`非受控写法。

---

## 7. 默认排序设置

- 事件/历史类列表：时间字段降序 `occurTime` / `time` / `createdAt DESC`
- 设备类列表：按需（例如设备编码升序）
- 实现方式：`useEffect(()=> setOrder([...]), [setOrder])`，仅初始化设置一次。

## 8. 变更操作（增删改）

1. 使用`useApiMutation`执行请求
2. 请求成功：`addToast`提示 + `refetch()`刷新列表> 
> ❌禁止通过`setPage(page)`刷新，会造成循环死渲染
3. 删除、禁用、确认等高风险操作：必须`Popover`二次确认弹窗。

## 9. 禁止写法黑名单

| 禁止写法 | 问题说明 |
| --- | --- |
| 手写`useQuery`自行维护page/size | 脱离封装，丢失缓存、refetch能力 |
| Input设置`label="xxx"`浮动标签 | 高度变大，无法和Select/Button同行对齐 |
| Input/Select叠加`className="h‑9"` | HeroUI内部padding和外部尺寸冲突，边框错位 |
| 移动端操作按钮只放图标 | 点击区域过小，可用性差 |
| total为0隐藏Pagination组件 | 页面布局跳动闪屏 |
| Select使用`defaultSelectedKeys` | 非受控，页面进入不会回显当前页大小 |
| GET请求拼接`?page=&size=` | 和`useQueryList`不兼容，强制使用POST QueryBody |

## 10. 新增列表页检查清单

- 后端实现成对接口：`POST /xxx/query`、`POST /xxx/count`
- 前端API模块导出 `queryXxx`、`countXxx`，签名匹配`RequestChain`
- 页面使用`useQueryList<T>`接管分页、排序、计数
- 筛选栏容器`flex flex-wrap items-center gap‑2`；全部组件`size="sm"`，无额外高度覆盖
- 搜索框实现300ms防抖逻辑
- 加载态使用指定`rounded‑2xl bg‑content1 p‑4`容器+骨架
- PC表格：`<Table isStriped classNames={{wrapper:'bg‑content1 rounded‑2xl'}}>`
- 移动端：网格布局 + `EntityCard` + `FieldRow`
- 分页组件**无条件渲染**；左侧：总条数+受控页大小选择器；右侧`isCompact`分页器
- 通过`useEffect`设置默认排序（时间类列表默认时间降序）
- 所有修改数据操作完成后调用`refetch()`刷新列表

## 补充全局约定

1. 任何列表执行修改、新增、删除操作，必须执行`refetch()`刷新列表；
2. 全部页面必须完成PC/移动端双端适配，HeroUI组件库作为唯一UI来源。