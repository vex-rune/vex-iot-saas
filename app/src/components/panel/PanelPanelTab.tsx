import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, addToast } from '@heroui/react';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { getDevicePoints } from '@/api/devices';
import { chainToPromise } from '@/hooks/useQueryList';
import type { PointDefinition } from '@/types/api';
import PanelRenderer from './PanelRenderer';
import PanelEditor from './PanelEditor';
import { parsePanelConfig, panelConfigSchema } from './types';
import type { PanelConfig } from './types';

// 持久化接入点：当前以 localStorage 暂存草稿。
// 后端面板字段就绪后，将 readDraft/saveDraft 替换为设备字段读写即可（序列化格式不变）。
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

export default function PanelPanelTab({
  deviceId,
  editing,
  onEditingChange,
}: {
  deviceId: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const [config, setConfig] = useState<PanelConfig>(() => parsePanelConfig(readDraft(deviceId)));
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const pointsQuery = useQuery({
    queryKey: ['device.points', deviceId],
    queryFn: () => chainToPromise(getDevicePoints(deviceId)),
    enabled: !!deviceId,
  });
  const points: PointDefinition[] = pointsQuery.data ?? [];

  // config 与草稿的结构比较（两者都经 zod 清洗，结构一致即可比）
  const isSessionDirty = () => {
    try {
      return JSON.stringify(config) !== JSON.stringify(parsePanelConfig(readDraft(deviceId)));
    } catch {
      return true;
    }
  };

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
      <div className="flex justify-end">
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
