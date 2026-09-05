import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
} from '@heroui/react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export interface BatchTask {
  key: string;
  label: string;
  run: () => Promise<unknown>;
}

export interface BatchResult {
  key: string;
  label: string;
  ok: boolean;
  error?: string;
}

interface BatchProgressModalProps {
  open: boolean;
  title: string;
  tasks: BatchTask[];
  onClose: () => void;
  /** 所有任务跑完后调用（含成功与失败） */
  onComplete?: (results: BatchResult[]) => void;
}

/**
 * 通用批量保存进度弹窗：
 * - 逐条执行 tasks[i].run()（顺序执行避免并发写冲突）
 * - 显示当前进度、当前任务名、失败列表
 * - 未完成时锁定关闭（避免误关导致 UI 与状态不一致）
 */
export function BatchProgressModal({ open, title, tasks, onClose, onComplete }: BatchProgressModalProps) {
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [currentLabel, setCurrentLabel] = useState<string>('');
  const startedRef = useRef(false);

  // 每次打开弹窗时启动一次任务链
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    setResults([]);
    setDone(false);
    setRunning(true);
    setCurrentLabel(tasks[0]?.label ?? '');

    (async () => {
      const out: BatchResult[] = [];
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        setCurrentLabel(t.label);
        try {
          await t.run();
          out.push({ key: t.key, label: t.label, ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          out.push({ key: t.key, label: t.label, ok: false, error: msg });
        }
        setResults([...out]);
      }
      setRunning(false);
      setDone(true);
      setCurrentLabel('');
      onComplete?.(out);
    })();
  }, [open, tasks, onComplete]);

  if (!open) return null;

  const total = tasks.length;
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const failedItems = results.filter((r) => !r.ok);

  return (
    <Modal
      isOpen={open}
      onClose={() => {
        if (!running) onClose();
      }}
      placement="center"
      size="md"
      hideCloseButton={running}
      isDismissable={!running}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              {running ? title : done
                ? (failCount === 0 ? '保存完成' : (okCount === 0 ? '无法保存：请补全必填字段' : '保存完成'))
                : title}
              {done && (
                <span className="text-xs font-normal text-foreground-500">
                  成功 {okCount} 项，失败 {failCount} 项
                </span>
              )}
            </ModalHeader>
            <ModalBody>
              <Progress
                value={(results.length / total) * 100}
                color={failCount > 0 ? 'warning' : 'primary'}
                size="md"
                showValueLabel
                valueLabel={`${results.length} / ${total}`}
              />
              {running && currentLabel && (
                <p className="mt-2 text-xs text-foreground-500">
                  正在保存：<span className="text-foreground">{currentLabel}</span>
                </p>
              )}
              {failedItems.length > 0 && (
                <div className="mt-3 flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-lg border border-warning-200 bg-warning-50 p-2">
                  {failedItems.map((r) => (
                    <div key={r.key} className="flex items-start gap-1.5 text-xs">
                      <XCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{r.label}</span>
                        <span className="text-warning-700">{r.error}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {done && failCount === 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-success">
                  <CheckCircleIcon className="h-4 w-4" /> 全部保存成功
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="primary" isDisabled={running} onPress={onClose}>
                {running ? '保存中...' : '知道了'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
