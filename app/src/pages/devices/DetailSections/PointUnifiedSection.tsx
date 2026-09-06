/** 设备详情 - 点位页签 - 合并视图(点位设置 + 实时数据)。 */
import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Chip, Skeleton, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,} from '@heroui/react';
import {getDevicePoints} from '@/services/deviceService';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {EntityCard, FieldRow} from '@/components/ui/EntityCard';
import {useIsMobile} from '@/hooks/common/useMediaQuery';
import {useRealtimePointsList} from '@/services/deviceDataService';
import {formatRelativeTime} from '@/lib/format';
import type {PointDefinition} from '@/types/api';

const ACCESS_LABELS: Record<'RO' | 'RW', string> = { RO: '只读', RW: '读写' };

interface PointUnifiedSectionProps {
  deviceId: string;
}

export default function PointUnifiedSection({ deviceId }: PointUnifiedSectionProps) {
  const isMobile = useIsMobile();
  const { data: points, isLoading } = useQuery<PointDefinition[]>({
    queryKey: ['points', deviceId],
    queryFn: () => chainToPromise(getDevicePoints(deviceId)),
    enabled: !!deviceId,
  });

  const realtimeRows = useRealtimePointsList(deviceId, points);
  const realtimeByCode = useMemo(
    () => new Map(realtimeRows.map((r) => [r.pointCode, r])),
    [realtimeRows],
  );

  const rows = useMemo(() => {
    if (!points) return [];
    return [...points]
      .sort((a, b) => {
        const sa = a.sortOrder ?? Number.POSITIVE_INFINITY;
        const sb = b.sortOrder ?? Number.POSITIVE_INFINITY;
        if (sa !== sb) return sa - sb;
        return (a.pointCode ?? '').localeCompare(b.pointCode ?? '', 'zh-Hans-CN');
      })
      .map((p) => ({ point: p, rt: realtimeByCode.get(p.pointCode) }));
  }, [points, realtimeByCode]);

  const stats = useMemo(() => {
    const total = realtimeRows.length;
    const alive = realtimeRows.filter((r) => r.hasData).length;
    return { total, alive, missing: total - alive };
  }, [realtimeRows]);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-content1 p-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-full rounded-lg" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">
        该设备尚未配置点位
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-3 text-sm text-foreground-500">
        <span>共 {stats.total} 个点位</span>
        <Chip size="sm" variant="flat" color="success">在线 {stats.alive}</Chip>
        {stats.missing > 0 && (
          <Chip size="sm" variant="flat" color="warning">缺少实时数据 {stats.missing}</Chip>
        )}
      </div>

      {isMobile ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map(({ point, rt }) => {
            const hasRt = !!rt?.hasData;
            return (
              <EntityCard
                key={point.id}
                title={point.pointName || point.pointCode}
                subtitle={<code className="text-xs text-foreground-500">{point.pointCode}</code>}
                badge={hasRt
                  ? <Chip size="sm" variant="flat" color="success">在线</Chip>
                  : <Chip size="sm" variant="flat" color="warning">无数据</Chip>}
              >
                <FieldRow label="实时值" value={hasRt
                  ? <span className="font-mono text-base text-foreground-700">{rt!.value}{point.unit ? ` ${point.unit}` : ''}</span>
                  : <span className="text-xs text-foreground-400">缺少实时数据</span>} />
                <FieldRow label="更新于" value={hasRt
                  ? <span className="text-xs text-foreground-500">{formatRelativeTime(new Date(rt!.updatedAt))}</span>
                  : <span className="text-xs text-foreground-400">-</span>} />
                <FieldRow label="类型" value={
                  <Chip size="sm" variant="flat" color={point.dataType === 'BOOL' ? 'default' : 'primary'}>{point.dataType}</Chip>
                } />
                <FieldRow label="读写" value={
                  <Chip size="sm" variant="flat" color={point.access === 'RW' ? 'warning' : 'default'}>{ACCESS_LABELS[point.access] ?? point.access}</Chip>
                } />
                {point.groupLabel && <FieldRow label="分组" value={point.groupLabel} />}
                {point.description && <FieldRow label="描述" value={point.description} />}
              </EntityCard>
            );
          })}
        </div>
      ) : (
        <Table aria-label="点位(设置 + 实时)" isStriped classNames={{ wrapper: 'bg-content1 rounded-2xl' }}>
          <TableHeader>
            <TableColumn>名称</TableColumn>
            <TableColumn>编码</TableColumn>
            <TableColumn>类型</TableColumn>
            <TableColumn>读写</TableColumn>
            <TableColumn>实时值</TableColumn>
            <TableColumn>更新时间</TableColumn>
            <TableColumn>状态</TableColumn>
            <TableColumn className="hidden sm:table-cell">单位</TableColumn>
            <TableColumn className="hidden md:table-cell">分组</TableColumn>
          </TableHeader>
          <TableBody items={rows} emptyContent="暂无点位">
            {({ point, rt }) => {
              const hasRt = !!rt?.hasData;
              return (
                <TableRow key={point.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{point.pointName || point.pointCode}</span>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-foreground-600">{point.pointCode}</code>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={point.dataType === 'BOOL' ? 'default' : 'primary'}>
                      {point.dataType}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={point.access === 'RW' ? 'warning' : 'default'}>
                      {ACCESS_LABELS[point.access] ?? point.access}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {hasRt ? (
                      <span className="font-mono text-sm">{rt!.value}{point.unit ? ` ${point.unit}` : ''}</span>
                    ) : (
                      <span className="text-xs text-foreground-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasRt ? (
                      <span className="text-xs text-foreground-500" title={new Date(rt!.updatedAt).toLocaleString('zh-CN')}>
                        {formatRelativeTime(new Date(rt!.updatedAt))}
                      </span>
                    ) : (
                      <span className="text-xs text-foreground-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasRt ? (
                      <Chip size="sm" variant="flat" color="success">在线</Chip>
                    ) : (
                      <Chip size="sm" variant="flat" color="warning">无数据</Chip>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <code className="text-xs text-foreground-600">{point.unit || '-'}</code>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-foreground-500">{point.groupLabel || '-'}</span>
                  </TableCell>
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      )}
    </>
  );
}


