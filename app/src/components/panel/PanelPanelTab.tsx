import {useEffect, useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Skeleton,} from '@heroui/react';
import {toastError, toastSuccess, toastWarning} from '@/lib/toast';
import {PencilSquareIcon} from '@heroicons/react/24/outline';
import {getDevicePoints, getPanelConfig, savePanelConfig} from '@/services/deviceService';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {useBeforeUnload} from '@/hooks/common/useBeforeUnload';
import type {PointDefinition} from '@/types/api';
import PanelRenderer from './PanelRenderer';
import PanelEditor from './PanelEditor';
import type {PanelConfig} from './types';
import {panelConfigSchema, parsePanelConfig} from './types';

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
  fromSeconds,
  toSeconds,
}: {
  deviceId: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  /** 历史曲线时间区间(可选,默认全量) */
  fromSeconds?: number;
  toSeconds?: number;
}) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<PanelConfig>({ version: 1, widgets: [] });
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // 从后端获取面板配置
  const panelQuery = useQuery({
    queryKey: ['device.panel-config', deviceId],
    queryFn: () => chainToPromise(getPanelConfig(deviceId)),
    enabled: !!deviceId,
  });

  // 面板配置加载完成后更新本地状态
  const savedSnapshotRef = useRef<string>(safeStringify(null));
  useEffect(() => {
    if (panelQuery.data) {
      const parsed = parsePanelConfig(panelQuery.data.panelConfig);
      setConfig(parsed);
      savedSnapshotRef.current = safeStringify(parsed);
    } else if (panelQuery.data === null) {
      const empty = { version: 1, widgets: [] } as PanelConfig;
      setConfig(empty);
      savedSnapshotRef.current = safeStringify(empty);
    }
  }, [panelQuery.data]);

  const pointsQuery = useQuery({
    queryKey: ['device.points', deviceId],
    queryFn: () => chainToPromise(getDevicePoints(deviceId)),
    enabled: !!deviceId,
  });
  const points: PointDefinition[] = pointsQuery.data ?? [];

  // 保存到后端 — 直接传 PanelConfig 对象,由 axios 自动 JSON 序列化
  const saveMutation = useMutation({
    mutationFn: (configObj: PanelConfig) =>
      chainToPromise(savePanelConfig(deviceId, configObj as unknown as Record<string, unknown>)),
    onSuccess: () => {
      savedSnapshotRef.current = safeStringify(config);
        toastSuccess('面板已保存');
      onEditingChange(false);
      queryClient.invalidateQueries({ queryKey: ['device.panel-config', deviceId] });
    },
    onError: () => {
        toastError('保存失败，请稍后重试');
    },
  });

  const isSessionDirty = () => safeStringify(config) !== savedSnapshotRef.current;

  const handleSave = () => {
    const invalid = config.widgets.filter(
      (w) => (w.binding.kind === 'point' && !w.binding.pointCode) || !w.title.trim(),
    );
    if (invalid.length > 0) {
        toastWarning(`还有 ${invalid.length} 个组件未完成配置，请先应用后再保存`);
      return;
    }
    if (!panelConfigSchema.safeParse(config).success) {
        toastError('面板配置校验未通过，请检查组件配置');
      return;
    }
    saveMutation.mutate(config);
  };

  const handleCancel = () => {
    if (isSessionDirty()) {
      setCancelConfirm(true);
      return;
    }
    doCancel();
  };

  const doCancel = () => {
    if (panelQuery.data) {
      setConfig(parsePanelConfig(panelQuery.data.panelConfig));
    } else {
      setConfig({ version: 1, widgets: [] } as PanelConfig);
    }
    onEditingChange(false);
  };

  // 编辑中刷新/关闭页面保护
  useBeforeUnload(editing);

  // 加载中状态
  if (panelQuery.isLoading) {
    return (
      <div className="rounded-2xl bg-content1 p-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

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
          saving={saveMutation.isPending}
          onConfigChange={setConfig}
          onSave={handleSave}
          onCancel={handleCancel}
        />
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
      <div className="flex items-center justify-end">
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
        fromSeconds={fromSeconds}
        toSeconds={toSeconds}
        onRequestEdit={() => onEditingChange(true)}
      />
    </div>
  );
}
