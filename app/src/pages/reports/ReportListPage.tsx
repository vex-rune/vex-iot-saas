import {
    Button,
    Chip,
    Pagination,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Select,
    SelectItem,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Tooltip,
} from '@heroui/react';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {useQueryList} from '@/hooks/common/useQueryList';
import {useIsMobile} from '@/hooks/common/useMediaQuery';
import {EntityCard, FieldRow} from '@/components/ui/EntityCard';
import {PencilIcon, PlayCircleIcon, PlusIcon, TrashIcon} from '@heroicons/react/24/outline';
import {countReportDefinitions, deleteReportDefinition, queryReportDefinitions,} from '@/services/reportService';
import {formatDateTime} from '@/lib/format';
import {toastSuccess} from '@/lib/toast';
import {useNavigate} from 'react-router-dom';
import type {ReportDefinition} from '@/api/reportApi';

/** 从 schemaJson 提取关键配置信息 */
const getSchemaInfo = (item: ReportDefinition) => {
    try {
        const s = item.schemaJson ? JSON.parse(item.schemaJson) : null;
        return {
            source: s?.source ?? '—',
            portalVisible: s?.portal?.visible === true,
            colCount: s?.columns?.length ?? 0
        };
    } catch {
        return {source: '—', portalVisible: false, colCount: 0};
    }
};

export default function ReportListPage() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const {
        data: list, isLoading, total, page, size, totalPages, setPage, setSize, refetch,
    } = useQueryList<ReportDefinition>({
        queryKey: 'report.definitions',
        queryFn: (body) => queryReportDefinitions(body),
        countFn: (body) => countReportDefinitions(body),
        defaultSize: 15,
    });

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => deleteReportDefinition(id),
    });

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id, {
            onSuccess: () => {
                toastSuccess('删除成功');
                refetch();
            },
    });
    };

    return (
        <div className="flex min-h-full flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-semibold text-foreground">报表管理</h1>
                <Button
                    color="primary" size="sm"
                    startContent={<PlusIcon className="h-4 w-4"/>}
                    onPress={() => navigate('/reports/new')}
                >
                    新建报表
                </Button>
            </header>

            {isLoading ? (
                <div className="rounded-2xl bg-content1 p-4">
                    <Skeleton className="h-8 w-48 rounded-lg"/>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-lg mt-3"/>
                    ))}
                </div>
            ) : isMobile ? (
                <div className="masonry">
                    {(list || []).map((item) => (
                        <EntityCard
                            key={item.id}
                            title={item.name}
                            subtitle={formatDateTime(item.createdAt)}
                            badge={
                                <Chip size="sm" variant="flat" color={item.enabled ? 'success' : 'default'}>
                                    {item.enabled ? '已启用' : '已停用'}
                                </Chip>
                            }
                            actions={
                                <>
                                    <Button size="sm" variant="flat" color="primary"
                                            startContent={<PlayCircleIcon className="h-4 w-4"/>}
                                            onPress={() => navigate(`/reports/${item.id}/execute`)}>
                                        执行
                                    </Button>
                                    <Button size="sm" variant="flat"
                                            startContent={<PencilIcon className="h-4 w-4"/>}
                                            onPress={() => navigate(`/reports/${item.id}/edit`)}>
                                        编辑
                                    </Button>
                                    <Popover placement="top">
                                        <PopoverTrigger>
                                            <Button size="sm" variant="flat" color="danger"
                                                    startContent={<TrashIcon className="h-4 w-4"/>}>
                                                删除
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent>
                                            <div className="flex flex-col items-center gap-2 p-2">
                                                <p className="text-sm text-foreground">确认删除该报表?</p>
                                                <Button size="sm" color="danger"
                                                        isLoading={deleteMutation.isPending}
                                                        onPress={() => handleDelete(item.id!)}>
                                                    确认删除
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </>
                            }
                        >
                            {item.description && (
                                <FieldRow label="描述" value={<span className="truncate">{item.description}</span>}/>
                            )}
                            <FieldRow label="数据源"
                                      value={<Chip size="sm" variant="flat">{getSchemaInfo(item).source}</Chip>}/>
                            <FieldRow label="查看页" value={<Chip size="sm" variant="flat"
                                                                  color={getSchemaInfo(item).portalVisible ? 'primary' : 'default'}>{getSchemaInfo(item).portalVisible ? '展示' : '隐藏'}</Chip>}/>
                        </EntityCard>
                    ))}
                </div>
            ) : (
                <Table aria-label="报表定义列表" isStriped
                       classNames={{wrapper: 'bg-content1 rounded-2xl'}}>
                    <TableHeader>
                        <TableColumn>名称</TableColumn>
                        <TableColumn className="hidden md:table-cell">描述</TableColumn>
                        <TableColumn>数据源</TableColumn>
                        <TableColumn>状态</TableColumn>
                        <TableColumn className="hidden sm:table-cell">查看页</TableColumn>
                        <TableColumn className="hidden sm:table-cell">创建时间</TableColumn>
                        <TableColumn width={120}>操作</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="暂无报表定义">
                        {(list || []).map((item) => {
                            const info = getSchemaInfo(item);
                            return (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell className="hidden md:table-cell text-foreground-600 max-w-xs truncate">
                                        {item.description || '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="sm" variant="flat">{info.source}</Chip>
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="sm" variant="flat" color={item.enabled ? 'success' : 'default'}>
                                            {item.enabled ? '已启用' : '已停用'}
                                        </Chip>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        <Chip size="sm" variant="flat"
                                              color={info.portalVisible ? 'primary' : 'default'}>
                                            {info.portalVisible ? '展示' : '隐藏'}
                                        </Chip>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-foreground-600 text-sm">
                                        {formatDateTime(item.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Tooltip content="执行">
                                                <Button isIconOnly size="sm" variant="light"
                                                        onPress={() => navigate(`/reports/${item.id}/execute`)}>
                                                    <PlayCircleIcon className="h-4 w-4"/>
                                                </Button>
                                            </Tooltip>
                                            <Tooltip content="编辑">
                                                <Button isIconOnly size="sm" variant="light"
                                                        onPress={() => navigate(`/reports/${item.id}/edit`)}>
                                                    <PencilIcon className="h-4 w-4"/>
                                                </Button>
                                            </Tooltip>
                                            <Tooltip content="删除" color="danger">
                                                <Popover placement="top">
                                                    <PopoverTrigger>
                                                        <Button isIconOnly size="sm" variant="light" color="danger">
                                                            <TrashIcon className="h-4 w-4"/>
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent>
                                                        <div className="flex flex-col items-center gap-2 p-2">
                                                            <p className="text-sm text-foreground">确认删除该报表?</p>
                                                            <Button size="sm" color="danger"
                                                                    isLoading={deleteMutation.isPending}
                                                                    onPress={() => handleDelete(item.id!)}>
                                                                确认删除
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}

            {/* 分页 — 无条件始终渲染 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground-500">共 {total} 条</span>
                    <Select size="sm" variant="bordered" className="w-24"
                            selectedKeys={[String(size)]}
                            onSelectionChange={(keys) => setSize(Number(Array.from(keys)[0]))}>
                        {['15', '30', '60', '100'].map((s) => (
                            <SelectItem key={s} textValue={s}>{s}</SelectItem>
                        ))}
                    </Select>
                </div>
                <Pagination total={totalPages} page={page + 1}
                            onChange={(p) => setPage(p - 1)} showControls isCompact/>
            </div>
        </div>
    );
}