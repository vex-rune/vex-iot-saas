/**
 * 报表定义编辑器 Drawer — 创建/编辑报表 schema
 */
import {useEffect, useState} from 'react';
import {
    Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader,
    Input, Select, SelectItem, Switch, Tooltip, useDisclosure,
} from '@heroui/react';
import {PlusIcon, TrashIcon} from '@heroicons/react/24/outline';
import {useQueryClient} from '@tanstack/react-query';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {saveReportDefinition, type ReportDefinition} from '@/api/reportApi';
import {toastSuccess} from '@/lib/toast';
import {
    REPORT_SOURCES, REPORT_FIELDS, REPORT_AGG_FUNCS,
    REPORT_OPERATORS, type ReportDataSource,
} from '@/constants/reportFields';

interface ColumnItem {
    alias: string;
    source: ReportDataSource;
    field: string;
    agg: string;
    op: string | null;
    operandSource: string;
    operandField: string;
    operandAgg: string;
}

const emptyColumn = (): ColumnItem => ({
    alias: '',
    source: 'POINT_HISTORY',
    field: 'doubleValue',
    agg: 'NONE',
    op: null,
    operandSource: 'POINT_HISTORY',
    operandField: 'doubleValue',
    operandAgg: 'NONE',
});

interface Props {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editingDef?: ReportDefinition | null;
}

export default function ReportBuilderDrawer({isOpen, onOpenChange, editingDef}: Props) {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState<ReportDataSource>('POINT_HISTORY');
    const [columns, setColumns] = useState<ColumnItem[]>([emptyColumn()]);
    const [breakoutField, setBreakoutField] = useState('');
    const [breakoutSource, setBreakoutSource] = useState<ReportDataSource>('DEVICE');
    const [enabled, setEnabled] = useState(true);
    const [schemaLimit, setSchemaLimit] = useState(5000);

    useEffect(() => {
        if (editingDef) {
            setName(editingDef.name || '');
            setDescription(editingDef.description || '');
            setEnabled(editingDef.enabled ?? true);
        }
    }, [editingDef]);

    const saveMutation = useApiMutation({
        fn: (body: ReportDefinition) =>
            editingDef?.id
                ? saveReportDefinition({...body, id: editingDef.id})
                : saveReportDefinition(body),
        onSuccess: () => {
            toastSuccess('保存成功');
            onOpenChange(false);
            queryClient.invalidateQueries({queryKey: ['report.definitions']});
        },
    });

    const handleSave = () => {
        const schema = {
            schemaVersion: '1.0',
            source,
            joins: [],
            columns: columns.map((c) => ({
                alias: c.alias,
                source: c.source,
                field: c.field,
                agg: c.agg || 'NONE',
                format: 'raw',
                op: c.op || null,
                operand: c.op ? {source: c.operandSource, field: c.operandField, agg: c.operandAgg || 'NONE'} : null,
            })),
            breakout: breakoutField ? {source: breakoutSource, field: breakoutField} : null,
            filters: {},
            limit: schemaLimit,
        };
        saveMutation.mutate({
            name: name.trim(),
            description: description.trim(),
            schemaJson: JSON.stringify(schema),
            enabled,
        });
    };

    return (
        <Drawer isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
            <DrawerContent>
                {(onClose) => (
                    <>
                        <DrawerHeader>{editingDef ? '编辑报表' : '新建报表'}</DrawerHeader>
                        <DrawerBody className="flex flex-col gap-4">
                            <Input label="报表名称" value={name} onValueChange={setName} isRequired/>
                            <Input label="描述" value={description} onValueChange={setDescription}/>
                            <Select
                                label="数据源" selectedKeys={[source]}
                                onSelectionChange={(keys) => {
                                    const v = [...keys][0];
                                    if (v) setSource(v as ReportDataSource);
                                }}
                            >
                                {REPORT_SOURCES.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
                            </Select>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">列定义</span>
                                    <Button size="sm" variant="flat" startContent={<PlusIcon className="h-3 w-3"/>}
                                            onPress={() => setColumns([...columns, emptyColumn()])}>添加列</Button>
                                </div>
                                {columns.map((col, i) => (
                                    <div key={i}
                                         className="flex flex-wrap items-end gap-2 mb-3 p-2 rounded bg-content2">
                                        <Input label="别名" size="sm" className="w-28" value={col.alias}
                                               onValueChange={(v) => {
                                                   const n = [...columns];
                                                   n[i].alias = v;
                                                   setColumns(n);
                                               }}/>
                                        <Select label="字段来源" size="sm" className="w-36" selectedKeys={[col.source]}
                                                onSelectionChange={(keys) => {
                                                    const v = [...keys][0];
                                                    if (v) {
                                                        const n = [...columns];
                                                        n[i].source = v as ReportDataSource;
                                                        setColumns(n);
                                                    }
                                                }}>
                                            {REPORT_SOURCES.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
                                        </Select>
                                        <Select label="字段" size="sm" className="w-36" selectedKeys={[col.field]}
                                                onSelectionChange={(keys) => {
                                                    const v = [...keys][0];
                                                    if (v) {
                                                        const n = [...columns];
                                                        n[i].field = v;
                                                        setColumns(n);
                                                    }
                                                }}>
                                            {(REPORT_FIELDS[col.source] || []).map((f) => <SelectItem
                                                key={f}>{f}</SelectItem>)}
                                        </Select>
                                        <Select label="聚合" size="sm" className="w-32" selectedKeys={[col.agg]}
                                                onSelectionChange={(keys) => {
                                                    const v = [...keys][0];
                                                    if (v) {
                                                        const n = [...columns];
                                                        n[i].agg = v;
                                                        setColumns(n);
                                                    }
                                                }}>
                                            {REPORT_AGG_FUNCS.map((f) => <SelectItem key={f}>{f}</SelectItem>)}
                                        </Select>
                                        <Select label="运算符" size="sm" className="w-24"
                                                selectedKeys={[col.op || 'NONE']}
                                                onSelectionChange={(keys) => {
                                                    const v = [...keys][0];
                                                    const n = [...columns];
                                                    n[i].op = v === 'NONE' ? null : v;
                                                    setColumns(n);
                                                }}>
                                            {[<SelectItem key="NONE">NONE</SelectItem>, ...REPORT_OPERATORS.map((o) =>
                                                <SelectItem key={o}>{o}</SelectItem>)]}
                                        </Select>
                                        {col.op && (
                                            <>
                                                <Select label="右操作数字段" size="sm" className="w-32"
                                                        selectedKeys={[col.operandField]}
                                                        onSelectionChange={(keys) => {
                                                            const v = [...keys][0];
                                                            if (v) {
                                                                const n = [...columns];
                                                                n[i].operandField = v;
                                                                setColumns(n);
                                                            }
                                                        }}>
                                                    {(REPORT_FIELDS[col.source] || []).map((f) => <SelectItem
                                                        key={f}>{f}</SelectItem>)}
                                                </Select>
                                                <Select label="右操作数聚合" size="sm" className="w-28"
                                                        selectedKeys={[col.operandAgg]}
                                                        onSelectionChange={(keys) => {
                                                            const v = [...keys][0];
                                                            if (v) {
                                                                const n = [...columns];
                                                                n[i].operandAgg = v;
                                                                setColumns(n);
                                                            }
                                                        }}>
                                                    {REPORT_AGG_FUNCS.map((f) => <SelectItem key={f}>{f}</SelectItem>)}
                                                </Select>
                                            </>
                                        )}
                                        {columns.length > 1 && (
                                            <Button isIconOnly size="sm" variant="flat" color="danger"
                                                    onPress={() => setColumns(columns.filter((_, j) => j !== i))}>
                                                <TrashIcon className="h-4 w-4"/>
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Select label="分组字段来源" size="sm" className="w-36" selectedKeys={[breakoutSource]}
                                        onSelectionChange={(keys) => {
                                            const v = [...keys][0];
                                            if (v) setBreakoutSource(v as ReportDataSource);
                                        }}>
                                    {REPORT_SOURCES.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
                                </Select>
                                <Select label="分组字段" size="sm" className="w-36"
                                        selectedKeys={[breakoutField || 'NONE']}
                                        onSelectionChange={(keys) => {
                                            const v = [...keys][0];
                                            setBreakoutField(v === 'NONE' ? '' : v);
                                        }}>
                                    {[<SelectItem
                                        key="NONE">无分组</SelectItem>, ...(REPORT_FIELDS[breakoutSource] || []).map((f) =>
                                        <SelectItem key={f}>{f}</SelectItem>)]}
                                </Select>
                                <Switch size="sm" isSelected={enabled} onValueChange={setEnabled}>启用</Switch>
                            </div>
                        </DrawerBody>
                        <DrawerFooter>
                            <Button variant="flat" onPress={onClose}>取消</Button>
                            <Button color="primary" isLoading={saveMutation.isPending}
                                    onPress={handleSave}>保存</Button>
                        </DrawerFooter>
                    </>
                )}
            </DrawerContent>
        </Drawer>
    );
}
