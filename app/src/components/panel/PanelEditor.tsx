import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Spinner,
  Switch,
  addToast,
  useDisclosure,
} from '@heroui/react';
import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { PointDefinition } from '@/types/api';
import {
  PLUGIN_KINDS,
  PLUGIN_META,
  DATA_SOURCE_LABELS,
  DEVICE_PLUGINS,
  BADGE_COLORS,
  BADGE_COLOR_LABELS,
  createWidgetInstance,
  pluginsForDataType,
  sourcesForPlugin,
} from './types';
import type { BadgeColor, DataSource, PanelConfig, PluginKind, WidgetInstance } from './types';
import PanelRenderer from './PanelRenderer';

export interface PanelEditorProps {
  deviceId: string;
  config: PanelConfig;
  points: PointDefinition[];
  pointsLoading: boolean;
  pointsError: boolean;
  onPointsRetry: () => void;
  saving: boolean;
  onConfigChange: (config: PanelConfig) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function PanelEditor({
  deviceId,
  config,
  points,
  pointsLoading,
  pointsError,
  onPointsRetry,
  saving,
  onConfigChange,
  onSave,
  onCancel,
}: PanelEditorProps) {
  const isMobile = useIsMobile();
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  // 标记「新增流程」中的 widget：Drawer 未应用即关闭时自动回滚，不留幽灵组件
  const [pendingNewId, setPendingNewId] = useState<string | null>(null);
  // 配置草稿提升到编辑器层：dirty 判断统一在此，供 Drawer 关闭/切换目标/删除拦截共用
  const [draft, setDraft] = useState<WidgetInstance | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const addPopover = useDisclosure();

  const configuringWidget = useMemo(
    () => config.widgets.find((w) => w.id === configuringId),
    [config.widgets, configuringId],
  );

  const dirty =
    !!configuringWidget && !!draft && JSON.stringify(draft) !== JSON.stringify(configuringWidget);

  // 打开/切换/关闭配置目标时重置草稿（重开同一 widget 不残留上次「取消」的内容）
  useEffect(() => {
    setDraft(configuringWidget ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在配置目标变化时重置
  }, [configuringId]);

  const addWidget = (plugin: PluginKind) => {
    const widget = createWidgetInstance(plugin, config.widgets.length);
    onConfigChange({ ...config, widgets: [...config.widgets, widget] });
    setConfiguringId(widget.id);
    setPendingNewId(widget.id);
    addPopover.onClose();
  };

  const handleDiscard = () => {
    // 新增流程中未应用即离开 → 回滚，不留「未绑定点位」的幽灵组件
    if (configuringId && pendingNewId === configuringId) {
      onConfigChange({
        ...config,
        widgets: config.widgets.filter((w) => w.id !== configuringId),
      });
    }
    setConfiguringId(null);
    setPendingNewId(null);
  };

  // 有未应用修改时先确认，防止静默丢配置
  const requestDiscard = () => {
    if (dirty) {
      setDiscardConfirm(true);
      return;
    }
    handleDiscard();
  };

  const handleApply = (next: WidgetInstance) => {
    if (!configuringId) return;
    onConfigChange({
      ...config,
      widgets: config.widgets.map((w) => (w.id === configuringId ? next : w)),
    });
    setConfiguringId(null);
    setPendingNewId(null);
  };

  // Drawer 开着且有未应用修改时，切换配置目标先拦截提示
  const requestConfigure = (id: string) => {
    if (dirty) {
      addToast({ title: '当前组件有未应用的修改，请先应用或取消', color: 'warning' });
      return;
    }
    setConfiguringId(id);
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    const id = removeTarget;
    setRemoveTarget(null);
    onConfigChange({ ...config, widgets: config.widgets.filter((w) => w.id !== id) });
    if (configuringId === id) {
      setConfiguringId(null);
      setPendingNewId(null);
    }
  };

  const removeTargetWidget = config.widgets.find((w) => w.id === removeTarget);

  return (
    <div className="flex flex-col gap-3">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover
          placement="bottom-start"
          isOpen={addPopover.isOpen}
          onOpenChange={addPopover.onOpenChange}
        >
          <PopoverTrigger>
            <Button size="sm" color="primary" startContent={<PlusIcon className="h-4 w-4" />}>
              添加组件
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex w-64 flex-col gap-1 p-2">
              {PLUGIN_KINDS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded-lg px-3 py-2 text-left hover:bg-default-100 focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={() => addWidget(p)}
                >
                  <div className="text-sm text-foreground">{PLUGIN_META[p].label}</div>
                  <div className="text-xs text-foreground-500">{PLUGIN_META[p].description}</div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {!isMobile && (
          <span className="hidden text-xs text-foreground-500 sm:inline">
            拖动顶部把手调整位置，拖拽右下角调整大小
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="flat" onPress={onCancel}>取消</Button>
          <Button size="sm" color="primary" isLoading={saving} onPress={onSave}>保存面板</Button>
        </div>
      </div>

      {/* 自由布局画布 */}
      <PanelRenderer
        config={config}
        deviceId={deviceId}
        points={points}
        editable
        onConfigChange={onConfigChange}
        onConfigure={requestConfigure}
        onRemove={setRemoveTarget}
      />

      {/* 组件配置 Drawer（常挂载，脏检查阻断遮罩/Esc 误关） */}
      <WidgetConfigDrawer
        widget={configuringWidget}
        open={!!configuringWidget}
        dirty={dirty}
        draft={draft}
        onDraftChange={setDraft}
        onApply={handleApply}
        onDiscard={requestDiscard}
        points={points}
        pointsLoading={pointsLoading}
        pointsError={pointsError}
        onPointsRetry={onPointsRetry}
        isNew={!!configuringWidget && pendingNewId === configuringWidget.id}
      />

      {/* 放弃修改确认 */}
      <Modal isOpen={discardConfirm} size="sm" onClose={() => setDiscardConfirm(false)}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">放弃修改？</ModalHeader>
          <ModalBody>
            <p className="text-sm text-foreground">
              当前组件有未应用的修改，放弃后将恢复为修改前的配置。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setDiscardConfirm(false)}>继续编辑</Button>
            <Button color="danger" onPress={() => { setDiscardConfirm(false); handleDiscard(); }}>
              放弃修改
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除组件确认 */}
      <Modal isOpen={removeTarget !== null} size="sm" onClose={() => setRemoveTarget(null)}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">删除组件</ModalHeader>
          <ModalBody>
            <p className="text-sm text-foreground">
              确认删除组件「{removeTargetWidget?.title || PLUGIN_META[removeTargetWidget?.plugin ?? 'status-badge'].label}」？
              删除后需保存面板才能生效。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setRemoveTarget(null)}>取消</Button>
            <Button color="danger" onPress={confirmRemove}>删除</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ─── 组件配置 Drawer ──────────────────────────────────────────────────

function WidgetConfigDrawer({
  widget,
  open,
  dirty,
  draft,
  onDraftChange,
  onApply,
  onDiscard,
  points,
  pointsLoading,
  pointsError,
  onPointsRetry,
  isNew,
}: {
  widget: WidgetInstance | undefined;
  open: boolean;
  dirty: boolean;
  draft: WidgetInstance | null;
  onDraftChange: Dispatch<SetStateAction<WidgetInstance | null>>;
  onApply: (widget: WidgetInstance) => void;
  onDiscard: () => void;
  points: PointDefinition[];
  pointsLoading: boolean;
  pointsError: boolean;
  onPointsRetry: () => void;
  /** 是否是新增组件（未保存到 config）；新增可改类型，已有则锁定 */
  isNew: boolean;
}) {
  const [pointSearch, setPointSearch] = useState('');

  const filteredPoints = useMemo(() => {
    const q = pointSearch.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (p) => p.pointName.toLowerCase().includes(q) || p.pointCode.toLowerCase().includes(q),
    );
  }, [points, pointSearch]);

  // 切换绑定/点位时，若当前插件不兼容则自动切到第一个可用项（仅新增组件，编辑已有组件时插件已锁定）
  const selectedPointCode = draft?.binding.kind === 'point' ? draft.binding.pointCode : undefined;
  useEffect(() => {
    if (!draft || !isNew) return;
    const sp = points.find((p) => p.pointCode === selectedPointCode);
    const plugins = draft.binding.kind === 'point'
      ? (sp ? pluginsForDataType(sp.dataType) : [...PLUGIN_KINDS])
      : DEVICE_PLUGINS;
    const sources = sourcesForPlugin(draft.plugin);
    if (!plugins.includes(draft.plugin)) {
      const fallback = plugins[0] ?? draft.plugin;
      onDraftChange((d) =>
        d
          ? {
              ...d,
              plugin: fallback,
              source: sourcesForPlugin(fallback)[0] ?? d.source,
            }
          : d,
      );
    } else if (!sources.includes(draft.source)) {
      onDraftChange((d) => (d ? { ...d, source: sources[0] ?? d.source } : d));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在绑定/插件变化时校正
  }, [draft?.binding.kind, selectedPointCode, draft?.plugin]);

  if (!widget || !draft) {
    return (
      <Drawer isOpen={false} placement="right" size="sm" onClose={onDiscard}>
        <DrawerContent />
      </Drawer>
    );
  }

  const selectedPoint = points.find((p) => p.pointCode === draft.binding.pointCode);
  const isPointBinding = draft.binding.kind === 'point';
  const availablePlugins: PluginKind[] = isPointBinding
    ? selectedPoint
      ? pluginsForDataType(selectedPoint.dataType)
      : [...PLUGIN_KINDS]
    : DEVICE_PLUGINS;
  const availableSources: DataSource[] = sourcesForPlugin(draft.plugin);
  const props = draft.props;

  const apply = () => {
    if (isPointBinding && !draft.binding.pointCode) {
      addToast({ title: '请选择要绑定的点位', color: 'warning' });
      return;
    }
    if (!draft.title.trim()) {
      addToast({ title: '请填写组件标题', color: 'warning' });
      return;
    }
    // 控制开关仅可绑定可控(RW)点位
    if (draft.plugin === 'control-switch' && selectedPoint && selectedPoint.access !== 'RW') {
      addToast({ title: '控制开关只能绑定可控(RW)点位，请重新选择', color: 'danger' });
      return;
    }
    if (draft.plugin === 'gauge' && props.min != null && props.max != null && props.max <= props.min) {
      addToast({ title: '最大值必须大于最小值', color: 'warning' });
      return;
    }
    // 过滤掉匹配值为空的规则，避免存入无效数据
    let nextProps = draft.props;
    if (nextProps.colorRules) {
      const rules = nextProps.colorRules.filter((r) => r.value.trim() !== '');
      nextProps = { ...nextProps, colorRules: rules.length > 0 ? rules : undefined };
    }
    onApply({ ...draft, title: draft.title.trim(), props: nextProps });
  };

  return (
    <Drawer
      isOpen={open}
      placement="right"
      size="md"
      isDismissable={!dirty}
      onClose={onDiscard}
    >
      <DrawerContent>
        <DrawerHeader className="flex flex-col gap-1">
          <span className="text-base">配置组件</span>
          <span className="text-xs font-normal text-foreground-500">
            {PLUGIN_META[draft.plugin].description}
          </span>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4">
          <Input
            label="组件标题"
            placeholder="显示在组件上的名称"
            value={draft.title}
            onValueChange={(v) => onDraftChange((d) => (d ? { ...d, title: v } : d))}
            variant="bordered"
            isRequired
          />

          {/* 数据绑定 */}
          <Select
            label="绑定类型"
            variant="bordered"
            selectedKeys={[draft.binding.kind]}
            onSelectionChange={(keys) => {
              const kind = Array.from(keys)[0] as 'point' | 'device';
              onDraftChange((d) =>
                d
                  ? kind === 'point'
                    ? { ...d, binding: { kind: 'point', pointCode: '' } }
                    : { ...d, binding: { kind: 'device', field: 'online' } }
                  : d,
              );
            }}
          >
            <SelectItem key="point">点表点位</SelectItem>
            <SelectItem key="device">设备属性</SelectItem>
          </Select>

          {isPointBinding ? (
            <>
              {pointsLoading ? (
                <div className="flex items-center gap-2 text-xs text-foreground-500">
                  <Spinner size="sm" /> 点位加载中…
                </div>
              ) : pointsError ? (
                <div className="flex items-center justify-between gap-2 text-xs text-danger">
                  点位加载失败
                  <Button size="sm" variant="flat" onPress={onPointsRetry}>重试</Button>
                </div>
              ) : (
                <>
                  <Input
                    size="sm"
                    placeholder="搜索点位名/编码"
                    value={pointSearch}
                    onValueChange={setPointSearch}
                    variant="bordered"
                    startContent={<MagnifyingGlassIcon className="h-4 w-4 text-foreground-400" />}
                  />
                  <Select
                    label="绑定点位"
                    placeholder={filteredPoints.length === 0 ? '无匹配点位' : '选择点位（标注数据类型）'}
                    variant="bordered"
                    selectedKeys={
                      draft.binding.kind === 'point' && draft.binding.pointCode
                        ? [draft.binding.pointCode]
                        : []
                    }
                    onSelectionChange={(keys) => {
                      const code = Array.from(keys)[0] as string;
                      onDraftChange((d) => (d ? { ...d, binding: { kind: 'point', pointCode: code } } : d));
                    }}
                  >
                    {filteredPoints.map((p) => (
                      <SelectItem
                        key={p.pointCode}
                        // 控制开关仅可选择可控(RW)点位
                        isDisabled={draft.plugin === 'control-switch' && p.access !== 'RW'}
                      >
                        {`${p.pointName}（${p.pointCode} · ${p.dataType}${p.access === 'RW' ? ' · 可控' : ''}）`}
                      </SelectItem>
                    ))}
                  </Select>
                </>
              )}
              {selectedPoint && (
                <div className="text-xs text-foreground-500">
                  数据类型：{selectedPoint.dataType}，可用插件：{availablePlugins.map((p) => PLUGIN_META[p].label).join('、')}
                </div>
              )}
            </>
          ) : (
            <Select
              label="设备属性"
              variant="bordered"
              selectedKeys={[draft.binding.kind === 'device' ? draft.binding.field : 'online']}
              onSelectionChange={(keys) => {
                const field = Array.from(keys)[0] as 'online' | 'enabled' | 'lastHeartbeatAt';
                onDraftChange((d) =>
                  d && d.binding.kind === 'device' ? { ...d, binding: { ...d.binding, field } } : d,
                );
              }}
            >
              <SelectItem key="online">在线状态</SelectItem>
              <SelectItem key="enabled">启用状态</SelectItem>
              <SelectItem key="lastHeartbeatAt">最后心跳</SelectItem>
            </Select>
          )}

          {/* 展示插件（按类型过滤）：编辑已有组件时锁定，不允许更改 */}
          <Select
            label={isNew ? '展示插件' : '展示插件（已有组件，类型不可更改）'}
            variant="bordered"
            isDisabled={!isNew}
            selectedKeys={[draft.plugin]}
            onSelectionChange={(keys) => {
              const plugin = Array.from(keys)[0] as PluginKind;
              onDraftChange((d) =>
                d ? { ...d, plugin, source: sourcesForPlugin(plugin)[0] ?? d.source } : d,
              );
            }}
          >
            {availablePlugins.map((p) => (
              <SelectItem key={p}>{PLUGIN_META[p].label}</SelectItem>
            ))}
          </Select>

          {/* 数据来源（按插件过滤） */}
          <Select
            label="数据来源"
            variant="bordered"
            description="history=历史表完整曲线，realtime=实时推送/会话内累积"
            selectedKeys={[draft.source]}
            isDisabled={availableSources.length <= 1}
            onSelectionChange={(keys) => {
              const source = Array.from(keys)[0] as DataSource;
              onDraftChange((d) => (d ? { ...d, source } : d));
            }}
          >
            {availableSources.map((s) => (
              <SelectItem key={s}>{DATA_SOURCE_LABELS[s]}</SelectItem>
            ))}
          </Select>

          {/* 插件参数 */}
          {draft.plugin === 'line-chart' && (
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="时间范围"
                variant="bordered"
                selectedKeys={[props.range ?? '24h']}
                onSelectionChange={(keys) => {
                  const range = Array.from(keys)[0] as '1h' | '6h' | '24h';
                  onDraftChange((d) => (d ? { ...d, props: { ...d.props, range } } : d));
                }}
              >
                <SelectItem key="1h">最近 1 小时</SelectItem>
                <SelectItem key="6h">最近 6 小时</SelectItem>
                <SelectItem key="24h">最近 24 小时</SelectItem>
              </Select>
              <Input
                label="数据点数"
                type="number"
                min={1}
                variant="bordered"
                value={props.limit != null ? String(props.limit) : ''}
                placeholder="默认 200"
                onValueChange={(v) => {
                  if (v === '') {
                    onDraftChange((d) => (d ? { ...d, props: { ...d.props, limit: undefined } } : d));
                    return;
                  }
                  const n = Math.floor(Number(v));
                  if (!Number.isFinite(n)) return;
                  onDraftChange((d) =>
                    d ? { ...d, props: { ...d.props, limit: Math.max(1, n) } } : d,
                  );
                }}
              />
            </div>
          )}

          {draft.plugin === 'gauge' && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="最小值"
                type="number"
                variant="bordered"
                value={props.min != null ? String(props.min) : ''}
                placeholder="默认 0"
                onValueChange={(v) => {
                  if (v === '') {
                    onDraftChange((d) => (d ? { ...d, props: { ...d.props, min: undefined } } : d));
                    return;
                  }
                  const n = Number(v);
                  if (!Number.isFinite(n)) return;
                  onDraftChange((d) => (d ? { ...d, props: { ...d.props, min: n } } : d));
                }}
              />
              <Input
                label="最大值"
                type="number"
                variant="bordered"
                value={props.max != null ? String(props.max) : ''}
                placeholder="默认 100"
                onValueChange={(v) => {
                  if (v === '') {
                    onDraftChange((d) => (d ? { ...d, props: { ...d.props, max: undefined } } : d));
                    return;
                  }
                  const n = Number(v);
                  if (!Number.isFinite(n)) return;
                  onDraftChange((d) => (d ? { ...d, props: { ...d.props, max: n } } : d));
                }}
              />
            </div>
          )}

          {draft.plugin === 'metric-value' && (
            <Switch
              size="sm"
              isSelected={props.showUnit !== false}
              onValueChange={(v) =>
                onDraftChange((d) => (d ? { ...d, props: { ...d.props, showUnit: v } } : d))
              }
            >
              显示单位
            </Switch>
          )}

          {/* 控制开关：等待上报超时 */}
          {draft.plugin === 'control-switch' && (
            <Input
              label="等待上报超时（秒）"
              type="number"
              min={1}
              max={120}
              variant="bordered"
              description="下发成功后到设备上报新值之间的等待期，超时后恢复可操作；建议略大于设备上报周期"
              value={props.awaitTimeout != null ? String(props.awaitTimeout) : ''}
              placeholder="默认 10 秒"
              onValueChange={(v) => {
                if (v === '') {
                  onDraftChange((d) => (d ? { ...d, props: { ...d.props, awaitTimeout: undefined } } : d));
                  return;
                }
                const n = Math.floor(Number(v));
                if (!Number.isFinite(n)) return;
                onDraftChange((d) =>
                  d ? { ...d, props: { ...d.props, awaitTimeout: Math.min(120, Math.max(1, n)) } } : d,
                );
              }}
            />
          )}

          {/* 状态徽章：自定义颜色规则（仅点位绑定，设备属性走内置语义色） */}
          {draft.plugin === 'status-badge' && isPointBinding && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">颜色规则</span>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<PlusIcon className="h-3.5 w-3.5" />}
                  onPress={() =>
                    onDraftChange((d) =>
                      d
                        ? {
                            ...d,
                            props: {
                              ...d.props,
                              colorRules: [
                                ...(d.props.colorRules ?? []),
                                { value: '', color: 'success' as BadgeColor },
                              ],
                            },
                          }
                        : d,
                    )
                  }
                >
                  添加规则
                </Button>
              </div>
              <p className="text-xs text-foreground-500">
                点位值与规则值完全一致时按规则变色；未命中任何规则显示主要蓝。
              </p>
              {(props.colorRules ?? []).map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    size="sm"
                    placeholder="匹配值，如 1 / a"
                    value={rule.value}
                    variant="bordered"
                    onValueChange={(v) =>
                      onDraftChange((d) => {
                        if (!d) return d;
                        const rules = [...(d.props.colorRules ?? [])];
                        rules[i] = { ...rules[i], value: v };
                        return { ...d, props: { ...d.props, colorRules: rules } };
                      })
                    }
                  />
                  <Select
                    size="sm"
                    aria-label="颜色"
                    variant="bordered"
                    selectedKeys={[rule.color]}
                    disallowEmptySelection
                    className="w-28"
                    onSelectionChange={(keys) => {
                      const color = Array.from(keys)[0] as BadgeColor;
                      onDraftChange((d) => {
                        if (!d) return d;
                        const rules = [...(d.props.colorRules ?? [])];
                        rules[i] = { ...rules[i], color };
                        return { ...d, props: { ...d.props, colorRules: rules } };
                      });
                    }}
                  >
                    {BADGE_COLORS.map((c) => (
                      <SelectItem key={c}>{BADGE_COLOR_LABELS[c]}</SelectItem>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    isIconOnly
                    variant="light"
                    aria-label="删除规则"
                    onPress={() =>
                      onDraftChange((d) => {
                        if (!d) return d;
                        const rules = (d.props.colorRules ?? []).filter((_, idx) => idx !== i);
                        return { ...d, props: { ...d.props, colorRules: rules.length > 0 ? rules : undefined } };
                      })
                    }
                  >
                    <TrashIcon className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              ))}

              {/* 无数据展示 */}
              <span className="mt-2 text-sm text-foreground">无数据时展示</span>
              <div className="flex items-center gap-2">
                <Input
                  size="sm"
                  placeholder="默认显示 -"
                  value={props.noDataText ?? ''}
                  variant="bordered"
                  onValueChange={(v) =>
                    onDraftChange((d) =>
                      d
                        ? { ...d, props: { ...d.props, noDataText: v === '' ? undefined : v } }
                        : d,
                    )
                  }
                />
                <Select
                  size="sm"
                  aria-label="无数据颜色"
                  variant="bordered"
                  selectedKeys={[props.noDataColor ?? 'default']}
                  disallowEmptySelection
                  className="w-28"
                  onSelectionChange={(keys) => {
                    const color = Array.from(keys)[0] as BadgeColor;
                    onDraftChange((d) => (d ? { ...d, props: { ...d.props, noDataColor: color } } : d));
                  }}
                >
                  {BADGE_COLORS.map((c) => (
                    <SelectItem key={c}>{BADGE_COLOR_LABELS[c]}</SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="flat" onPress={onDiscard}>取消</Button>
          <Button color="primary" onPress={apply}>应用</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
