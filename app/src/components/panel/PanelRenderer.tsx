import { memo, useCallback, useEffect, useMemo, useRef, useState, Component } from 'react';
import type { ReactNode } from 'react';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Button,
  Skeleton,
} from '@heroui/react';
import {
  ReactGridLayout,
  WidthProvider,
} from 'react-grid-layout/legacy';
import type { Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { PointDefinition } from '@/types/api';
import type { DataSource, PanelConfig, PluginKind, WidgetInstance } from './types';
import {
  useRealtimePoint,
  useRealtimeSeries,
  useHistorySeries,
  useDevicePanelStatus,
  useControlPoint,
  parseBoolValue,
} from './useWidgetData';
import {
  SwitchLightView,
  ControlSwitchView,
  StatusBadgeView,
  MetricValueView,
  LineChartView,
  GaugeView,
} from './widgets';

// RGL 2.x：通过 legacy 出口使用 v1 扁平 props（内部转换为 v2 接口），WidthProvider 自动测量容器宽度
const Grid = WidthProvider(ReactGridLayout);

/** 手机端堆叠高度（按插件差异化，min-h 允许内容撑开） */
const MOBILE_HEIGHT: Record<PluginKind, string> = {
  'switch-light': 'min-h-36',
  'control-switch': 'min-h-36',
  'status-badge': 'min-h-28',
  'metric-value': 'min-h-32',
  'line-chart': 'min-h-56',
  gauge: 'min-h-48',
};

export interface PanelRendererProps {
  config: PanelConfig;
  deviceId: string;
  points: PointDefinition[];
  editable?: boolean;
  onConfigChange?: (config: PanelConfig) => void;
  onConfigure?: (id: string) => void;
  onRemove?: (id: string) => void;
  /** 查看态空面板时点击整块进入编辑 */
  onRequestEdit?: () => void;
}

/** widget 显示标签：自定义标题 > 点位名 > 设备属性名 */
function widgetLabel(widget: WidgetInstance, pointDef?: PointDefinition): string {
  if (widget.title) return widget.title;
  if (widget.binding.kind === 'point' && pointDef) return pointDef.pointName;
  if (widget.binding.kind === 'device') {
    const names: Record<string, string> = {
      online: '在线状态',
      enabled: '启用状态',
      lastHeartbeatAt: '最后心跳',
    };
    return names[widget.binding.field] ?? '设备属性';
  }
  return '';
}

function WidgetSkeleton() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-4">
      <Skeleton className="h-3 w-1/3 rounded-medium" />
      <Skeleton className="h-8 w-1/2 rounded-medium" />
    </div>
  );
}

function WidgetError({ text = '数据加载失败' }: { text?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-danger">{text}</div>
  );
}

/** 渲染故障边界：单个 widget 插件异常不击穿整页 */
class WidgetErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return <WidgetError text="组件渲染异常" />;
    return this.props.children;
  }
}

/** 单个 widget 的分发入口 */
function WidgetBody({
  widget,
  deviceId,
  pointDef,
  editable,
}: {
  widget: WidgetInstance;
  deviceId: string;
  pointDef?: PointDefinition;
  editable: boolean;
}) {
  const { binding } = widget;
  const label = widgetLabel(widget, pointDef);

  if (binding.kind === 'point') {
    if (!binding.pointCode) {
      return (
        <div className="flex h-full items-center justify-center p-3 text-center text-xs text-warning">
          未绑定点位，请在编辑模式下配置
        </div>
      );
    }
    return (
      <PointWidgetBody
        widget={widget}
        deviceId={deviceId}
        pointCode={binding.pointCode}
        pointDef={pointDef}
        label={label}
        editable={editable}
      />
    );
  }
  return (
    <DeviceWidgetBody
      field={binding.field}
      plugin={widget.plugin}
      deviceId={deviceId}
      label={label}
    />
  );
}

/** 设备属性绑定的 widget */
function DeviceWidgetBody({
  field,
  plugin,
  deviceId,
  label,
}: {
  field: 'online' | 'enabled' | 'lastHeartbeatAt';
  plugin: PluginKind;
  deviceId: string;
  label: string;
}) {
  const { data: device, isLoading, isError } = useDevicePanelStatus(deviceId);
  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;

  if (field === 'online') {
    const value = device ? device.online === 'ONLINE' : undefined;
    if (plugin === 'switch-light') {
      return <SwitchLightView label={label} value={value} />;
    }
    return (
      <StatusBadgeView
        label={label}
        value={value === undefined ? undefined : value ? '在线' : '离线'}
        color={value === undefined ? 'default' : value ? 'success' : 'danger'}
      />
    );
  }
  if (field === 'enabled') {
    const value = device?.enabled;
    return (
      <StatusBadgeView
        label={label}
        value={value === undefined ? undefined : value ? '启用' : '禁用'}
        color={value === undefined ? 'default' : value ? 'success' : 'warning'}
      />
    );
  }
  return (
    <StatusBadgeView
      label={label}
      color="default"
      value={device?.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).toLocaleString('zh-CN', { hour12: false }) : undefined}
    />
  );
}

/** 点位绑定的 widget（按 plugin 纯分发，hooks 全部在叶子组件内保证调用稳定） */
function PointWidgetBody({
  widget,
  deviceId,
  pointCode,
  pointDef,
  label,
  editable,
}: {
  widget: WidgetInstance;
  deviceId: string;
  pointCode: string;
  pointDef?: PointDefinition;
  label: string;
  editable: boolean;
}) {
  switch (widget.plugin) {
    case 'switch-light':
    case 'status-badge':
    case 'metric-value':
      return (
        <RealtimeValueBody
          widget={widget}
          deviceId={deviceId}
          pointCode={pointCode}
          pointDef={pointDef}
          label={label}
        />
      );
    case 'control-switch':
      return (
        <ControlSwitchBody
          deviceId={deviceId}
          pointCode={pointCode}
          pointDef={pointDef}
          label={label}
          editable={editable}
          awaitTimeout={widget.props.awaitTimeout}
        />
      );
    case 'line-chart':
      return <LineChartBody widget={widget} deviceId={deviceId} pointCode={pointCode} pointDef={pointDef} label={label} />;
    case 'gauge':
      return <GaugeBody widget={widget} deviceId={deviceId} pointCode={pointCode} pointDef={pointDef} label={label} />;
    default:
      return null;
  }
}

/** 实时值类插件（开关灯/徽章/数值卡共用一次 realtime 订阅） */
function RealtimeValueBody({
  widget,
  deviceId,
  pointCode,
  pointDef,
  label,
}: {
  widget: WidgetInstance;
  deviceId: string;
  pointCode: string;
  pointDef?: PointDefinition;
  label: string;
}) {
  const { point, isLoading, isError } = useRealtimePoint(deviceId, pointCode);
  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;

  switch (widget.plugin) {
    case 'switch-light':
      return <SwitchLightView label={label} value={parseBoolValue(point?.rawValue)} />;
    case 'status-badge':
      return (
        <StatusBadgeView
          label={label}
          value={point?.displayValue || point?.rawValue}
          colorRules={widget.props.colorRules}
          noDataText={widget.props.noDataText}
          noDataColor={widget.props.noDataColor}
        />
      );
    case 'metric-value':
      return (
        <MetricValueView
          label={label}
          value={point?.displayValue || point?.rawValue}
          unit={pointDef?.unit}
          showUnit={widget.props.showUnit !== false}
        />
      );
    default:
      return null;
  }
}

/** 控制开关：编辑模式禁用 + 下发前 Modal 确认 + 未知状态禁用 + 只读点位提示 + 等待上报中间态 */
function ControlSwitchBody({
  deviceId,
  pointCode,
  pointDef,
  label,
  editable,
  awaitTimeout,
}: {
  deviceId: string;
  pointCode: string;
  pointDef?: PointDefinition;
  label: string;
  editable: boolean;
  /** 等待设备上报超时（秒），默认 10s；实际约等于设备上报周期 */
  awaitTimeout?: number;
}) {
  const { point, isLoading, isError } = useRealtimePoint(deviceId, pointCode);
  const mutation = useControlPoint(deviceId);
  const [confirmNext, setConfirmNext] = useState<boolean | null>(null);
  // 下发成功 → 设备上报前的中间态（记录期望值，轮询到位或超时后解除）
  const [awaiting, setAwaiting] = useState<boolean | null>(null);

  useEffect(() => {
    if (awaiting === null) return;
    // 轮询值与期望一致 → 设备已上报
    if (parseBoolValue(point?.rawValue) === awaiting) {
      setAwaiting(null);
      return;
    }
    const timer = setTimeout(() => setAwaiting(null), (awaitTimeout ?? 10) * 1000);
    return () => clearTimeout(timer);
  }, [awaiting, point?.rawValue, awaitTimeout]);

  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;
  const value = parseBoolValue(point?.rawValue);
  // hint 只在确定点位为只读时显示（点位定义加载中不误报）
  const readOnlyHint = !editable && pointDef?.access === 'RO' ? '只读点位，不可控制' : undefined;

  return (
    <>
      <ControlSwitchView
        label={label}
        value={value}
        disabled={pointDef?.access !== 'RW' || editable}
        pending={mutation.isPending}
        awaiting={awaiting}
        hint={readOnlyHint}
        onToggle={(next) => setConfirmNext(next)}
      />
      <Modal isOpen={confirmNext !== null} size="sm" onClose={() => setConfirmNext(null)}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">确认下发控制</ModalHeader>
          <ModalBody>
            <p className="text-sm text-foreground">
              将「{label}」设为 <b>{confirmNext ? '开' : '关'}</b>，指令将立即下发到设备。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setConfirmNext(null)}>取消</Button>
            <Button
              color="primary"
              isLoading={mutation.isPending}
              onPress={() => {
                if (confirmNext === null) return;
                const expected = confirmNext;
                mutation.mutate(
                  { pointCode, next: expected },
                  {
                    onSuccess: () => {
                      setConfirmNext(null);
                      setAwaiting(expected);
                    },
                  },
                );
              }}
            >
              确认下发
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

/** 曲线/仪表按 source 取数的公共参数 */
interface SeriesBodyProps {
  deviceId: string;
  pointCode: string;
  label: string;
  range: string;
  limit: number;
  min?: number;
  max?: number;
  unit?: string;
}

/** 曲线：source → 专用取数组件注册表（新增 source 只加一行） */
const LINE_BODIES: Record<DataSource, React.FC<SeriesBodyProps>> = {
  history: HistoryLineChartBody,
  realtime: RealtimeLineChartBody,
};

function HistoryLineChartBody({ deviceId, pointCode, label, range, limit }: SeriesBodyProps) {
  const windowed = range === '1h' || range === '6h' || range === '24h' ? range : undefined;
  const { series, isLoading, isError } = useHistorySeries(deviceId, pointCode, limit, windowed);
  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;
  return <LineChartView label={label} series={series} />;
}

function RealtimeLineChartBody({ deviceId, pointCode, label }: SeriesBodyProps) {
  const { series } = useRealtimeSeries(deviceId, pointCode);
  return <LineChartView label={label} series={series} />;
}

function LineChartBody({
  widget,
  deviceId,
  pointCode,
  pointDef,
  label,
}: {
  widget: WidgetInstance;
  deviceId: string;
  pointCode: string;
  pointDef?: PointDefinition;
  label: string;
}) {
  const Body = LINE_BODIES[widget.source];
  return (
    <Body
      deviceId={deviceId}
      pointCode={pointCode}
      label={label}
      range={widget.props.range ?? '24h'}
      limit={widget.props.limit ?? 200}
      unit={pointDef?.unit}
    />
  );
}

/** 仪表：source → 专用取数组件注册表 */
const GAUGE_BODIES: Record<DataSource, React.FC<SeriesBodyProps>> = {
  realtime: RealtimeGaugeBody,
  history: HistoryGaugeBody,
};

function RealtimeGaugeBody({ deviceId, pointCode, label, min, max, unit }: SeriesBodyProps) {
  const { point, isLoading, isError } = useRealtimePoint(deviceId, pointCode);
  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;
  const value = Number(point?.rawValue);
  return (
    <GaugeView label={label} value={Number.isNaN(value) ? undefined : value} min={min} max={max} unit={unit} />
  );
}

function HistoryGaugeBody({ deviceId, pointCode, label, min, max, unit }: SeriesBodyProps) {
  const { series, isLoading, isError } = useHistorySeries(deviceId, pointCode, 1);
  if (isLoading) return <WidgetSkeleton />;
  if (isError) return <WidgetError />;
  return <GaugeView label={label} value={series[series.length - 1]?.value} min={min} max={max} unit={unit} />;
}

function GaugeBody({
  widget,
  deviceId,
  pointCode,
  pointDef,
  label,
}: {
  widget: WidgetInstance;
  deviceId: string;
  pointCode: string;
  pointDef?: PointDefinition;
  label: string;
}) {
  const Body = GAUGE_BODIES[widget.source];
  return (
    <Body
      deviceId={deviceId}
      pointCode={pointCode}
      label={label}
      range={widget.props.range ?? '24h'}
      limit={widget.props.limit ?? 1}
      min={widget.props.min}
      max={widget.props.max}
      unit={pointDef?.unit}
    />
  );
}

/** 编辑把手条上的操作按钮（保证触控目标 ≥ 24px） */
function HandleButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        // 阻止冒泡，避免触发 RGL 拖拽
        e.stopPropagation();
        onClick?.();
      }}
      className={`rounded-md p-1 focus-visible:outline-2 focus-visible:outline-primary ${
        danger ? 'hover:bg-danger-100' : 'hover:bg-primary-200/70'
      }`}
    >
      {children}
    </button>
  );
}

/** widget 卡片：编辑把手条走文档流（编辑/查看切换零布局跳变） */
const WidgetCard = memo(function WidgetCard({
  widget,
  deviceId,
  pointDef,
  editable,
  isMobile,
  onConfigure,
  onRemove,
  onMove,
}: {
  widget: WidgetInstance;
  deviceId: string;
  pointDef?: PointDefinition;
  editable: boolean;
  isMobile: boolean;
  onConfigure?: (id: string) => void;
  onRemove?: (id: string) => void;
  onMove?: (id: string, dir: 'up' | 'down') => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-content1 shadow-sm">
      {editable && (
        <div
          className={`panel-drag-handle flex h-8 shrink-0 items-center justify-between rounded-t-2xl bg-primary-100/80 px-2 ${
            isMobile ? '' : 'cursor-move'
          }`}
        >
          <span className="truncate text-xs text-primary-600">
            {widget.title || '未命名'}
          </span>
          <div className="flex items-center gap-0.5">
            {/* 上移/下移：手机端唯一排序手段，桌面端作为拖拽的键盘可达兜底 */}
            {onMove && (
              <>
                <HandleButton label="上移" onClick={() => onMove(widget.id, 'up')}>
                  <ChevronUpIcon className="h-4 w-4 text-primary-600" />
                </HandleButton>
                <HandleButton label="下移" onClick={() => onMove(widget.id, 'down')}>
                  <ChevronDownIcon className="h-4 w-4 text-primary-600" />
                </HandleButton>
              </>
            )}
            <HandleButton label="配置" onClick={() => onConfigure?.(widget.id)}>
              <PencilIcon className="h-4 w-4 text-primary-600" />
            </HandleButton>
            <HandleButton label="删除" danger onClick={() => onRemove?.(widget.id)}>
              <TrashIcon className="h-4 w-4 text-danger" />
            </HandleButton>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <WidgetErrorBoundary>
          <WidgetBody widget={widget} deviceId={deviceId} pointDef={pointDef} editable={editable} />
        </WidgetErrorBoundary>
      </div>
    </div>
  );
});

export default function PanelRenderer({
  config,
  deviceId,
  points,
  editable = false,
  onConfigChange,
  onConfigure,
  onRemove,
  onRequestEdit,
}: PanelRendererProps) {
  const isMobile = useIsMobile();
  const pointMap = useMemo(() => new Map(points.map((p) => [p.pointCode, p])), [points]);

  // 上移/下移：交换排序后相邻两项的 y（单列语义，桌面/手机通用）
  const moveWidget = useCallback(
    (id: string, dir: 'up' | 'down') => {
      if (!onConfigChange) return;
      const sorted = [...config.widgets].sort(
        (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
      );
      const idx = sorted.findIndex((w) => w.id === id);
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      onConfigChange({
        ...config,
        widgets: config.widgets.map((w) => {
          if (w.id === a.id) return { ...w, layout: { ...w.layout, y: b.layout.y } };
          if (w.id === b.id) return { ...w, layout: { ...w.layout, y: a.layout.y } };
          return w;
        }),
      });
    },
    [config, onConfigChange],
  );

  if (config.widgets.length === 0) {
    return (
      <Button
        fullWidth
        variant="light"
        isDisabled={editable}
        onPress={onRequestEdit}
        className="h-auto rounded-2xl bg-content1 py-10 text-sm text-foreground-400"
      >
        {editable ? '点击「添加组件」开始搭建面板' : '面板还没有组件，点击开始搭建'}
      </Button>
    );
  }

  // 手机端：单列堆叠（按 y,x 排序），保证可读可点
  if (isMobile) {
    const sorted = [...config.widgets].sort(
      (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
    );
    return (
      <div className="flex flex-col gap-3">
        {sorted.map((w) => (
          <div key={w.id} className={MOBILE_HEIGHT[w.plugin]}>
            <WidgetCard
              widget={w}
              deviceId={deviceId}
              pointDef={w.binding.kind === 'point' ? pointMap.get(w.binding.pointCode) : undefined}
              editable={editable}
              isMobile
              onConfigure={onConfigure}
              onRemove={onRemove}
              onMove={editable ? moveWidget : undefined}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DesktopGrid
      config={config}
      deviceId={deviceId}
      pointMap={pointMap}
      editable={editable}
      onConfigChange={onConfigChange}
      onConfigure={onConfigure}
      onRemove={onRemove}
      onMove={moveWidget}
    />
  );
}

/** 桌面端 RGL 自由布局（所见即所得） */
function DesktopGrid({
  config,
  deviceId,
  pointMap,
  editable,
  onConfigChange,
  onConfigure,
  onRemove,
  onMove,
}: {
  config: PanelConfig;
  deviceId: string;
  pointMap: Map<string, PointDefinition>;
  editable: boolean;
  onConfigChange?: (config: PanelConfig) => void;
  onConfigure?: (id: string) => void;
  onRemove?: (id: string) => void;
  onMove?: (id: string, dir: 'up' | 'down') => void;
}) {
  // 拖拽/缩放进行中不写回 config（避免拖动期间逐帧触发整树重渲染），停止时统一同步
  const draggingRef = useRef(false);

  const layout: Layout = useMemo(
    () =>
      config.widgets.map((w) => ({
        i: w.id,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
        minW: 2,
        minH: 2,
      })),
    [config.widgets],
  );

  const syncLayout = useCallback(
    (next: Layout) => {
      if (!editable || !onConfigChange) return;
      const byId = new Map(next.map((n) => [n.i, n]));
      let changed = false;
      const widgets = config.widgets.map((w) => {
        const l = byId.get(w.id);
        if (!l) return w;
        if (w.layout.x !== l.x || w.layout.y !== l.y || w.layout.w !== l.w || w.layout.h !== l.h) {
          changed = true;
          return { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } };
        }
        return w;
      });
      if (changed) onConfigChange({ ...config, widgets });
    },
    [config, editable, onConfigChange],
  );

  // 拖动中 RGL 自持内部状态；此处兜底同步非拖拽引发的布局变化（如删除组件后的 compact 压实）
  const handleLayoutChange = useCallback(
    (next: Layout) => {
      if (draggingRef.current) return;
      syncLayout(next);
    },
    [syncLayout],
  );

  return (
    <Grid
      className="panel-grid"
      layout={layout}
      cols={12}
      rowHeight={36}
      margin={[12, 12]}
      compactType="vertical"
      isDraggable={editable}
      isResizable={editable}
      draggableHandle=".panel-drag-handle"
      onDragStart={() => {
        draggingRef.current = true;
      }}
      onDragStop={(next) => {
        draggingRef.current = false;
        syncLayout(next);
      }}
      onResizeStart={() => {
        draggingRef.current = true;
      }}
      onResizeStop={(next) => {
        draggingRef.current = false;
        syncLayout(next);
      }}
      onLayoutChange={handleLayoutChange}
    >
      {config.widgets.map((w) => (
        <div key={w.id} className="h-full">
          <WidgetCard
            widget={w}
            deviceId={deviceId}
            pointDef={w.binding.kind === 'point' ? pointMap.get(w.binding.pointCode) : undefined}
            editable={editable}
            isMobile={false}
            onConfigure={onConfigure}
            onRemove={onRemove}
            onMove={editable ? onMove : undefined}
          />
        </div>
      ))}
    </Grid>
  );
}
