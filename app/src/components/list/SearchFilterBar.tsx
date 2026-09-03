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
} from '@heroui/react';
import { ArrowPathIcon, CalendarDaysIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  CalendarDate,
  getLocalTimeZone,
  today,
  startOfWeek,
  endOfWeek,
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
  start: CalendarDate | null;
  end: CalendarDate | null;
}

export interface DateRangeSpec {
  label: string;
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
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
  /** 搜索框占位符 */
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  /** 搜索框 aria-label(默认 = searchPlaceholder) */
  searchAriaLabel?: string;
  /** 可选:排序配置;不传则不渲染排序控件 */
  sort?: SortSpec;
  /** 可选:筛选组;不传则不渲染筛选控件 */
  filters?: FilterGroupSpec[];
  /** 可选:时间范围筛选(RangeCalendar + 快捷预设) */
  dateRange?: DateRangeSpec;
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
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        size="sm"
        aria-label={searchAriaLabel ?? searchPlaceholder}
        placeholder={searchPlaceholder}
        value={searchValue}
        onValueChange={onSearchChange}
        variant="bordered"
        className="w-56"
        startContent={<MagnifyingGlassIcon className="h-4 w-4 text-foreground-400" />}
      />

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
        />
      )}

      {onReset && (
        <Button
          size="sm"
          variant="flat"
          startContent={<ArrowPathIcon className="h-4 w-4" />}
          onPress={onReset}
        >
          重置
        </Button>
      )}
    </div>
  );
}

/** 时间范围筛选器：Popover + RangeCalendar + 快捷预设 */
function DateRangeFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const fmt = useCallback(
    (d: CalendarDate | null) => (d ? d.toString() : ''),
    [],
  );

  const setPreset = useCallback(
    (preset: 'today' | 'yesterday' | '24h' | '72h' | '7d' | 'week') => {
      const tz = getLocalTimeZone();
      const t = today(tz);

      if (preset === 'today') {
        onChange({ start: t, end: t });
        return;
      }
      if (preset === 'yesterday') {
        const y = t.subtract({ days: 1 });
        onChange({ start: y, end: y });
        return;
      }
      if (preset === '24h') {
        const s = t.subtract({ days: 1 });
        onChange({ start: s, end: t });
        return;
      }
      if (preset === '72h') {
        const s = t.subtract({ days: 3 });
        onChange({ start: s, end: t });
        return;
      }
      if (preset === '7d') {
        const s = t.subtract({ days: 6 });
        onChange({ start: s, end: t });
        return;
      }
      // week: 本周 周一~今天
      const ws = startOfWeek(t, 'zh-CN');
      const we = endOfWeek(t, 'zh-CN');
      onChange({ start: ws, end: we > t ? t : we });
    },
    [onChange],
  );

  const start = value.start ?? today(getLocalTimeZone());
  const end = value.end ?? start;

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
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="flat" onPress={() => setPreset('today')}>今天</Button>
            <Button size="sm" variant="flat" onPress={() => setPreset('yesterday')}>昨天</Button>
            <Button size="sm" variant="flat" onPress={() => setPreset('24h')}>24小时</Button>
            <Button size="sm" variant="flat" onPress={() => setPreset('72h')}>72小时</Button>
            <Button size="sm" variant="flat" onPress={() => setPreset('7d')}>7天</Button>
            <Button size="sm" variant="flat" onPress={() => setPreset('week')}>本周</Button>
          </div>
          <RangeCalendar
            aria-label={label}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value={{ start, end } as any}
            onChange={(range) => {
              onChange({
                start: range.start ?? null,
                end: range.end ?? null,
              });
            }}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="flat"
              onPress={() => {
                onChange({ start: null, end: null });
                setIsOpen(false);
              }}
            >
              清除
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}