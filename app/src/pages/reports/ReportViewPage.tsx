import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useParams} from 'react-router-dom';
import {
    Button,
    Chip,
    Pagination,
    Select,
    SelectItem,
    Skeleton,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Tabs
} from '@heroui/react';
import {ArrowDownIcon, PlayCircleIcon} from '@heroicons/react/24/outline';
import {useQuery} from '@tanstack/react-query';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {
    executeReport,
    queryReportDefinitions,
    type ReportColumnInfo,
    type ReportDefinition,
    type ReportResultDTO
} from '@/services/reportService';
import {queryActiveDevices, queryPoints} from '@/services/deviceService';
import type {DateRangeValue} from '@/components/ui/common/SearchFilterBar';
import SearchFilterBar from '@/components/ui/common/SearchFilterBar';
import {CalendarDateTime, getLocalTimeZone, toCalendarDateTime, today} from '@internationalized/date';
import {toastSuccess} from '@/lib/toast';

const toISO = (d: CalendarDateTime): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return d.year + '-' + pad(d.month) + '-' + pad(d.day) + 'T' + pad(d.hour) + ':' + pad(d.minute) + ':00+08:00';
};
const csvEscape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const TR: Record<string, number> = {'7d': 7, '30d': 30, '90d': 90};

interface PCfg {
    visible?: boolean;
    defaultTimeRange?: string;
}

function ReportTabContent({def}: { def: ReportDefinition }) {
    const schema = useMemo(() => {
        try {
            return def.schemaJson ? JSON.parse(def.schemaJson) : null;
        } catch {
            return null;
        }
    }, [def.schemaJson]);
    const portal: PCfg = schema?.portal ?? {};
    const src = (schema?.source ?? 'POINT_HISTORY') as string;
    const colFields = new Set((schema?.columns ?? []).flatMap((c: any) => [c.displayName, c.field].filter(Boolean)));
    const searchCols = new Set(portal.searchableColumns ?? []);
    const hasTs = src === 'POINT_HISTORY' || src === 'POINT_REALTIME';
    const hasDev = searchCols.has('deviceId') || colFields.has('设备 ID');
    const hasPt = searchCols.has('pointCode') || colFields.has('点位编码');
    // 加载设备和点位列表用于下拉选择
    const {data: devices = []} = useQuery({
        queryKey: ['devices.active.forView'],
        queryFn: () => chainToPromise(queryActiveDevices({page: {page: 0, size: 500}}))
    });
    const {data: allPoints = []} = useQuery({
        queryKey: ['points.all.forView'],
        queryFn: () => chainToPromise(queryPoints({page: {page: 0, size: 2000}}))
    });
    const [selectedDevs, setSelectedDevs] = useState<Set<string>>(new Set());
    const [selectedPts, setSelectedPts] = useState<Set<string>>(new Set());
    const days = TR[portal.defaultTimeRange ?? '30d'] ?? 30;
    const dEnd = useMemo(() => toCalendarDateTime(today(getLocalTimeZone())).set({hour: 23, minute: 59}), []);
    const dStart = useMemo(() => dEnd.subtract({days}).set({hour: 0, minute: 0}), [dEnd, days]);
    const [dr, setDr] = useState<DateRangeValue>({start: hasTs ? dStart : null, end: hasTs ? dEnd : null});
    const [result, setResult] = useState<ReportResultDTO | null>(null);
    const [exec, setExec] = useState(false);
    const [page, setPage] = useState(0);
    const [ps, setPs] = useState(15);
    const alive = useRef(true);
    const cols: ReportColumnInfo[] = result?.columns || [];
    const rows = result?.rows || [];
    const total = rows.length;
    const tp = Math.max(1, Math.ceil(total / ps));
    const paged = rows.slice(page * ps, (page + 1) * ps);
    const mkF = useCallback(() => {
        const a: unknown[] = [];
        if (hasTs && dr.start) a.push({condition: {field: 'ts', op: 'gte', value: toISO(dr.start)}});
        if (hasTs && dr.end) a.push({condition: {field: 'ts', op: 'lte', value: toISO(dr.end)}});
        if (hasDev && selectedDevs.size > 0) a.push({
            condition: {
                field: 'deviceId',
                op: 'in',
                value: Array.from(selectedDevs)
            }
        });
        if (hasPt && selectedPts.size > 0) a.push({
            condition: {
                field: 'pointCode',
                op: 'in',
                value: Array.from(selectedPts)
            }
        });
        return a.length > 0 ? {and: a} : {};
    }, [dr, selectedDevs, selectedPts, hasTs, hasDev, hasPt]);
    const doExec = useCallback(async (f?: unknown) => {
        setExec(true);
        try {
            const r = await chainToPromise(executeReport({definitionId: def.id, filters: f ?? mkF(), limit: 5000}));
            if (alive.current) {
                setResult(r);
                setPage(0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (alive.current) setExec(false);
        }
    }, [def.id, mkF]);
    useEffect(() => {
        alive.current = true;
        doExec();
        return () => {
            alive.current = false;
        };
    }, [def.id]);
    const doExport = async () => {
        if (!cols.length) return;
        const PG = 500;
        let cur: string | null = null;
        const all: Record<string, unknown>[] = [];
        const base = mkF() as any;
        for (let s = 0; s < 200; s++) {
            const f: any = {...base};
            if (!f.and) f.and = [];
            if (cur) f.and.push({condition: {field: 'ts', op: 'gt', value: cur}});
            const r = await chainToPromise(executeReport({definitionId: def.id, filters: f, limit: PG}));
            const rs = r.rows || [];
            all.push(...rs);
            if (rs.length < PG) break;
            const lt = rs[rs.length - 1]?.ts;
            if (!lt) break;
            cur = String(lt);
        }
        const hdr = cols.map(c => c.displayName || c.alias).join(',');
        const csv = all.map(row => cols.map(c => csvEscape(row[c.alias])).join(',')).join('\r\n');
        const blob = new Blob(['\uFEFF' + hdr + '\r\n' + csv], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'report_' + (def.name || Date.now()) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        toastSuccess('已导出 ' + all.length + ' 行');
    };
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {hasTs &&
                    <SearchFilterBar dateRange={{label: '时间范围', value: dr, onChange: setDr, withTime: true}}/>}
                {hasDev && <Select size="sm" variant="bordered" className="w-48" selectionMode="multiple"
                                   placeholder="全部设备" aria-label="设备" selectedKeys={selectedDevs}
                                   onSelectionChange={(k) => setSelectedDevs(new Set(k as Set<string>))}>
                    {devices.map(d => <SelectItem key={d.id!}
                                                  textValue={d.deviceName || d.id}>{d.deviceName || d.id}</SelectItem>)}
                </Select>}
                {hasPt && <Select size="sm" variant="bordered" className="w-48" selectionMode="multiple"
                                  placeholder="全部点位" aria-label="点位" selectedKeys={selectedPts}
                                  onSelectionChange={(k) => setSelectedPts(new Set(k as Set<string>))}>
                    {allPoints.map(p => <SelectItem key={p.pointCode}
                                                    textValue={`${p.pointName || p.pointCode} (${p.pointCode})`}>{p.pointName || p.pointCode} ({p.pointCode})</SelectItem>)}
                </Select>}
                <Button size="sm" variant="flat" startContent={<PlayCircleIcon className="h-4 w-4"/>} isLoading={exec}
                        onPress={() => doExec()}>查询</Button>
                <Button size="sm" variant="flat" startContent={<ArrowDownIcon className="h-4 w-4"/>} onPress={doExport}
                        isDisabled={!result}>导出 CSV</Button>
            </div>
            {exec && <div className="rounded-2xl bg-content1 p-4"><Skeleton
                className="h-8 w-48 rounded-lg"/>{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i}
                                                                                        className="h-10 w-full rounded-lg mt-3"/>)}
            </div>}
            {!exec && result && cols.length > 0 && (<>
                <div className="flex items-center gap-3 text-sm text-foreground-600">
                    <span>共 {total} 行</span><span>耗时 {result.elapsedMs}ms</span>{result.truncated &&
                    <Chip size="sm" variant="flat" color="warning">已截断</Chip>}</div>
                <Table aria-label={def.name} isStriped classNames={{wrapper: 'bg-content1 rounded-2xl'}}>
                    <TableHeader>{cols.map(c => <TableColumn
                        key={c.alias}>{c.displayName || c.alias}</TableColumn>)}</TableHeader>
                    <TableBody emptyContent="无数据">{paged.map((row, i) => <TableRow key={page * ps + i}>{cols.map(c =>
                        <TableCell key={c.alias}>{String(row[c.alias] ?? '')}</TableCell>)}</TableRow>)}</TableBody>
                </Table>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span
                        className="text-sm text-foreground-500">共 {total} 条</span>
                        <Select size="sm" variant="bordered" className="w-24" selectedKeys={[String(ps)]}
                                onSelectionChange={(k) => {
                                    setPs(Number(Array.from(k)[0]));
                                    setPage(0);
                                }}>
                            {['15', '30', '60', '100'].map(s => <SelectItem key={s} textValue={s}>{s}</SelectItem>)}
                        </Select>
                    </div>
                    <Pagination total={tp} page={page + 1} onChange={(p) => setPage(p - 1)} showControls isCompact/>
                </div>
            </>)}
            {!exec && !result &&
                <div className="rounded-2xl bg-content1 p-8 text-center text-sm text-foreground-400">加载中...</div>}
        </div>
    );
}

export default function ReportViewPage() {
    const {id} = useParams<{ id: string }>();
    const {data: allDefs, isLoading} = useQuery({
        queryKey: ['report.portal'],
        queryFn: () => chainToPromise(queryReportDefinitions({page: {page: 0, size: 200}}))
    });
    const defs = useMemo(() => {
        if (!allDefs) return [];
        return allDefs.filter(d => {
            if (!d.enabled) return false;
            try {
                const s = d.schemaJson ? JSON.parse(d.schemaJson) : null;
                return s?.portal?.visible === true;
            } catch {
                return false;
            }
        });
    }, [allDefs]);
    const [activeKey, setActiveKey] = useState<string | undefined>(undefined);
    // URL id 参数优先，否则默认第一个
    const initialKey = id || (defs.length > 0 ? defs[0].id : undefined);
    useEffect(() => {
        if (initialKey && !activeKey) setActiveKey(initialKey);
    }, [initialKey]);
    if (isLoading) return (
        <div className="rounded-2xl bg-content1 p-4"><Skeleton className="h-8 w-48 rounded-lg"/>{[1, 2, 3].map(i =>
            <Skeleton key={i} className="h-10 w-full rounded-lg mt-3"/>)}</div>);
    if (defs.length === 0) return (<div className="flex min-h-full flex-col gap-4">
        <header><h1 className="text-xl font-semibold text-foreground">报表查看</h1></header>
        <div className="rounded-2xl bg-content1 p-12 text-center"><p className="text-sm text-foreground-400">暂无可用报表,
            请联系管理员在「报表管理」中配置</p></div>
    </div>);
    return (
        <div className="flex min-h-full flex-col gap-4">
            <header><h1 className="text-xl font-semibold text-foreground">报表查看</h1></header>
            <Tabs aria-label="报表" size="sm" selectedKey={activeKey}
                  onSelectionChange={(k) => {
                      if (k) setActiveKey(String(k));
                  }}
                  classNames={{tabList: 'gap-4 px-0', cursor: 'bg-primary'}}>
                {defs.map(d => <Tab key={d.id!} title={d.name || '未命名'}>{(d.id === activeKey) &&
                    <ReportTabContent def={d}/>}</Tab>)}
            </Tabs>
        </div>
    );
}
