import { useState } from 'react';
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export interface ValueMappingsCellProps {
  value: Array<{ key: string; label: string }>;
  onChange: (next: Array<{ key: string; label: string }>) => void;
}

/**
 * 行内的"值字典"编辑单元格:点 cell 弹出 Modal 编辑 key/label 对。
 * 实时值会先按 key 回查 label 再展示。主要用于 BOOL/STRING。
 */
export function ValueMappingsCell({ value, onChange }: ValueMappingsCellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Array<{ key: string; label: string }>>(value);
  // 打开时快照当前值;保存前不会动外部状态
  const handleOpen = () => {
    setDraft(value);
    setOpen(true);
  };
  const handleApply = () => {
    // 过滤空 key(label 允许空占位)
    const valid = draft.filter((m) => m.key.trim() !== '');
    onChange(valid);
    setOpen(false);
  };
  const handleCancel = () => setOpen(false);
  const summary = value.length === 0
    ? '—'
    : value.map((m) => `${m.key}=${m.label || '?'}`).join('，');
  return (
    <>
      <button
        type="button"
        className="w-full truncate rounded px-2 py-1 text-left text-xs text-foreground-600 hover:bg-default-100"
        title={summary}
        onClick={handleOpen}
      >
        {value.length === 0 ? (
          <span className="text-foreground-400">未配置</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {value.slice(0, 3).map((m, i) => (
              <Chip key={i} size="sm" variant="flat">
                {m.key}={m.label || '?'}
              </Chip>
            ))}
            {value.length > 3 && <span className="text-foreground-400">+{value.length - 3}</span>}
          </span>
        )}
      </button>
      <Modal isOpen={open} size="md" onClose={handleCancel} placement="center">
        <ModalContent>
          {(_onModalClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">值字典(值→展示)</ModalHeader>
              <ModalBody>
                <p className="text-xs text-foreground-500">
                  实时值会先按 key 回查 label 再展示。主要用于 BOOL/STRING。
                </p>
                <div className="flex flex-col gap-1.5">
                  {draft.length === 0 ? (
                    <p className="py-6 text-center text-xs text-foreground-400">暂无映射，点下方"新增映射"添加</p>
                  ) : (
                    draft.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Input
                          size="sm" variant="flat" placeholder="key(0/1/online)" value={m.key}
                          onValueChange={(v) => {
                            const next = draft.slice();
                            next[i] = { ...m, key: v };
                            setDraft(next);
                          }}
                          classNames={{ inputWrapper: 'bg-default-100' }}
                          className="w-28"
                        />
                        <span className="text-foreground-400">→</span>
                        <Input
                          size="sm" variant="flat" placeholder="展示文本(开/关/运行)" value={m.label}
                          onValueChange={(v) => {
                            const next = draft.slice();
                            next[i] = { ...m, label: v };
                            setDraft(next);
                          }}
                          classNames={{ inputWrapper: 'bg-default-100' }}
                          className="flex-1"
                        />
                        <Button
                          isIconOnly size="sm" variant="light" color="danger"
                          onPress={() => setDraft(draft.filter((_, idx) => idx !== i))}
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={handleCancel}>取消</Button>
                <Button variant="flat" color="primary"
                  startContent={<PlusIcon className="h-3 w-3" />}
                  onPress={() => setDraft([...draft, { key: '', label: '' }])}>
                  新增映射
                </Button>
                <Button color="primary" onPress={handleApply}>确定</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
