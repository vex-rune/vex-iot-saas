/**
 * 报表构建器 — Tab 分区: 基本信息 / 数据配置 / 查看配置
 */
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Button, Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Switch, Tab, Tabs} from '@heroui/react';
import {PlusIcon, TrashIcon} from '@heroicons/react/24/outline';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {type ReportDefinition, saveReportDefinition, updateReportDefinition} from '@/services/reportService';
import {queryActiveDevices, queryPoints} from '@/services/deviceService';
import {toastError, toastSuccess, toastWarning} from '@/lib/toast';
import {
    REPORT_AGG_FUNCS,
    REPORT_FIELDS,
    REPORT_FORMATS,
    REPORT_OPERATORS,
    REPORT_SORT_DIRECTIONS,
    REPORT_SOURCES,
    type ReportDataSource
} from '@/constants/reportFields';

interface ColItem {
    displayName: string;
    source: ReportDataSource;
    field: string;
    agg: string;
    format: string;
    op: string | null;
    operandSource: ReportDataSource;
    operandField: string;
    operandAgg: string;
}

interface SortItem {
    source: ReportDataSource;
    field: string;
    direction: 'ASC' | 'DESC';
}

interface RSchemaFilter {
    and?: Array<{ condition?: { field: string; op: string; value: unknown } } | { predicate?: unknown }>;
}

interface RSchema {
    schemaVersion?: string;
    source?: ReportDataSource;
    joins?: unknown[];
    columns?: Array<{
        displayName?: string;
        alias?: string;
        source?: ReportDataSource;
        field?: string;
        agg?: string;
        format?: string;
        op?: string | null;
        operand?: { source?: ReportDataSource; field?: string; agg?: string } | null
    }>;
    breakout?: { source?: ReportDataSource; field?: string } | null;
    filters?: RSchemaFilter;
    sort?: Array<{ source?: ReportDataSource; field?: string; direction?: string }>;
    limit?: number;
    portal?: { visible?: boolean; defaultTimeRange?: string; searchableColumns?: string[] };
}

const emptyCol = (src: ReportDataSource = 'POINT_HISTORY'): ColItem => ({
    displayName: '',
    source: src,
    field: REPORT_FIELDS[src]?.[0] ?? '',
    agg: 'NONE',
    format: 'raw',
    op: null,
    operandSource: src,
    operandField: REPORT_FIELDS[src]?.[0] ?? '',
    operandAgg: 'NONE'
});
const schemaToCols = (s: RSchema | null): ColItem[] => {
    if (!s?.columns?.length) return [emptyCol()];
    return s.columns.map(c => ({
        displayName: c.displayName ?? c.alias ?? '',
        source: (c.source ?? 'POINT_HISTORY') as ReportDataSource,
        field: c.field ?? 'doubleValue',
        agg: c.agg ?? 'NONE',
        format: c.format ?? 'raw',
        op: c.op ?? null,
        operandSource: (c.operand?.source ?? 'POINT_HISTORY') as ReportDataSource,
        operandField: c.operand?.field ?? 'doubleValue',
        operandAgg: c.operand?.agg ?? 'NONE'
    }));
};
const extractIn = (f: RSchemaFilter | undefined, field: string): string => {
    if (!f?.and) return '';
    for (const c of f.and) {
        const cond = (c as Record<string, unknown>).condition as {
            field?: string;
            op?: string;
            value?: unknown
        } | undefined;
        if (cond?.field === field && cond?.op === 'in' && Array.isArray(cond.value)) return (cond.value as string[]).join(',');
        if (cond?.field === field && cond?.op === 'eq') return String(cond.value);
    }
    return '';
};
interface Props {
    editingDef?: ReportDefinition | null;
    onSaveSuccess: () => void;
    onCancel: () => void;
}

function ColRow({col, i, cols, setCols}: {
    col: ColItem;
    i: number;
    cols: ColItem[];
    setCols: React.Dispatch<React.SetStateAction<ColItem[]>>
}) {
    const u = useCallback((p: Partial<ColItem>) => {
        setCols(prev => prev.map((c, j) => j === i ? {...c, ...p} : c));
    }, [i, setCols]);
    return (<div className="flex flex-wrap items-end gap-2 rounded-xl border border-divider p-3"><Input label="显示名称"
                                                                                                        size="sm"
                                                                                                        className="w-36"
                                                                                                        variant="bordered"
                                                                                                        value={col.displayName}
                                                                                                        onValueChange={(v) => u({displayName: v})}/><Select
        label="数据源" size="sm" className="w-40" variant="bordered" selectedKeys={[col.source]}
        onSelectionChange={(k) => {
            const v = [...k][0];
            if (v) {
                const ns = String(v) as ReportDataSource;
                const f = REPORT_FIELDS[ns] || [];
                u({source: ns, field: f.includes(col.field) ? col.field : f[0] || ''});
            }
        }}>{REPORT_SOURCES.map(s => <SelectItem key={s} textValue={s}>{s}</SelectItem>)}</Select><Select label="字段"
                                                                                                         size="sm"
                                                                                                         className="w-40"
                                                                                                         variant="bordered"
                                                                                                         selectedKeys={[col.field]}
                                                                                                         onSelectionChange={(k) => {
                                                                                                             const v = [...k][0];
                                                                                                             if (v) u({field: String(v)});
                                                                                                         }}>{(REPORT_FIELDS[col.source] || []).map(f =>
        <SelectItem key={f} textValue={f}>{f}</SelectItem>)}</Select><Select label="聚合" size="sm" className="w-28"
                                                                             variant="bordered" selectedKeys={[col.agg]}
                                                                             onSelectionChange={(k) => {
                                                                                 const v = [...k][0];
                                                                                 if (v) u({agg: String(v)});
                                                                             }}>{REPORT_AGG_FUNCS.map(f => <SelectItem
        key={f} textValue={f}>{f}</SelectItem>)}</Select><Select label="格式" size="sm" className="w-28"
                                                                 variant="bordered" selectedKeys={[col.format]}
                                                                 onSelectionChange={(k) => {
                                                                     const v = [...k][0];
                                                                     if (v) u({format: String(v)});
                                                                 }}>{REPORT_FORMATS.map(f => <SelectItem key={f}
                                                                                                         textValue={f}>{f}</SelectItem>)}</Select><Select
        label="运算" size="sm" className="w-24" variant="bordered" selectedKeys={[col.op ?? 'NONE']}
        onSelectionChange={(k) => {
            const v = [...k][0];
            if (v) u({op: v === 'NONE' ? null : String(v)});
        }}>{<><SelectItem key="NONE" textValue="无">无</SelectItem>{REPORT_OPERATORS.map(o => <SelectItem key={o}
                                                                                                          textValue={o}>{o}</SelectItem>)}</>}
    </Select>{col.op && (<><Select label="右来源" size="sm" className="w-36" variant="bordered"
                                   selectedKeys={[col.operandSource]} onSelectionChange={(k) => {
        const v = [...k][0];
        if (v) {
            const ns = String(v) as ReportDataSource;
            const f = REPORT_FIELDS[ns] || [];
            u({operandSource: ns, operandField: f.includes(col.operandField) ? col.operandField : f[0] || ''});
        }
    }}>{REPORT_SOURCES.map(s => <SelectItem key={s} textValue={s}>{s}</SelectItem>)}</Select><Select label="右字段"
                                                                                                     size="sm"
                                                                                                     className="w-32"
                                                                                                     variant="bordered"
                                                                                                     selectedKeys={[col.operandField]}
                                                                                                     onSelectionChange={(k) => {
                                                                                                         const v = [...k][0];
                                                                                                         if (v) u({operandField: String(v)});
                                                                                                     }}>{(REPORT_FIELDS[col.operandSource] || []).map(f =>
        <SelectItem key={f} textValue={f}>{f}</SelectItem>)}</Select><Select label="右聚合" size="sm" className="w-28"
                                                                             variant="bordered"
                                                                             selectedKeys={[col.operandAgg]}
                                                                             onSelectionChange={(k) => {
                                                                                 const v = [...k][0];
                                                                                 if (v) u({operandAgg: String(v)});
                                                                             }}>{REPORT_AGG_FUNCS.map(f => <SelectItem
        key={f} textValue={f}>{f}</SelectItem>)}</Select></>)}{cols.length > 1 &&
        <Button isIconOnly size="sm" variant="flat" color="danger"
                onPress={() => setCols(cols.filter((_, j) => j !== i))}><TrashIcon className="h-4 w-4"/></Button>}
    </div>);
}


export default function ReportBuilderForm({editingDef, onSaveSuccess, onCancel}: Props) {
    const qc = useQueryClient();
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [source, setSource] = useState<ReportDataSource>('POINT_HISTORY');
    const [cols, setCols] = useState<ColItem[]>([emptyCol()]);
    const [bField, setBField] = useState('');
    const [bSource, setBSource] = useState<ReportDataSource>('DEVICE');
    const [enabled, setEnabled] = useState(true);
    const [limit, setLimit] = useState(5000);
    const [hydrated, setHydrated] = useState(false);
    const [fDevIds, setFDevIds] = useState<Set<string>>(new Set());
    const [fPtCodes, setFPtCodes] = useState<Set<string>>(new Set());
    const [sorts, setSorts] = useState<SortItem[]>([]);
    const [pVis, setPVis] = useState(false);
    const [pTime, setPTime] = useState('30d');
    const [pSearch, setPSearch] = useState<string[]>([]);
    // 加载设备列表和点位列表
    const {data: devices = []} = useQuery({
        queryKey: ['devices.active.forReport'],
        queryFn: () => chainToPromise(queryActiveDevices({page: {page: 0, size: 500}}))
    });
    const {data: allPoints = []} = useQuery({
        queryKey: ['points.all.forReport'],
        queryFn: () => chainToPromise(queryPoints({page: {page: 0, size: 2000}}))
    });
    // 从已选设备筛选可用点位
    const availablePoints = useMemo(() => {
        if (fDevIds.size === 0) return allPoints;
        return allPoints.filter(p => fDevIds.has(p.deviceId));
    }, [allPoints, fDevIds]);
    useEffect(() => {
        if (editingDef) {
            setName(editingDef.name || '');
            setDesc(editingDef.description || '');
            setEnabled(editingDef.enabled ?? true);
            let s: RSchema | null = null;
            if (editingDef.schemaJson) {
                try {
                    s = JSON.parse(editingDef.schemaJson) as RSchema;
                } catch {
                    toastWarning('schema 解析失败');
                    s = null;
                }
            }
            const src = (s?.source ?? 'POINT_HISTORY') as ReportDataSource;
            setSource(src);
            setCols(schemaToCols(s));
            setBSource((s?.breakout?.source ?? 'DEVICE') as ReportDataSource);
            setBField(s?.breakout?.field ?? '');
            setLimit(s?.limit ?? 5000);
            setFDevIds(new Set(extractIn(s?.filters, 'deviceId').split(',').filter(Boolean)));
            setFPtCodes(new Set(extractIn(s?.filters, 'pointCode').split(',').filter(Boolean)));
            setSorts((s?.sort ?? []).map(x => ({
                source: (x.source ?? 'POINT_HISTORY') as ReportDataSource,
                field: x.field ?? '',
                direction: (x.direction === 'DESC' ? 'DESC' : 'ASC') as 'ASC' | 'DESC'
            })));
            setPVis(s?.portal?.visible ?? false);
            setPTime(s?.portal?.defaultTimeRange ?? '30d');
            setPSearch(s?.portal?.searchableColumns ?? []);
        } else {
            setName('');
            setDesc('');
            setEnabled(true);
            setSource('POINT_HISTORY');
            setCols([emptyCol('POINT_HISTORY')]);
            setBSource('DEVICE');
            setBField('');
            setLimit(5000);
            setFDevIds(new Set());
            setFPtCodes(new Set());
            setSorts([]);
            setPVis(false);
            setPTime('30d');
            setPSearch([]);
        }
        setHydrated(true);
    }, [editingDef]);
    const saveMut = useApiMutation({mutationFn: (b: ReportDefinition) => editingDef?.id ? updateReportDefinition(editingDef.id, b) : saveReportDefinition(b)});
    const allNames = cols.map(c => c.displayName).filter(Boolean);
    const handleSave = () => {
        if (!hydrated) return;
        const tn = name.trim();
        if (!tn) {
            toastWarning('请填写报表名称');
            return;
        }
        const ds = new Set<string>();
        for (let i = 0; i < cols.length; i++) {
            const c = cols[i];
            const dn = (c.displayName || `col_${i + 1}`).trim();
            if (!dn) {
                toastWarning(`第 ${i + 1} 显示名称空`);
                return;
            }
            if (ds.has(dn)) {
                toastWarning(`显示名称重复: ${dn}`);
                return;
            }
            ds.add(dn);
            const af = REPORT_FIELDS[c.source] || [];
            if (!af.includes(c.field)) {
                toastWarning(`字段 ${c.field} 不属于 ${c.source}`);
                return;
            }
            if (c.op) {
                const oa = REPORT_FIELDS[c.operandSource] || [];
                if (!oa.includes(c.operandField)) {
                    toastWarning(`右操作数 ${c.operandField} 不属于 ${c.operandSource}`);
                    return;
                }
            }
        }
        if (bField) {
            const ba = REPORT_FIELDS[bSource] || [];
            if (!ba.includes(bField)) {
                toastWarning(`分组字段 ${bField} 不属于 ${bSource}`);
                return;
            }
        }
        const fa: RSchemaFilter['and'] = [];
        if (fDevIds.size > 0) fa.push({condition: {field: 'deviceId', op: 'in', value: Array.from(fDevIds)}});
        if (fPtCodes.size > 0) fa.push({condition: {field: 'pointCode', op: 'in', value: Array.from(fPtCodes)}});
        const schema = {
            schemaVersion: '1.0',
            source,
            joins: [],
            columns: cols.map(c => ({
                displayName: c.displayName || undefined,
                source: c.source,
                field: c.field,
                agg: c.agg || 'NONE',
                format: c.format || 'raw',
                op: c.op || null,
                operand: c.op ? {source: c.operandSource, field: c.operandField, agg: c.operandAgg || 'NONE'} : null
            })),
            breakout: bField ? {source: bSource, field: bField} : null,
            filters: fa.length > 0 ? {and: fa} : {},
            sort: sorts.length > 0 ? sorts.map(s => ({
                source: s.source,
                field: s.field,
                direction: s.direction
            })) : undefined,
            limit,
            portal: {visible: pVis, defaultTimeRange: pTime, searchableColumns: pSearch}
        };
        saveMut.mutate({
            name: tn,
            description: desc.trim(),
            schemaJson: JSON.stringify(schema),
            enabled
        }, {
            onSuccess: () => {
                toastSuccess(editingDef?.id ? '更新成功' : '保存成功');
                onSaveSuccess();
                qc.invalidateQueries({queryKey: ['report.definitions']});
            }, onError: (e) => {
                toastError('保存失败', e?.message || '请稍后重试');
            }
        });
    };

    return (<div className="flex min-h-full flex-col gap-4"><Tabs aria-label="报表配置" size="sm" variant="underlined"
                                                                  classNames={{
                                                                      tabList: 'gap-4 px-0',
                                                                      cursor: 'bg-primary'
                                                                  }}>
        <Tab key="basic" title="基本信息"><Card shadow="sm" className="bg-content1"><CardBody className="gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Input label="报表名称" value={name}
                                                                          onValueChange={setName} isRequired
                                                                          isInvalid={!name.trim()}
                                                                          variant="bordered"/><Input label="描述"
                                                                                                     value={desc}
                                                                                                     onValueChange={setDesc}
                                                                                                     variant="bordered"/>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Select label="默认数据源" variant="bordered" selectedKeys={[source]} onSelectionChange={(k) => {
                    const v = [...k][0];
                    if (v) {
                        const ns = v as ReportDataSource;
                        setSource(ns);
                        setCols(cols.map(c => ({...c, source: ns, operandSource: ns})));
                    }
                }}>{REPORT_SOURCES.map(s => <SelectItem key={s} textValue={s}>{s}</SelectItem>)}</Select>
                <Input type="number" label="行数上限" variant="bordered" value={String(limit)} min={1} max={50000}
                       onValueChange={(v) => setLimit(Math.max(1, Number(v) || 5000))}/>
                <div className="flex items-center gap-2 pb-1"><Switch size="sm" isSelected={enabled}
                                                                      onValueChange={setEnabled}>启用</Switch></div>
            </div>
        </CardBody></Card></Tab>
        <Tab key="data" title="数据配置">
            <div className="flex flex-col gap-4">
                <Card shadow="sm" className="bg-content1"><CardHeader className="px-5 pt-4 pb-0"><h2
                    className="text-sm font-semibold text-foreground">数据范围</h2></CardHeader>
                    <CardBody>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Select label="设备" size="sm" variant="bordered" selectionMode="multiple"
                                    placeholder="全部设备" selectedKeys={fDevIds}
                                    onSelectionChange={(k) => setFDevIds(new Set(k as Set<string>))}>
                                {devices.map(d => <SelectItem key={d.id!}
                                                              textValue={d.deviceName || d.id}>{d.deviceName || d.id}</SelectItem>)}
                            </Select>
                            <Select label="点位" size="sm" variant="bordered" selectionMode="multiple"
                                    placeholder="全部点位" selectedKeys={fPtCodes}
                                    onSelectionChange={(k) => setFPtCodes(new Set(k as Set<string>))}>
                                {availablePoints.map(p => <SelectItem key={p.pointCode}
                                                                      textValue={`${p.pointName || p.pointCode} (${p.pointCode})`}>{p.pointName || p.pointCode} ({p.pointCode})</SelectItem>)}
                            </Select>
                        </div>
                    </CardBody></Card>
                <Card shadow="sm" className="bg-content1"><CardHeader
                    className="flex items-center justify-between px-5 pt-4 pb-0"><h2
                    className="text-sm font-semibold text-foreground">列定义</h2><Button size="sm" variant="flat"
                                                                                         startContent={<PlusIcon
                                                                                             className="h-3 w-3"/>}
                                                                                         onPress={() => setCols([...cols, emptyCol(source)])}>添加列</Button></CardHeader>
                    <CardBody className="gap-3">{cols.map((col, i) => <ColRow key={i} col={col} i={i} cols={cols}
                                                                              setCols={setCols}/>)}</CardBody></Card>
                <Card shadow="sm" className="bg-content1"><CardHeader className="px-5 pt-4 pb-0"><h2
                    className="text-sm font-semibold text-foreground">分组设置</h2></CardHeader>
                    <CardBody>
                        <div className="flex flex-wrap gap-3">
                            <Select label="来源" size="sm" className="w-36" variant="bordered" selectedKeys={[bSource]}
                                    onSelectionChange={(k) => {
                                        const v = [...k][0];
                                        if (v) {
                                            setBSource(String(v) as ReportDataSource);
                                            const f = REPORT_FIELDS[String(v) as ReportDataSource] || [];
                                            if (bField && !f.includes(bField)) setBField('');
                                        }
                                    }}>{REPORT_SOURCES.map(s => <SelectItem key={s}
                                                                            textValue={s}>{s}</SelectItem>)}</Select>
                            <Select label="字段" size="sm" className="w-36" variant="bordered"
                                    selectedKeys={[bField || 'NONE']} onSelectionChange={(k) => {
                                const v = [...k][0];
                                setBField(v === 'NONE' ? '' : String(v));
                            }}>{['NONE', ...(REPORT_FIELDS[bSource] || [])].map(f => <SelectItem key={f}
                                                                                                 textValue={f === 'NONE' ? '无分组' : f}>{f === 'NONE' ? '无分组' : f}</SelectItem>)}</Select>
                        </div>
                    </CardBody></Card>
                <Card shadow="sm" className="bg-content1"><CardHeader
                    className="flex items-center justify-between px-5 pt-4 pb-0"><h2
                    className="text-sm font-semibold text-foreground">排序</h2><Button size="sm" variant="flat"
                                                                                       startContent={<PlusIcon
                                                                                           className="h-3 w-3"/>}
                                                                                       onPress={() => setSorts([...sorts, {
                                                                                           source,
                                                                                           field: REPORT_FIELDS[source]?.[0] ?? '',
                                                                                           direction: 'ASC'
                                                                                       }])}
                                                                                       isDisabled={sorts.length >= 5}>添加</Button></CardHeader>
                    <CardBody className="gap-2">{sorts.length === 0 &&
                        <p className="text-xs text-foreground-400">未设置排序</p>}
                        {sorts.map((s, i) => (<div key={i} className="flex flex-wrap items-end gap-2">
                            <Select label="来源" size="sm" className="w-32" variant="bordered" selectedKeys={[s.source]}
                                    onSelectionChange={(k) => {
                                        const v = [...k][0];
                                        if (v) {
                                            const ns = v as ReportDataSource;
                                            setSorts(sorts.map((x, j) => j === i ? {
                                                ...x,
                                                source: ns,
                                                field: REPORT_FIELDS[ns]?.[0] ?? ''
                                            } : x));
                                        }
                                    }}>{REPORT_SOURCES.map(x => <SelectItem key={x}
                                                                            textValue={x}>{x}</SelectItem>)}</Select>
                            <Select label="字段" size="sm" className="w-32" variant="bordered" selectedKeys={[s.field]}
                                    onSelectionChange={(k) => {
                                        const v = [...k][0];
                                        if (v) setSorts(sorts.map((x, j) => j === i ? {...x, field: String(v)} : x));
                                    }}>{(REPORT_FIELDS[s.source] || []).map(f => <SelectItem key={f}
                                                                                             textValue={f}>{f}</SelectItem>)}</Select>
                            <Select label="方向" size="sm" className="w-20" variant="bordered"
                                    selectedKeys={[s.direction]} onSelectionChange={(k) => {
                                const v = [...k][0];
                                if (v) setSorts(sorts.map((x, j) => j === i ? {
                                    ...x,
                                    direction: v as 'ASC' | 'DESC'
                                } : x));
                            }}>{REPORT_SORT_DIRECTIONS.map(d => <SelectItem key={d}
                                                                            textValue={d === 'ASC' ? '升序' : '降序'}>{d === 'ASC' ? '升序' : '降序'}</SelectItem>)}</Select>
                            <Button isIconOnly size="sm" variant="flat" color="danger"
                                    onPress={() => setSorts(sorts.filter((_, j) => j !== i))}><TrashIcon
                                className="h-4 w-4"/></Button>
                        </div>))}
                    </CardBody></Card>
            </div>
        </Tab>
        <Tab key="portal" title="查看配置"><Card shadow="sm" className="bg-content1"><CardBody className="gap-5">
            <div className="flex items-center gap-2"><Switch size="sm" isSelected={pVis}
                                                             onValueChange={setPVis}>在报表查看页展示</Switch></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select label="默认时间范围" size="sm" variant="bordered" selectedKeys={[pTime]}
                        onSelectionChange={(k) => {
                            const v = [...k][0];
                            if (v) setPTime(String(v));
                        }}>
                    {[{key: '7d', label: '最近 7 天'}, {key: '30d', label: '最近 30 天'}, {
                        key: '90d',
                        label: '最近 90 天'
                    }, {key: 'custom', label: '自定义'}].map(o => <SelectItem key={o.key}
                                                                              textValue={o.label}>{o.label}</SelectItem>)}</Select>
            </div>
            <div>
                <p className="text-sm font-medium text-foreground mb-1">可搜索列</p>
                <p className="text-xs text-foreground-400 mb-3">用户在查看页可通过这些列搜索数据。点击列名切换。</p>
                {allNames.length === 0 ? <p className="text-xs text-foreground-400">请先在「数据配置」中定义列</p> : (
                    <div className="flex flex-wrap gap-2">{allNames.map(cn => {
                        const a = pSearch.includes(cn);
                        return (
                            <Chip key={cn} size="sm" variant={a ? 'flat' : 'bordered'} color={a ? 'primary' : 'default'}
                                  className="cursor-pointer select-none"
                                  onClick={() => setPSearch(prev => a ? prev.filter(x => x !== cn) : [...prev, cn])}>{cn}{a ? ' \u2713' : ''}</Chip>
                        );
                    })}</div>)}
            </div>
        </CardBody></Card></Tab>
    </Tabs>
        <div className="flex justify-end gap-2">
            <Button variant="flat" onPress={onCancel}>取消</Button>
            <Button color="primary" isLoading={saveMut.isPending}
                    onPress={handleSave}>{editingDef?.id ? '更新' : '保存'}</Button>
        </div>
    </div>);
}
