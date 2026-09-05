import {
  Accordion,
  AccordionItem,
  Button,
  Chip,
  Divider,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@heroui/react';
import { PlusIcon } from '@heroicons/react/24/outline';

export interface PresetGroup {
  label: string;
  presets: Array<{ key: string; label: string }>;
}

export interface PresetAddButtonsProps {
  /** 预设分组(每组含 presets),由调用方从具体数据源装配 */
  groups: PresetGroup[];
  /** 用户点击预设触发:拿到 key 由调用方决定怎么把对应预设展开成行 */
  onAddPreset: (key: string) => void;
  /** 点击"空行":由调用方追加一行全空的草稿 */
  onAddBlank: () => void;
}

/**
 * "添加点位"按钮:Popover + Accordion,按分类折叠展示预设。
 * 调用方负责把 groups 与回调传进来,本组件只负责渲染与触发。
 */
export function PresetAddButtons({ groups, onAddPreset, onAddBlank }: PresetAddButtonsProps) {
  return (
    <Popover placement="bottom-end" offset={8} classNames={{ content: 'w-72 p-0' }}>
      <PopoverTrigger>
        <Button size="sm" color="primary"
          startContent={<PlusIcon className="h-4 w-4" />}>
          添加点位
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="px-3 pt-3">
          <div className="text-sm font-medium text-foreground">快捷添加点位</div>
          <div className="text-xs text-foreground-500">按分类展开，点击预设即追加一行</div>
        </div>
        <Divider className="my-2" />
        <Accordion
          selectionMode="multiple"
          defaultExpandedKeys={[]}
          itemClasses={{ base: 'px-3 py-0', trigger: 'py-2', content: 'pb-2 pt-0' }}
        >
          {groups.map((g) => (
            <AccordionItem
              key={g.label}
              aria-label={g.label}
              title={(
                <div className="flex items-center gap-2">
                  <Chip size="sm" variant="flat">{g.label}</Chip>
                  <span className="text-xs text-foreground-400">{g.presets.length} 个预设</span>
                </div>
              )}
            >
              <div className="flex flex-wrap gap-1.5">
                {g.presets.map((p) => (
                  <Button key={p.key} size="sm" variant="flat" color="primary"
                    onPress={() => onAddPreset(p.key)}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </AccordionItem>
          ))}
        </Accordion>
        <Divider className="my-2" />
        <div className="px-3 pb-3">
          <Button size="sm" variant="light" fullWidth
            startContent={<PlusIcon className="h-4 w-4" />}
            onPress={onAddBlank}>
            空行
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
