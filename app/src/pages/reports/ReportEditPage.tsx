import {useEffect} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Button, Skeleton} from '@heroui/react';
import {ArrowLeftIcon} from '@heroicons/react/24/outline';
import {useQuery} from '@tanstack/react-query';
import {chainToPromise} from '@/hooks/common/useQueryList';
import {getReportDefinition, type ReportDefinition} from '@/services/reportService';
import {toastError} from '@/lib/toast';
import ReportBuilderForm from './ReportBuilderDrawer';

/**
 * 报表新建 / 编辑入口页面.
 *
 * 设计: 全页表单布局 (对齐 DeviceEditPage), 不再使用 Drawer.
 */
export default function ReportEditPage() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const {data: editingDef, isLoading, error} = useQuery<ReportDefinition | null>({
        queryKey: ['report.def', id],
        queryFn: () => (id ? chainToPromise(getReportDefinition(id)) : Promise.resolve(null)),
        enabled: isEdit,
        retry: false,
    });

    useEffect(() => {
        if (error) {
            toastError('加载报表定义失败', (error as Error)?.message || '请稍后重试');
            navigate('/report-admin');
        }
    }, [error, navigate]);

    return (
        <div className="flex min-h-full flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="flat"
                            startContent={<ArrowLeftIcon className="h-4 w-4"/>}
                            onPress={() => navigate('/report-admin')}>
                        返回列表
                    </Button>
                    <h1 className="text-xl font-semibold text-foreground">
                        {isEdit ? '编辑报表' : '新建报表'}
                    </h1>
                </div>
            </header>

            {isEdit && isLoading ? (
                <div className="rounded-2xl bg-content1 p-4">
                    <Skeleton className="h-8 w-48 rounded-lg"/>
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg mt-3"/>
                    ))}
                </div>
            ) : (
                <ReportBuilderForm
                    editingDef={editingDef ?? null}
                    onSaveSuccess={() => navigate('/report-admin')}
                    onCancel={() => navigate('/report-admin')}
                />
            )}
        </div>
    );
}
