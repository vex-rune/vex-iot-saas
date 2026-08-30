import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from '@heroui/react';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { getDevicePoints } from '@/api/devices';
import { chainToPromise } from '@/hooks/useQueryList';
import type { PointDefinition } from '@/types/api';
import PanelRenderer from './PanelRenderer';
import PanelEditor from './PanelEditor';
import { parsePanelConfig, panelConfigSchema } from './types';
import type { PanelConfig } from './types';

// ─── 持久化层 ──────────────────────────────────────────────────────
//   当前状态:面板草稿走 localStorage,仅作为本地编辑恢复使用。
//   说明:
//     - 数据存当前浏览器;换浏览器/清缓存会丢失
//     - 后端"面板"字段就绪后,只需将 readDraft/saveDraft 替换为设备字段读写
//       (序列化格式不变,parsePanelConfig 无需调整)
//   视图层在编辑面板时显式打"演示" Chip,让用户清楚数据存储位置。
const draftKey = (deviceId: string) => `panel.draft.${deviceId}`;

function readDraft(deviceId: string): string | null {
  try {
    return localStorage.getItem(draftKey(deviceId));
  } catch {
    return null;
  }
}

function saveDraft(deviceId: string, config: PanelConfig): boolean {
  try {
    localStorage.setItem(draftKey(deviceId), JSON.stringify(config));
    return true;
  } catch {
    return false; // 存储不可用（隐私模式等）
  }
}

/** 安全 JSON.stringify:序列化失败时返回固定哨兵字符串,避免脏值绕过 dirty 比较 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '__err__';
  }
}

export default function PanelPanelTab({
  deviceId,
  editing,
  onEditingChange,
}: {
  deviceId: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  // 启动时读取 localStorage 中的"上次保存"作为初始值,并记下它的字符串快照
  // 用于后续"本次会话是否相对上次保存有未保存修改"的判断 — 避免每次 cancel 都重读 + stringify 一次
  // save 后即时更新 snapshot,使后续 cancel 行为正确
  const savedSnapshotRef = useRef<string>(safeStringify(readDraft(deviceId)));
  // deviceId 变化时重置 snapshot
  useEffect(() => {
    savedSnapshotRef.current = safeStringify(readDraft(deviceId));
  }, [deviceId]);
  const [config, setConfig] = useState<PanelConfig>(() => parsePanelConfig(readDraft(deviceId)));
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const pointsQuery = useQuery({
    queryKey: ['device.points', deviceId],
    queryFn: () => chainToPromise(getDevicePoints(deviceId)),
    enabled: !!deviceId,
  });
  const points: PointDefinition[] = pointsQuery.data ?? [];

  // 仅比较当前会话 config 与"上次保存"的快照;O(1) 字符串比对,不再走 localStorage / JSON.parse
  const isSessionDirty = () => safeStringify(config) !== savedSnapshotRef.current;

  const handleSave = () => {
    // 保存前整体校验：未完成配置的组件 + schema 校验，读写对称
    const invalid = config.widgets.filter(
      (w) => (w.binding.kind === 'point' && !w.binding.pointCode) || !w.title.trim(),
    );
    if (invalid.length > 0) {
      addToast({ title: `还有 ${invalid.length} 个组件未完成配置，请先应用后再保存`, color: 'warning' });
      return;
    }
    if (!panelConfigSchema.safeParse(config).success) {
      addToast({ title: '面板配置校验未通过，请检查组件配置', color: 'danger' });
      return;
    }
    if (!saveDraft(deviceId, config)) {
      addToast({ title: '保存失败，请检查浏览器存储权限', color: 'danger' });
      return;
    }
    // 保存成功:刷新 snapshot,后续 cancel 直接走"未修改"路径
    savedSnapshotRef.current = safeStringify(config);
    addToast({ title: '面板已保存', color: 'success' });
    onEditingChange(false);
  };

  const handleCancel = () => {
    if (isSessionDirty()) {
      setCancelConfirm(true);
      return;
    }
    doCancel();
  };

  const doCancel = () => {
    setConfig(parsePanelConfig(readDraft(deviceId)));
    onEditingChange(false);
  };

  // 编辑中刷新/关闭页面保护
  useEffect(() => {
    if (!editing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editing]);

  if (editing) {
    return (
      <>
        <PanelEditor
          deviceId={deviceId}
          config={config}
          points={points}
          pointsLoading={pointsQuery.isLoading}
          pointsError={pointsQuery.isError}
          onPointsRetry={() => pointsQuery.refetch()}
          saving={false}
          onConfigChange={setConfig}
          onSave={handleSave}
          onCancel={handleCancel}
        />
        {/* 放弃整个编辑会话确认 */}
        <Modal isOpen={cancelConfirm} size="sm" onClose={() => setCancelConfirm(false)}>
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">放弃未保存的修改？</ModalHeader>
            <ModalBody>
              <p className="text-sm text-foreground">
                本次编辑的布局与组件修改尚未保存，放弃后将恢复为上次保存的面板。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={() => setCancelConfirm(false)}>继续编辑</Button>
              <Button color="danger" onPress={() => { setCancelConfirm(false); doCancel(); }}>
                放弃修改
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Chip size="sm" variant="flat" color="warning">
          演示:面板数据存本地浏览器,清缓存会丢失
        </Chip>
        <Button
          size="sm"
          color="primary"
          startContent={<PencilSquareIcon className="h-4 w-4" />}
          onPress={() => onEditingChange(true)}
        >
          编辑面板
        </Button>
      </div>
      <PanelRenderer
        config={config}
        deviceId={deviceId}
        points={points}
        onRequestEdit={() => onEditingChange(true)}
      />
    </div>
  );
}
