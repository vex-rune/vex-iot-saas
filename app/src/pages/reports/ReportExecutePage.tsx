import {useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {
    Button,
    Chip,
    Pagination,
    Select,
    SelectItem,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
} from '@heroui/react';
import {ArrowDownIcon, ArrowLeftIcon, PlayCircleIcon} from '@heroicons/react/24/outline';
import {useQuery} from '@tanstack/react-query';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {
    executeReport,
    getReportDefinition,
    type ReportColumnInfo,
    type ReportResultDTO
} from '@/services/reportService';
import type {DateRangeValue} from '@/components/ui/common/SearchFilterBar';
import SearchFilterBar from '@/components/ui/common/SearchFilterBar';
import {CalendarDateTime, getLocalTimeZone, toCalendarDateTime, today} from '@internationalized/date';
import {toastError, toastSuccess} from '@/lib/toast';

const toISO = (d: CalendarDateTime): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.year}-${pad(d.month)}-${pad(d.day)}T${pad(d.hour)}:${pad(d.minute)}:00+08:00`;
};
const buildTsFilters = (range: DateRangeValue) => {
    const and: unknown[] = [];
    if (range.start) and.push({condition: {field: 'ts', op: 'gte', value: toISO(range.start)}});
    if (range.end) and.push({condition: {field: 'ts', op: 'lte', value: toISO(range.end)}});
    return and.length > 0 ? {and} : {};
};
const csvEscape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const PAGE_SIZES = ['15', '30', '60', '100'];

export default function ReportExecutePage() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const defaultEnd = useMemo(() => toCalendarDateTime(today(getLocalTimeZone())).set({hour: 23, minute: 59}), []);
    const defaultStart = useMemo(() => defaultEnd.subtract({days: 30}).set({hour: 0, minute: 0}), [defaultEnd]);
    const [dateRange, setDateRange] = useState<DateRangeValue>({start: defaultStart, end: defaultEnd});
    const [result, setResult] = useState<ReportResultDTO | null>(null);
    const [executing, setExecuting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(15);

    const {data: definition, isLoading: defLoading} = useQuery({
        queryKey: ['report.def', id],
        queryFn: () => chainToPromise(getReportDefinition(id!)),
        enabled: !!id,
    });

    const columns: ReportColumnInfo[] = result?.columns || [];
    const allRows = result?.rows || [];
    const total = allRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pagedRows = allRows.slice(page * pageSize, (page + 1) * pageSize);

    const handleExecute = async () => {
        setExecuting(true);
        try {
            const resp = await chainToPromise(executeReport({
                definitionId: id,
                filters: buildTsFilters(dateRange),
                limit: 5000
            }));
            setResult(resp);
            setPage(0);
        } catch (e) {
            console.error('Execute failed:', e);
        } finally {
            setExecuting(false);
        }
    };

    const handleExportCsv = async () => {
        if (!columns.length) return;
        setExporting(true);
        try {
            const PG = 500;
            let cursor: string | null = null;
            const all: Record<string, unknown>[] = [];
            const base = buildTsFilters(dateRange) as any;
            for (let s = 0; s < 200; s++) {
                const f: any = {...base};
                if (!f.and) f.and = [];
                if (cursor) f.and.push({condition: {field: 'ts', op: 'gt', value: cursor}});
                const r = await chainToPromise(executeReport({definitionId: id, filters: f, limit: PG}));
                const rows = r.rows || [];
                all.push(...rows);
                if (rows.length < PG) break;
                const lastTs = rows[rows.length - 1]?.ts;
                if (!lastTs) break;
                cursor = String(lastTs);
            }
            const hdr = columns.map(c => c.displayName || c.alias).join(',');
            const csv = all.map(row => columns.map(c => csvEscape(row[c.alias])).join(',')).join('\r\n');
            const blob = new Blob(['\uFEFF' + hdr + '\r\n' + csv], {type: 'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toastSuccess(`已导出 ${all.length} 行`);
        } catch (e) {
            toastError('导出失败', (e as Error)?.message || '请稍后重试');
        } finally {
            setExporting(false);
        }
    };

    if (defLoading) return (
        <div className="rounded-2xl bg-content1 p-4"><Skeleton className="h-8 w-48 rounded-lg"/>{[1, 2, 3].map(i =>
            <Skeleton key={i} className="h-10 w-full rounded-lg mt-3"/>)}</div>);
    return (
        <div className="flex min-h-full flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="flat" startContent={<ArrowLeftIcon className="h-4 w-4"/>}
                            onPress={() => navigate('/reports')}>返回列表</Button>
                    <div><h1 className="text-xl font-semibold text-foreground">执行报表</h1>
                        {definition && <p className="text-foreground-600 text-sm">{definition.name}</p>}</div>
                </div>
                <div className="flex gap-2">
                    <Button color="primary" size="sm" startContent={<PlayCircleIcon className="h-4 w-4"/>}
                            isLoading={executing} onPress={handleExecute}>执行</Button>
                    <Button variant="flat" size="sm" startContent={<ArrowDownIcon className="h-4 w-4"/>}
                            isLoading={exporting} onPress={handleExportCsv} isDisabled={!result || exporting}>导出
                        CSV</Button>
                </div>
            </header>
            <SearchFilterBar dateRange={{label: '时间范围', value: dateRange, onChange: setDateRange, withTime: true}}/>
            {result && <div className="flex items-center gap-3 text-sm text-foreground-600">
                <span>共 {total} 行</span><span>耗时 {result.elapsedMs}ms</span>{result.truncated &&
                <Chip size="sm" variant="flat" color="warning">结果已截断</Chip>}</div>}
            {!result && !executing && <div className="rounded-2xl bg-content1 p-12 text-center">
                <div className="flex flex-col items-center gap-2 text-foreground-400"><PlayCircleIcon
                    className="h-10 w-10"/><p className="text-sm">点击「执行」查看报表数据（默认最近30天）</p></div>
            </div>}
            {executing && <div className="rounded-2xl bg-content1 p-4"><Skeleton
                className="h-8 w-48 rounded-lg"/>{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i}
                                                                                        className="h-10 w-full rounded-lg mt-3"/>)}
            </div>}
            {!executing && result && columns.length > 0 && (<>
                <Table aria-label="报表结果" isStriped classNames={{wrapper: 'bg-content1 rounded-2xl'}}>
                    <TableHeader>{columns.map(col => <TableColumn
                        key={col.alias}>{col.displayName || col.alias}</TableColumn>)}</TableHeader>
                    <TableBody emptyContent="无数据">
                        {pagedRows.map((row, i) => <TableRow key={page * pageSize + i}>{columns.map(col => <TableCell
                            key={col.alias}>{String(row[col.alias] ?? '')}</TableCell>)}</TableRow>)}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground-500">共 {total} 条</span>
                        <Select size="sm" variant="bordered" className="w-24" selectedKeys={[String(pageSize)]}
                                onSelectionChange={(keys) => {
                                    setPageSize(Number(Array.from(keys)[0]));
                                    setPage(0);
                                }}>
                            {PAGE_SIZES.map(s => <SelectItem key={s} textValue={s}>{s}</SelectItem>)}
                        </Select>
                    </div>
                    <Pagination total={totalPages} page={page + 1} onChange={(p) => setPage(p - 1)} showControls
                                isCompact/>
                </div>
            </>)}
        </div>
    );
}
