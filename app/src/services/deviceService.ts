/**
 * 设备 service — UI 调用入口(barrel re-export,语义隔离层)
 *
 * 严格分层:
 *   - @/api/devicesApi 子模块(deviceApi.ts / devicePointsApi.ts / devicePanelApi.ts)只做 HTTP 声明
 *   - 本 service 是 UI 唯一入口,即使没业务也必须经过这里(避免上层绕过)
 */
export {
    queryDevices, countDevices,
    queryActiveDevices, countActiveDevices,
    queryDeletedDevices, countDeletedDevices,
    getDevice, createDevice, updateDevice, deleteDevice,
    toggleDeviceEnabled, getDeviceOnline,
} from '@/api/devicesApi';

export {
    getDevicePoints, queryPoints, countPoints,
    savePoint, deletePoint, sortDevicePoints,
} from '@/api/devicesApi';

export {
    getPanelConfig, savePanelConfig, deletePanelConfig,
} from '@/api/devicesApi';

export type {DevicePanelConfig, PanelConfigObject} from '@/types/api';