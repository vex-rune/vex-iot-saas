# Vex IoT 前端 质量检查 / 错误修复 TODO

> 起点:`tsc -b --noEmit` 报 ~100+ TS 错误(主要源自 `app/src/`)。本文档按"P0→P1→P2"分块,每项独立可勾选;实施时改完一项即把该项标记为 ✅。

---

## P0 · 阻断编译 (5 项)

- [x] **P0-1** 新建 `src/components/DeviceCard.tsx` —— Dashboard 紧凑型设备卡(选中态 + 心跳 dot + 三级标签 + 设备名)。 ✅
- [x] **P0-2** 新建 `src/hooks/useDeviceHeartbeats.ts` —— 多设备心跳轮询,封装 `Map<deviceId, HeartbeatInfo>`。 ✅
- [x] **P0-3** 新建 `src/components/list/SearchFilterBar.tsx` + `index.ts` —— 通用「搜索 + 排序 + 筛选 + 重置」工具栏;`FilterGroupSpec` 类型在此定义。 ✅
- [x] **P0-4** 修复 `src/components/panel/types.ts` 中 `POINT_PLUGIN_COMPAT` 的 `LONG` → `INT`(DataType 已无 LONG)。 ✅
- [x] **P0-5** 修复 `Dashboard.tsx` 中对上述三模块的导入解析 —— 让 TS 跑通基础编译。 ✅

## P1 · 类型/字段收窄 (12 项)

- [x] **P1-1** `src/types/api.ts`:`AlarmRule` 补 `ruleName?: string`(与 `conditionName` 并列)。 ✅
- [x] **P1-2** `src/types/api.ts`:`CurrentUserResponse` 补 `nickname?: string`。 ✅
- [x] **P1-3** `src/types/api.ts`:`NotifyRecord` 补 `event?: string`、`time?: string`、`notifyUserIds?: string[]`(选项 A:扩类型,加注释说明来源为聚合视图)。 ✅
- [x] **P1-4** `src/components/panel/useWidgetData.ts`:`toMs` 支持 `string` 入参(ISO 字符串 → Date.parse)。 ✅
- [x] **P1-5** `src/components/panel/PanelRenderer.tsx`:`pointMap` 显式 `Map<string, PointDefinition>`;`widgetLabel` 中 `pointDef.pointName ?? ''`。 ✅
- [x] **P1-6** `src/components/panel/PanelRenderer.tsx`:`point?.displayValue` → `point?.value ?? point?.rawValue`(RealtimePointValue 实际字段)。 ✅
- [x] **P1-7** `src/pages/Dashboard.tsx`:同上 `point.displayValue/unit` 替换为 `value/rawValue`。 ✅
- [x] **P1-8** `src/pages/AlarmEvents.tsx`:`event.deviceId.slice()` → `event.deviceId?.slice(0, 8) ?? '-'`。 ✅
- [x] **P1-9** `src/pages/AlarmRules.tsx`:`rule.deviceId.slice()` / `rule.enabled` 空保护;`form.threshold` 等显式字符串化。 ✅
- [x] **P1-10** `src/pages/Dashboard.tsx`、`src/pages/PointAlarmEvents.tsx`:`event.deviceId.slice()` 空保护;`STATUS_COLORS[event.acknowledged]` / `LEVEL_COLORS[event.level]` 加兜底。 ✅
- [x] **P1-11** `src/pages/NotifyUsers.tsx`:`NotifyUser.name/phone/enabled` 落到 `UserFormShape` 时加 `?? ''` / `?? true`;`NotifyTemplate` 同理。 ✅
- [x] **P1-12** `src/pages/device/sections/AlarmSettingsSection.tsx`:`r.ruleName?.match(...)` 空保护;`r.enabled` / `row.enabled` boolean 空保护;`threshold` 改为字符串直传。 ✅

## P2 · 隐式 any / 导入补齐 (4 项)

- [x] **P2-1** `src/pages/Devices.tsx`:补 `import type { QueryBody }`;`Array.from(keys)[0]` 中 `k` 显式类型。 ✅
- [x] **P2-2** `src/pages/NotifyUsers.tsx`:`Array.from(set).map(...)` 回调参数标 `(_: string)`。 ✅
- [x] **P2-3** 清理未使用 import:`App.tsx`(Placeholder)、`AppShell.tsx`(Cog6ToothIcon)、`NotifyUsers.tsx`(MagnifyingGlassIcon)。 ✅
- [x] **P2-4** `src/pages/PointAlarmEvents.tsx`:`STATUS_COLORS[event.acknowledged]` / `LEVEL_COLORS[event.level]` 加兜底,避免索引 undefined。 ✅

## P3 · 封装与重构 (5 项)

- [ ] **P3-1** 抽出 `src/lib/panelDraft.ts`:`readDraft/saveDraft/safeStringify/draftKey`,Dashboard 与 PanelPanelTab 复用。
- [ ] **P3-2** 抽出 `src/lib/alarmMeta.ts`:合并 `STATUS_LABELS/STATUS_COLORS/LEVEL_*`,统一来自 `lib/levelMeta.ts`。
- [ ] **P3-3** `src/pages/DeviceDetail.tsx`:`RealtimeTable` 替换为 HeroUI `Table` + `EntityCard`,删除 ~200 行原生 `<table>`(对齐 03-web 红线)。
- [ ] **P3-4** 抽出 `src/lib/shortId.ts`:`shortDeviceId(id)`、`shortPointId(code)` 工具函数,统一 `?? '-'`。
- [ ] **P3-5** `src/hooks/useApiMutation.ts`:增加可选 `successMessage` 参数,减少各页面 `onSuccess: () => addToast(...)` 样板。

## P4 · 后续(本次范围外,记录备查)

- `getDeviceRealtime` / `getDeviceHistory` / `controlPoint` 兼容垫片替换为 SSE + 新 API。
- `useEventStream` 暴露 `status` 给 UI。
- `PanelEditor` dirty 用结构化 `isWidgetEqual` 替代 `JSON.stringify`。

---

## 验证标准

1. `npm run typecheck` 退出码 0,无错误。
2. `npm run lint` 退出码 0,`--max-warnings 0` 通过。
3. `npm run build` 成功。

## 进度

> 实施中每完成一项立即把 `- [ ]` 改为 `- [x]` 并附本行 commit 备注或日期。

### 额外修复(本次附带完成,超出原 TODO)

| 文件 | 问题 | 修复 |
|------|------|------|
| `pointUtils.ts` | `DATA_TYPES` 包含已废弃的 `'LONG'` | → `'INT'` |
| `PointSettingsSection.tsx` | `dataType: 'LONG'`、`pointName` 可能 undefined | → `'INT'`、`?? ''` |
| `PanelEditor.tsx:295` | `p.pointName` 可能 undefined | → `(p.pointName ?? '')` |
| `PointScheduleSection.tsx` | `DeviceScheduleListItem` 从 `@/api/schedules` 导入但不存在 | → 从 `@/types/api` 导入;query 类型改为 `DeviceScheduleDetail[]`;字段空保护;`saveSchedule` 参数兼容 `actions?` |
| `schedules.ts` | `saveSchedule` 参数不接受 `actions` | → `DeviceScheduleDetail & { actions?: DeviceScheduleAction[] }` |
| `NotifyUsers.tsx:740,778` | `CHANNEL_LABELS[r.channel]` 索引 undefined | → `CHANNEL_LABELS[r.channel ?? ''] ?? r.channel ?? '-'` |