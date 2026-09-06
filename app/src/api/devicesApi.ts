/**
 * 设备管理 API - barrel re-export
 *
 * 按职责已拆分为:
 *   - deviceApi.ts       设备 CRUD + 条件查询
 *   - devicePointsApi.ts 点位管理
 *   - devicePanelApi.ts  面板配置
 *
 * 本文件保留统一导出,现有 import '@/api/devicesApi' 零改动。
 */
export {
    queryDevices, countDevices,
    queryActiveDevices, countActiveDevices,
    queryDeletedDevices, countDeletedDevices,
    getDevice, createDevice, updateDevice, deleteDevice,
    toggleDeviceEnabled, getDeviceOnline,
} from './deviceApi';

export {
    getDevicePoints, queryPoints, countPoints,
    savePoint, deletePoint, sortDevicePoints,
} from './devicePointsApi';

export {
    getPanelConfig, savePanelConfig, deletePanelConfig,
} from './devicePanelApi';

// 类型 re-export(方便调用方从 @/api/devicesApi 一把拿到)
export type {DevicePanelConfig, PanelConfigObject} from '@/types/api';