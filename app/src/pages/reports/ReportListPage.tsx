/**
 * 报表定义列表页
 */
import {useEffect, useState} from 'react';
import {
    Button, Chip, Pagination, Skeleton, Table, TableBody, TableCell,
    TableColumn, TableHeader, TableRow, Tooltip,
} from '@heroui/react';
import {useQueryClient} from '@tanstack/react-query';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {useQueryList} from '@/hooks/common/useQueryList';
import {PlusIcon, PencilIcon, TrashIcon, PlayIcon} from '@heroicons/react/24/outline';
import {toastSuccess} from '@/lib/toast';
import {
    queryReportDefinitions, countReportDefinitions, deleteReportDefinition,
} from '@/api/reportApi';
import type {QueryBody, Predicate, PredicateItem} from '@/types/api';
import {formatDateTime} from '@/lib/format';
import {useNavigate} from 'react-router-dom';

export default function ReportListPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;
    const queryBody: QueryBody = {
        predicate: {and: [{condition: {field: 'enabled', op: 'eq', value: true}}]},
        order: [{field: 'createdAt', order: 'DESC'}],
        page: {page, size: PAGE_SIZE},
    };

    const {data: list, isLoading} = useQueryList({
        queryKey: ['report.definitions', queryBody],
        queryFn: () => queryReportDefinitions(queryBody),
        countFn: () => countReportDefinitions(queryBody),
    });

    const deleteMutation = useApiMutation({
        fn: deleteReportDefinition,
        onSuccess: () => {
            toastSuccess('删除成功');
            queryClient.invalidateQueries({queryKey: ['report.definitions']});
        },
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">点位报表</h1>
                <Button
                    color="primary"
                    size="sm"
                    startContent={<PlusIcon className="h-4 w-4"/>}
                    onPress={() => navigate('/reports/new')}
                >
                    新建报表
                </Button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full rounded"/>
                    <Skeleton className="h-10 w-full rounded"/>
                </div>
            ) : (
                <Table aria-label="报表定义列表" className="w-full">
                    <TableHeader>
                        <TableColumn>名称</TableColumn>
                        <TableColumn>描述</TableColumn>
                        <TableColumn>状态</TableColumn>
                        <TableColumn>创建时间</TableColumn>
                        <TableColumn width={120}>操作</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="暂无报表定义">
                        {(list || []).map((item: any) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-foreground/60 max-w-xs truncate">
                                    {item.description || '—'}
                                </TableCell>
                                <TableCell>
                                    <Chip size="sm" color={item.enabled ? 'success' : 'default'}>
                                        {item.enabled ? '已启用' : '已停用'}
                                    </Chip>
                                </TableCell>
                                <TableCell className="text-foreground/60 text-sm">
                                    {formatDateTime(item.createdAt)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-1">
                                        <Tooltip content="执行">
                                            <Button
                                                isIconOnly size="sm" variant="flat"
                                                onPress={() => navigate(`/reports/${item.id}/execute`)}
                                            >
                                                <PlayIcon className="h-4 w-4"/>
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content="编辑">
                                            <Button
                                                isIconOnly size="sm" variant="flat"
                                                onPress={() => navigate(`/reports/${item.id}/edit`)}
                                            >
                                                <PencilIcon className="h-4 w-4"/>
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content="删除" color="danger">
                                            <Button
                                                isIconOnly size="sm" variant="flat" color="danger"
                                                onPress={() => deleteMutation.mutate(item.id)}
                                            >
                                                <TrashIcon className="h-4 w-4"/>
                                            </Button>
                                        </Tooltip>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
