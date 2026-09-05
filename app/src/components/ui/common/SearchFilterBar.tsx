/**
 * 通用「搜索 + 排序 + 筛选 + 重置」工具栏。
 *
 * 用法(对照 03-web 规范):
 *   <SearchFilterBar
 *     searchPlaceholder="搜索名称 / 标签"
 *     searchValue={keyword}
 *     onSearchChange={setKeyword}
 *     sort={{ fields: [...], value, onChange, dir, onDirChange }}
 *     filters={[{ label, value, options, onChange }, ...]}
 *     onReset={() => { ... }}
 *   />
 *
 * 设计要点:
 * - 整条工具栏统一 `size="sm"`,与 03-web「禁止手动加 h-xx」一致
 * - 搜索框 / Select / Button 不挂 label,统一占位符
 * - 重置按钮 `variant="flat"`,与列表其他按钮一致
 * - 父组件管理所有 state,本组件只做透传,避免重复实现
 */
import { useCallback, useState } from 'react';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RangeCalendar,
  Select,
  SelectItem,
  TimeInput,
} from '@heroui/react';
import { ArrowPathIcon, CalendarDaysIcon, ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  CalendarDate,
  CalendarDateTime,
  getLocalTimeZone,
  startOfWeek,
  endOfWeek,
  toCalendarDate,
  toCalendarDateTime,
  today,
  Time,
} from '@internationalized/date';

export interface FilterOption {
  key: string;
  label: string;
}

export interface FilterGroupSpec {
  label: string;
  /** 当前选中值(单选):option.key */
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

export interface DateRangeValue {
  start: CalendarDateTime | null;
  end: CalendarDateTime | null;
}

export interface DateRangeSpec {
  label: string;
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  /** 是否包含时分（默认 false，只选日期） */
  withTime?: boolean;
}

export interface SortSpec<TField extends string = string> {
  fields: Array<{ key: TField; label: string }>;
  value: TField;
  onChange: (value: TField) => void;
  dir: 'ASC' | 'DESC';
  onDirChange: (dir: 'ASC' | 'DESC') => void;
  /** 客户端排序提示:切换客户端排序字段时建议跳回第一页 */
  clientSortHint?: string;
  /** 当前激活的客户端排序字段(用于 UI 灰显) */
  clientSortKeys?: TField[];
}

interface Props {
  /** 搜索框占位符；不传则不渲染搜索框 */
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  /** 搜索框 aria-label(默认 = searchPlaceholder) */
  searchAriaLabel?: string;
  /** 可选:排序配置;不传则不渲染排序控件 */
  sort?: SortSpec;
  /** 可选:筛选组;不传则不渲染筛选控件 */
  filters?: FilterGroupSpec[];
  /** 可选:时间范围筛选(RangeCalendar + 快捷预设) */
  dateRange?: DateRangeSpec;
  /** 可选:搜索按钮回调(用于“点击搜索”场景) */
  onSearch?: () => void;
  /** 可选:重置回调;不传则不渲染重置按钮 */
  onReset?: () => void;
}

export default function SearchFilterBar({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  searchAriaLabel,
  sort,
  filters,
  dateRange,
  onSearch,
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchPlaceholder && (
        <Input
          size="sm"
          aria-label={searchAriaLabel ?? searchPlaceholder}
          placeholder={searchPlaceholder}
          value={searchValue ?? ''}
          onValueChange={(v) => onSearchChange?.(v)}
          variant="bordered"
          className="w-56"
          startContent={<MagnifyingGlassIcon className="h-4 w-4 text-foreground-400" />}
        />
      )}


      {filters?.map((f) => (
        <Select
          key={f.label}
          size="sm"
          aria-label={f.label}
          placeholder={f.label}
          variant="bordered"
          className="w-28"
          selectedKeys={[f.value]}
          onSelectionChange={(keys) => f.onChange(Array.from(keys)[0] as string)}
        >
          {f.options.map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
      ))}

      {dateRange && (
        <DateRangeFilter
          label={dateRange.label}
          value={dateRange.value}
          onChange={dateRange.onChange}
          withTime={dateRange.withTime}
        />
      )}

      {sort && (
        <>
          <Select
            size="sm"
            aria-label="排序字段"
            placeholder="排序"
            variant="bordered"
            className="w-28"
            selectedKeys={[sort.value]}
            onSelectionChange={(keys) => sort.onChange(Array.from(keys)[0] as string)}
          >
            {sort.fields.map((f) => (
              <SelectItem key={f.key}>{f.label}</SelectItem>
            ))}
          </Select>
          <Select
            size="sm"
            aria-label="排序方向"
            placeholder="方向"
            variant="bordered"
            className="w-20"
            selectedKeys={[sort.dir]}
            onSelectionChange={(keys) =>
              sort.onDirChange(Array.from(keys)[0] as 'ASC' | 'DESC')
            }
          >
            <SelectItem key="ASC">升序</SelectItem>
            <SelectItem key="DESC">降序</SelectItem>
          </Select>
        </>
      )}
      {/* 搜索 */}
      {onSearch && (
        <Button size="sm" color="primary"
          startContent={<MagnifyingGlassIcon className="h-4 w-4" />}
          onPress={onSearch}>
        </Button>
      )}
      {/* 重置 */}
      {onReset && (
        <Button
          size="sm"
          variant="flat"
          startContent={<ArrowPathIcon className="h-4 w-4" />}
          onPress={onReset}
        >
        </Button>
      )}
    </div>
  );
}

/** 时间范围筛选器：Popover + RangeCalendar + 时分(TimeInput) + 快捷预设 */
function DateRangeFilter({
  label,
  value,
  onChange,
  withTime = false,
}: {
  label: string;
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  withTime?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const fmt = useCallback(
    (d: CalendarDateTime | null) => {
      if (!d) return '';
      const datePart = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
      if (!withTime) return datePart;
      return `${datePart} ${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`;
    },
    [withTime],
  );

  /** 把 CalendarDate 提升为 CalendarDateTime（时分默认 00:00 / 23:59） */
  const promote = useCallback(
    (d: CalendarDate, hour: number, minute: number) =>
      toCalendarDateTime(d).set({ hour, minute, second: 0, millisecond: 0 }),
    [],
  );

  const setPreset = useCallback(
    (preset: 'today' | 'yesterday' | '24h' | '72h' | '7d' | 'week') => {
      const tz = getLocalTimeZone();
      const t = today(tz);

      if (preset === 'today') {
        onChange({ start: promote(t, 0, 0), end: promote(t, 23, 59) });
        return;
      }
      if (preset === 'yesterday') {
        const y = t.subtract({ days: 1 });
        onChange({ start: promote(y, 0, 0), end: promote(y, 23, 59) });
        return;
      }
      if (preset === '24h') {
        const s = t.subtract({ days: 1 });
        onChange({ start: promote(s, 0, 0), end: promote(t, 23, 59) });
        return;
      }
      if (preset === '72h') {
        const s = t.subtract({ days: 3 });
        onChange({ start: promote(s, 0, 0), end: promote(t, 23, 59) });
        return;
      }
      if (preset === '7d') {
        const s = t.subtract({ days: 6 });
        onChange({ start: promote(s, 0, 0), end: promote(t, 23, 59) });
        return;
      }
      // week: 本周 周一~今天
      const ws = startOfWeek(t, 'zh-CN');
      const we = endOfWeek(t, 'zh-CN');
      onChange({
        start: promote(ws, 0, 0),
        end: promote(we > t ? t : we, 23, 59),
      });
    },
    [onChange, promote],
  );

  // 用于 RangeCalendar 的内部值（必须是 CalendarDate 形式）
  const startDate = value.start ? toCalendarDate(value.start) : today(getLocalTimeZone());
  const endDate = value.end ? toCalendarDate(value.end) : startDate;

  const updateStartTime = (hour: number, minute: number) => {
    if (!value.start) return;
    onChange({ ...value, start: value.start.set({ hour, minute, second: 0, millisecond: 0 }) });
  };
  const updateEndTime = (hour: number, minute: number) => {
    if (!value.end) return;
    onChange({ ...value, end: value.end.set({ hour, minute, second: 0, millisecond: 0 }) });
  };

  return (
    <Popover placement="bottom-start" isOpen={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>
        <Button size="sm" variant="bordered" startContent={<CalendarDaysIcon className="h-4 w-4" />}>
          <span className="text-xs text-foreground-600">
            {value.start && value.end
              ? `${fmt(value.start)} ~ ${fmt(value.end)}`
              : label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2">
        <div className="flex flex-col gap-2">
          <Select
            size="sm"
            aria-label="快捷范围"
            placeholder="快捷范围"
            variant="bordered"
            className="w-36"
            onSelectionChange={(keys) => {
              const k = Array.from(keys)[0] as string;
              if (k) setPreset(k as Parameters<typeof setPreset>[0]);
            }}
          >
            <SelectItem key="today">今天</SelectItem>
            <SelectItem key="yesterday">昨天</SelectItem>
            <SelectItem key="24h">24小时</SelectItem>
            <SelectItem key="72h">72小时</SelectItem>
            <SelectItem key="7d">7天</SelectItem>
            <SelectItem key="week">本周</SelectItem>
          </Select>
          <RangeCalendar
            aria-label={label}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value={{ start: startDate, end: endDate } as any}
            onChange={(range) => {
              const prevStart = value.start;
              const prevEnd = value.end;
              const newStart = range.start
                ? toCalendarDateTime(range.start).set({
                  hour: prevStart?.hour ?? 0,
                  minute: prevStart?.minute ?? 0,
                  second: 0,
                  millisecond: 0,
                })
                : null;
              const newEnd = range.end
                ? toCalendarDateTime(range.end).set({
                  hour: prevEnd?.hour ?? 23,
                  minute: prevEnd?.minute ?? 59,
                  second: 0,
                  millisecond: 0,
                })
                : null;
              onChange({ start: newStart, end: newEnd });
            }}
          />

          {withTime && value.start && value.end && (
            <div className="flex flex-col gap-2 rounded-lg border border-divider p-2">
              <div className="flex items-center gap-2 text-xs text-foreground-500">
                <ClockIcon className="h-3.5 w-3.5" />
                时分
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TimeInput
                  size="sm"
                  variant="bordered"
                  aria-label="开始时分"
                  value={new Time(value.start.hour, value.start.minute)}
                  onChange={(t) => t && updateStartTime(t.hour, t.minute)}
                  hourCycle={24}
                  granularity="minute"
                />
                <TimeInput
                  size="sm"
                  variant="bordered"
                  aria-label="结束时分"
                  value={new Time(value.end.hour, value.end.minute)}
                  onChange={(t) => t && updateEndTime(t.hour, t.minute)}
                  hourCycle={24}
                  granularity="minute"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="flat"
              startContent={<ArrowPathIcon className="h-4 w-4" />}
              onPress={() => {
                onChange({ start: null, end: null });
                setIsOpen(false);
              }}
            >
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}