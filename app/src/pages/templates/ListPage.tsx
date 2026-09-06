import {useNavigate} from 'react-router-dom';
import {
    Button,
    Card,
    CardBody,
    Chip,
    Pagination,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Tooltip,
} from '@heroui/react';
import {EyeIcon, PlusIcon, TrashIcon} from '@heroicons/react/24/outline';
import {countTemplates, deleteTemplate, queryTemplates} from '@/services/templateService';
import {useQueryList} from '@/hooks/common/useQueryList';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {useIsMobile} from '@/hooks/common/useMediaQuery';
import {type DeviceTemplate, GATEWAY_TYPE_LABELS} from '@/types/api';
import {formatDateTime} from '@/lib/format';

export default function TemplateListPage() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const {
        data: templates, total, totalPages, page, setPage, isLoading,
    } = useQueryList<DeviceTemplate>({
        queryKey: 'templates',
        queryFn: queryTemplates,
        countFn: countTemplates,
        defaultSize: 20,
    });

    const deleteMutation = useApiMutation({
        mutationFn: (id: string) => deleteTemplate(id),
    });

    return (
        <div className="flex min-h-full flex-col gap-4">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-foreground">模版管理</h1>
                <Button color="primary" startContent={<PlusIcon className="h-4 w-4"/>}
                        onPress={() => navigate('/templates/new')}>
                    新建模版
                </Button>
            </header>

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl"/>)}
                </div>
            ) : !templates || templates.length === 0 ? (
                <div className="rounded-2xl bg-content1 p-12 text-center text-foreground-400">暂无模版</div>
            ) : isMobile ? (
                <div className="flex flex-col gap-3">
                    {templates.map((tpl) => (
                        <Card key={tpl.id} shadow="sm" isPressable className="mb-3 bg-content1"
                              onPress={() => navigate(`/templates/${tpl.id}`)}>
                            <CardBody className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-foreground">{tpl.templateName}</span>
                                        <Chip size="sm"
                                              variant="flat">{GATEWAY_TYPE_LABELS[tpl.gatewayType ?? 'OTHER'] ?? tpl.gatewayType}</Chip>
                                    </div>
                                    <span className="text-xs text-foreground-400">{formatDateTime(tpl.createdAt)}</span>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl bg-content1">
                    <Table aria-label="模版列表" removeWrapper>
                        <TableHeader>
                            <TableColumn>模版名称</TableColumn>
                            <TableColumn>网关类型</TableColumn>
                            <TableColumn>描述</TableColumn>
                            <TableColumn>创建时间</TableColumn>
                            <TableColumn width={100}>操作</TableColumn>
                        </TableHeader>
                        <TableBody>
                            {templates.map((tpl) => (
                                <TableRow key={tpl.id}>
                                    <TableCell>
                                        <span className="text-sm font-medium text-foreground">{tpl.templateName}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="sm" variant="flat">
                                            {GATEWAY_TYPE_LABELS[tpl.gatewayType ?? 'OTHER'] ?? tpl.gatewayType ?? '-'}
                                        </Chip>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-foreground-500">{tpl.description || '-'}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className="text-xs text-foreground-400">{formatDateTime(tpl.createdAt)}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Tooltip content="查看详情">
                                                <Button isIconOnly size="sm" variant="light"
                                                        onPress={() => navigate(`/templates/${tpl.id}`)}>
                                                    <EyeIcon className="h-4 w-4"/>
                                                </Button>
                                            </Tooltip>
                                            <Tooltip content="删除" color="danger">
                                                <Button isIconOnly size="sm" variant="light" color="danger"
                                                        onPress={() => deleteMutation.mutate(tpl.id)}>
                                                    <TrashIcon className="h-4 w-4"/>
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-400">共 {total} 条</span>
                    <Pagination size="sm" page={page} total={totalPages} onChange={setPage}/>
                </div>
            )}
        </div>
    );
}
