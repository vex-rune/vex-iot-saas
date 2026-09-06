import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Button, Input, Select, SelectItem} from '@heroui/react';
import {ArrowLeftIcon} from '@heroicons/react/24/outline';
import {useQueryClient} from '@tanstack/react-query';
import {useApiMutation} from '@/hooks/common/useApiMutation';
import {createDevice} from '@/services/deviceService';
import type {Device} from '@/types/api';
import {GATEWAY_TYPE_OPTIONS} from '@/types/api';
import {toastError, toastSuccess, toastWarning} from '@/lib/toast';

export default function DeviceCreate() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        deviceName: '',
        gatewayId: '',
        gatewayType: '' as string,
        level1Tag: '',
        level2Tag: '',
        level3Tag: '',
    });

    const createMutation = useApiMutation({
        mutationFn: (data: Partial<Device>) => createDevice(data),
    });

    const handleSave = async () => {
        if (!form.deviceName.trim()) {
            toastWarning('请填写设备名称');
            return;
        }
        try {
            const trimOrUndef = (v: string) => v.trim() || undefined;
            const device = await createMutation.mutateAsync({
                deviceName: form.deviceName.trim(),
                gatewayId: trimOrUndef(form.gatewayId),
                gatewayType: (form.gatewayType || undefined) as import('@/types/api').GatewayType | undefined,
                level1Tag: trimOrUndef(form.level1Tag),
                level2Tag: trimOrUndef(form.level2Tag),
                level3Tag: trimOrUndef(form.level3Tag),
            });
            toastSuccess('设备已创建，请继续设置点位/告警/面板');
            queryClient.invalidateQueries({queryKey: ['devices']});
            // 跳转到编辑页，让用户继续配置点位、告警、面板
            navigate(`/devices/${device.id}/edit`, {replace: true});
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
                    <h1 className="text-xl font-semibold text-foreground">新增设备</h1>
                </div>
                <Button color="primary" isLoading={createMutation.isPending} onPress={handleSave}>保存并继续</Button>
            </header>

            <section className="rounded-2xl bg-content1 p-6">
                <h2 className="mb-4 text-base font-medium text-foreground">设备信息</h2>
                <div className="mx-auto flex max-w-lg flex-col gap-4">
                    <Input label="设备名称" placeholder="请输入设备名称" value={form.deviceName}
                           onValueChange={(v) => setForm((f) => ({...f, deviceName: v}))} variant="bordered"
                           isRequired/>
                    <Input label="网关 ID" placeholder="MQTT 网关硬件标识" value={form.gatewayId}
                           onValueChange={(v) => setForm((f) => ({...f, gatewayId: v}))} variant="bordered"
                           description="设备通过此 ID 与 MQTT 网关绑定"/>
                    <Select label="网关类型" placeholder="选择网关类型"
                            selectedKeys={[form.gatewayType]}
                            onSelectionChange={(k) => setForm((f) => ({...f, gatewayType: k as string}))}
                            variant="bordered">
                        {GATEWAY_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </Select>
                    <Input label="一级标签" placeholder="可选,例如:车间 / 楼层" value={form.level1Tag}
                           onValueChange={(v) => setForm((f) => ({...f, level1Tag: v}))} variant="bordered"/>
                    <Input label="二级标签" placeholder="可选,例如:生产线 / 区域" value={form.level2Tag}
                           onValueChange={(v) => setForm((f) => ({...f, level2Tag: v}))} variant="bordered"/>
                    <Input label="三级标签" placeholder="可选,例如:设备类型 / 编号" value={form.level3Tag}
                           onValueChange={(v) => setForm((f) => ({...f, level3Tag: v}))} variant="bordered"/>
                </div>
                <p className="mx-auto mt-6 max-w-lg text-xs text-foreground-400">
                    保存后将跳转到设备详情页，可继续配置点位、告警规则、面板展示。
                </p>
            </section>
        </div>
    );
}
