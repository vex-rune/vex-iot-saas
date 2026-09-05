import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from '@heroui/react';
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import type { SeriesPoint } from '../../useWidgetData';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 把一个 Date 向下对齐到指定毫秒粒度的整点 */
function floorTo(d: Date, granularityMs: number): number {
  return Math.floor(d.getTime() / granularityMs) * granularityMs;
}

/** 根据时间跨度自适应 X 轴粒度（毫秒） */
function pickGranularity(spanMs: number): number {
  if (spanMs <= 6 * HOUR) return 15 * MIN;      // ≤ 6 小时 → 15 分钟一刻度
  if (spanMs <= 12 * HOUR) return 30 * MIN;     // ≤ 12 小时 → 30 分钟
  if (spanMs <= DAY) return HOUR;               // ≤ 1 天 → 1 小时
  if (spanMs <= 3 * DAY) return 3 * HOUR;       // ≤ 3 天 → 3 小时
  if (spanMs <= 7 * DAY) return 6 * HOUR;       // ≤ 7 天 → 6 小时
  if (spanMs <= 14 * DAY) return DAY;           // ≤ 14 天 → 1 天
  if (spanMs <= 60 * DAY) return 3 * DAY;       // ≤ 60 天 → 3 天
  return 7 * DAY;                                // > 60 天 → 7 天
}

/** 根据时间跨度自适应 X 轴 label 格式 */
function formatTick(ms: number, spanMs: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (spanMs <= DAY) {
    // ≤ 1 天：HH:mm
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (spanMs <= 7 * DAY) {
    // ≤ 7 天：MM-DD HH:mm
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (spanMs <= 60 * DAY) {
    // ≤ 60 天：MM-DD
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  // > 60 天：YYYY-MM-DD
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 根据粒度生成 ticks 数组（避免 Recharts 自动选 ticks 不可控） */
function buildTicks(startMs: number, endMs: number, granularityMs: number): number[] {
  if (endMs <= startMs) return [startMs];
  const ticks: number[] = [];
  const first = floorTo(new Date(startMs), granularityMs);
  let t = first < startMs ? first + granularityMs : first;
  while (t <= endMs) {
    ticks.push(t);
    t += granularityMs;
  }
  // 至多展示 10 个 tick,避免太挤
  if (ticks.length > 12) {
    const step = Math.ceil(ticks.length / 10);
    return ticks.filter((_, i) => i % step === 0);
  }
  return ticks;
}

/** 断点补全：在 series 中没有数据的等间隔位置插入 null,使折线断开 */
type DataRow = { time: number; value: number | null };

function fillGaps(
  series: SeriesPoint[],
  fromMs: number,
  toMs: number,
  granularityMs: number,
): DataRow[] {
  if (series.length === 0) return [];
  const GAP_THRESHOLD = 4 * granularityMs;
  const result: DataRow[] = [];

  // 起点到第一条数据之间的空白
  for (let t = fromMs; t < series[0].time; t += granularityMs) {
    result.push({ time: t, value: null });
  }

  for (let i = 0; i < series.length; i += 1) {
    const cur = series[i];
    result.push({ time: cur.time, value: cur.value });
    if (i < series.length - 1) {
      const next = series[i + 1];
      const gap = next.time - cur.time;
      if (gap > GAP_THRESHOLD) {
        // 断点区间按粒度插 null
        for (let t = cur.time + granularityMs; t < next.time; t += granularityMs) {
          result.push({ time: t, value: null });
        }
      }
    }
  }

  // 最后一条之后到 toMs
  const last = series[series.length - 1].time;
  for (let t = last + granularityMs; t <= toMs; t += granularityMs) {
    result.push({ time: t, value: null });
  }

  return result;
}

/** 图表本体（不含标题栏/全屏按钮，可复用于内嵌与全屏 Modal） */
function LineChartCanvas({
  data,
  domainStart,
  domainEnd,
  ticks,
  spanMs,
  heightOffset = 0,
}: {
  data: DataRow[];
  domainStart: number;
  domainEnd: number;
  ticks: number[];
  spanMs: number;
  /** 预留高度(px),全屏模式给标题栏/页脚留位 */
  heightOffset?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-foreground-500">
        暂无数据
      </div>
    );
  }
  const isFullscreen = heightOffset > 0;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 8, right: isFullscreen ? 32 : 12, bottom: 8, left: isFullscreen ? 8 : -16 }}
      >
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={[domainStart, domainEnd]}
          ticks={ticks}
          tickFormatter={(v) => formatTick(v as number, spanMs)}
          tick={{ fontSize: isFullscreen ? 13 : 10 }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: isFullscreen ? 13 : 10 }}
          tickLine={false}
          width={isFullscreen ? 60 : 48}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{ fontSize: isFullscreen ? 14 : 12, borderRadius: 8 }}
          labelFormatter={(l) => new Date(l as number).toLocaleString('zh-CN', { hour12: false })}
        />
        <Line
          type="stepAfter"
          dataKey="value"
          stroke="hsl(var(--heroui-primary))"
          strokeWidth={isFullscreen ? 2.5 : 2}
          dot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** 趋势曲线（时间窗过滤已由取数层完成，视图只做格式化） */
export function LineChartView({
  label,
  series,
  fromMs,
  toMs,
}: {
  /** 实体名/点位名；为空时使用占位文案，避免图表缺上下文 */
  label?: string;
  series: SeriesPoint[];
  /** 查询条件对应的时间范围（毫秒）。有传时 X 轴严格按此范围显示 */
  fromMs?: number;
  toMs?: number;
}) {
  // 计算 X 轴的 domain、跨度、粒度、tick 列表
  const { domainStart, domainEnd, spanMs, granularityMs, ticks } = useMemo(() => {
    let start = fromMs ?? 0;
    let end = toMs ?? 0;
    if (start == null || end == null || end <= start) {
      if (series.length > 0) {
        start = series[0].time;
        end = series[series.length - 1].time;
      } else {
        return { domainStart: 0, domainEnd: 0, spanMs: 1, granularityMs: HOUR, ticks: [0] };
      }
    }
    const span = Math.max(end - start, 1);
    const gran = pickGranularity(span);
    return {
      domainStart: start,
      domainEnd: end,
      spanMs: span,
      granularityMs: gran,
      ticks: buildTicks(start, end, gran),
    };
  }, [fromMs, toMs, series]);

  // 补全断点（前后空白 + 数据内大间隔）
  const data = useMemo(
    () => fillGaps(series, domainStart, domainEnd, granularityMs),
    [series, domainStart, domainEnd, granularityMs],
  );

  // 全屏 Modal
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="relative flex h-full w-full flex-col p-2">
      {/* 标题栏 + 全屏按钮 */}
      <div className="mb-1 flex shrink-0 items-center justify-between gap-1 px-1">
        <span className="truncate text-xs text-foreground-500">
          {label || '未配置点位名'}
        </span>
        {data.length > 0 && (
          <button
            type="button"
            aria-label="全屏查看"
            title="全屏查看"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-foreground-400 hover:bg-default-100 hover:text-foreground-600"
            onClick={() => setFullscreen(true)}
          >
            <ArrowsPointingOutIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <LineChartCanvas
          data={data}
          domainStart={domainStart}
          domainEnd={domainEnd}
          ticks={ticks}
          spanMs={spanMs}
        />
      </div>

      {/* 全屏 Modal */}
      <Modal
        isOpen={fullscreen}
        onClose={() => setFullscreen(false)}
        size="full"
        backdrop="opaque"
        placement="center"
        classNames={{ wrapper: 'p-0 sm:p-4' }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex items-center justify-between border-b border-divider">
                <span className="truncate text-base font-medium">
                  {label || '未配置点位名'}
                </span>
              </ModalHeader>
              <ModalBody className="p-2 sm:p-4">
                <div className="h-[calc(100vh-9rem)] w-full">
                  <LineChartCanvas
                    data={data}
                    domainStart={domainStart}
                    domainEnd={domainEnd}
                    ticks={ticks}
                    spanMs={spanMs}
                    heightOffset={120}
                  />
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}