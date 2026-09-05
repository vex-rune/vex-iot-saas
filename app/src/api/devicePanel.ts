/**
 * 设备面板配置 — /api/devices/{deviceId}/panel-config
 */
import { get, put, del, type RequestChain } from '@/lib/api-client';
import type { DevicePanelConfig, PanelConfigObject } from '@/types/api';

/** 获取设备面板配置 */
export function getPanelConfig(deviceId: string): RequestChain<DevicePanelConfig | null> {
  return get<DevicePanelConfig | null>(`/devices/${deviceId}/panel-config`);
}

/** 保存设备面板配置 */
export function savePanelConfig(
  deviceId: string,
  panelConfig: PanelConfigObject,
): RequestChain<DevicePanelConfig> {
  return put<DevicePanelConfig>(`/devices/${deviceId}/panel-config`, { panelConfig });
}

/** 删除设备面板配置 */
export function deletePanelConfig(deviceId: string): RequestChain<void> {
  return del<void>(`/devices/${deviceId}/panel-config`);
}
