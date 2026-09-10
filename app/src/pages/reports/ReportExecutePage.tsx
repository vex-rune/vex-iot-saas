/**
 * 报表执行页 — 输入过滤条件、执行查询、展示表格 + 导出 CSV
 */
import {useState} from 'react';
import {useParams} from 'react-router-dom';
import {
    Button, Table, TableBody, TableCell, TableColumn, TableHeader,
    TableRow, Input, Chip, Spinner,
} from '@heroui/react';
import {ArrowDownTrayIcon, PlayIcon} from '@heroicons/react/24/outline';
import {useQuery} from '@tanstack/react-query';
import {getReportDefinition, executeReport} from '@/api/reportApi';
import type {ReportResultDTO, ReportColumnInfo} from '@/api/reportApi';

export default function ReportExecutePage() {
    const {id} = useParams<{ id: string }>();
    const [result, setResult] = useState<ReportResultDTO | null>(null);
    const [executing, setExecuting] = useState(false);
    const [timeFrom, setTimeFrom] = useState('');
    const [timeTo, setTimeTo] = useState('');
    const [limit, setLimit] = useState(5000);

    const {data: definition} = useQuery({
        queryKey: ['report.def', id],
        queryFn: () => getReportDefinition(id!),
        enabled: !!id,
    });

    const handleExecute = async () => {
        setExecuting(true);
        try {
            const filters = {and: []};
            if (timeFrom) filters.and.push({condition: {field: 'ts', op: 'gte', value: timeFrom}});
            if (timeTo) filters.and.push({condition: {field: 'ts', op: 'lte', value: timeTo}});
            const resp = await executeReport({definitionId: id, filters, limit});
            setResult(resp.data);
        } catch (e) {
            console.error('Execute failed:', e);
        } finally {
            setExecuting(false);
        }
    };

    const handleExportCsv = () => {
        if (!result || !result.columns) return;
        const header = result.columns.map((c) => c.alias).join(',');
        const rows = (result.rows || []).map((row) =>
            result.columns!.map((c) => {
                const val = row[c.alias];
                const str = val == null ? '' : String(val);
                return str.includes(',') || str.includes('"') || str.includes('\n')
                    ? '"' + str.replace(/"/g, '""') + '"' : str;
            }).join(',')
        ).join('\r\n');
        const bom = '\uFEFF';
        const blob = new Blob([bom + header + '\r\n' + rows], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const columns = result?.columns || [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">执行报表</h1>
                    {definition && <p className="text-foreground/60 text-sm">{definition.name}</p>}
                </div>
                <div className="flex gap-2">
                    <Button
                        color="primary" size="sm" startContent={<PlayIcon className="h-4 w-4"/>}
                        isLoading={executing} onPress={handleExecute}
                    >执行</Button>
                    <Button
                        variant="flat" size="sm" startContent={<ArrowDownTrayIcon className="h-4 w-4"/>}
                        onPress={handleExportCsv} isDisabled={!result}
                    >导出 CSV</Button>
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <Input
                    type="datetime-local" label="起始时间"
                    value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)}
                    size="sm" className="w-60"
                />
                <Input
                    type="datetime-local" label="结束时间"
                    value={timeTo} onChange={(e) => setTimeTo(e.target.value)}
                    size="sm" className="w-60"
                />
                <Input
                    type="number" label="行数上限"
                    value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}
                    size="sm" className="w-32" min={1} max={5000}
                />
            </div>

            {result && (
                <div className="flex items-center gap-3 text-sm text-foreground/60">
                    <span>返回 {result.rowCount} 行</span>
                    <span>耗时 {result.elapsedMs}ms</span>
                    {result.truncated && <Chip size="sm" color="warning">结果已截断</Chip>}
                </div>
            )}

            {result && columns.length > 0 && (
                <Table aria-label="报表结果" className="w-full">
                    <TableHeader>
                        {columns.map((col) => (
                            <TableColumn key={col.alias}>{col.alias}</TableColumn>
                        ))}
                    </TableHeader>
                    <TableBody emptyContent="无数据">
                        {(result.rows || []).map((row, i) => (
                            <TableRow key={i}>
                                {columns.map((col) => (
                                    <TableCell key={col.alias}>{String(row[col.alias] ?? '')}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
