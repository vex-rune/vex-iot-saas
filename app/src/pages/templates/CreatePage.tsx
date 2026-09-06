import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Button, Input, Select, SelectItem, Textarea} from '@heroui/react';
import {ArrowLeftIcon} from '@heroicons/react/24/outline';
import {useQueryClient} from '@tanstack/react-query';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {createTemplate} from '@/services/templateService';
import {GATEWAY_TYPE_OPTIONS, type GatewayType} from '@/types/api';
import {toastError, toastSuccess, toastWarning} from '@/lib/toast';

export default function TemplateCreatePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        templateName: '',
        description: '',
        gatewayType: '' as string,
    });

    const createMutation = useApiMutation({
        mutationFn: (data: Parameters<typeof createTemplate>[0]) => createTemplate(data),
    });

    const handleSave = async () => {
        if (!form.templateName.trim()) {
            toastWarning('请填写模版名称');
            return;
        }
        try {
            const template = await createMutation.mutateAsync({
                templateName: form.templateName.trim(),
                description: form.description.trim() || undefined,
                gatewayType: (form.gatewayType || undefined) as GatewayType | undefined,
            });
            toastSuccess('模版已创建');
            queryClient.invalidateQueries({queryKey: ['templates']});
            navigate(`/templates/${template.id}`, {replace: true});
        } catch {
            toastError('创建失败');
        }
    };

    return (
        <div className="flex min-h-full flex-col gap-4">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button isIconOnly variant="light" onPress={() => navigate(-1)}>
                        <ArrowLeftIcon className="h-5 w-5"/>
                    </Button>
                    <h1 className="text-xl font-semibold text-foreground">新建模版</h1>
                </div>
                <Button color="primary" isLoading={createMutation.isPending} onPress={handleSave}>保存</Button>
            </header>

            <section className="rounded-2xl bg-content1 p-6">
                <h2 className="mb-4 text-base font-medium text-foreground">模版信息</h2>
                <div className="mx-auto flex max-w-lg flex-col gap-4">
                    <Input label="模版名称" placeholder="请输入模版名称" value={form.templateName}
                           onValueChange={(v) => setForm((f) => ({...f, templateName: v}))}
                           variant="bordered" isRequired/>
                    <Textarea label="描述" placeholder="可选，描述模版用途" value={form.description}
                              onValueChange={(v) => setForm((f) => ({...f, description: v}))}
                              variant="bordered" minRows={2}/>
                    <Select
                        label="网关类型"
                        placeholder="选择网关类型"
                        selectedKeys={[form.gatewayType]}
                        onSelectionChange={(k) => setForm((f) => ({...f, gatewayType: k as string}))}
                        variant="bordered"
                    >
                        {GATEWAY_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </Select>
                </div>
                <p className="mx-auto mt-6 max-w-lg text-xs text-foreground-400">
                    创建空模版后，可在详情页中「从设备生成」覆盖配置，或手动配置点位/定时/面板。
                </p>
            </section>
        </div>
    );
}
