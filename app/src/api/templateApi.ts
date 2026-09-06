/**
 * 设备模版 CRUD API — /api/device-templates/...
 */
import {del, get, post, put, type RequestChain} from '@/lib/api-client';
import type {Device, DeviceTemplate, QueryBody} from '@/types/api';

/** 模版-条件查询 */
export function queryTemplates(body: QueryBody): RequestChain<DeviceTemplate[]> {
    return post<DeviceTemplate[]>('/device-templates/query', body);
}

/** 模版-数量查询 */
export function countTemplates(body: QueryBody): RequestChain<number> {
    return post<number>('/device-templates/count', body);
}

/** 模版-详情 */
export function getTemplate(id: string): RequestChain<DeviceTemplate> {
    return get<DeviceTemplate>(`/device-templates/${id}`);
}

/** 模版-新建 */
export function createTemplate(data: Partial<DeviceTemplate>): RequestChain<DeviceTemplate> {
    return post<DeviceTemplate>('/device-templates', data);
}

/** 模版-更新 */
export function updateTemplate(id: string, data: Partial<DeviceTemplate>): RequestChain<DeviceTemplate> {
    return put<DeviceTemplate>(`/device-templates/${id}`, data);
}

/** 模版-删除 */
export function deleteTemplate(id: string): RequestChain<void> {
    return del<void>(`/device-templates/${id}`);
}

/** 从设备生成模版 */
export function createTemplateFromDevice(
    deviceId: string,
    templateName?: string,
    description?: string,
): RequestChain<DeviceTemplate> {
    const params = new URLSearchParams({deviceId});
    if (templateName) params.set('templateName', templateName);
    if (description) params.set('description', description);
    return post<DeviceTemplate>(`/device-templates/from-device?${params.toString()}`);
}

/** 使用模版创建设备 */
export function applyTemplate(
    templateId: string,
    deviceName: string,
    gatewayId?: string,
): RequestChain<Device> {
    const params = new URLSearchParams({templateId, deviceName});
    if (gatewayId) params.set('gatewayId', gatewayId);
    return post<Device>(`/device-templates/${templateId}/apply?${params.toString()}`);
}

/** 同步模版到关联设备 */
export function syncTemplateToDevices(templateId: string): RequestChain<string[]> {
    return post<string[]>(`/device-templates/${templateId}/sync`);
}
