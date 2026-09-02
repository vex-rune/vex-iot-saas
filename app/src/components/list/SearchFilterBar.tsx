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
import {
  Button,
  Input,
  Select,
  SelectItem,
} from '@heroui/react';
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

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