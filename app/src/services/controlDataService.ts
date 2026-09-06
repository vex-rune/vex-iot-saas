/**
 * 控制点下发 service — 把 value 按 dataType 投到 intValue/doubleValue/stringValue 字段
 *
 * 分层契约:
 *   - @/api/dataApi.postControlData 是纯 HTTP 透传(接收已分好字段的 req)
 *   - 本 service 做"值路由"业务:boolean/number/string → intValue/doubleValue/stringValue
 *
 * 调用方:  import { controlData } from '@/services/controlDataService';
 * 替代直接调 @/api/dataApi 的旧 controlData(那个已删除业务逻辑)。
 */
import {postControlData} from '@/api/dataApi';
import type {DataRecord, DataType} from '@/types/api';
import type {RequestChain} from '@/lib/api-client';

/** 控制下发请求(单 value,统一入口) */
export interface ControlDataServiceReq {
    deviceId: string;
    pointCode: string;
    value: string | number | boolean;
    /** 可选,服务端按此分类;若不传服务端会自动按点位 dataType 路由 */
    dataType?: DataType;
}

/**
 * 把单一 value 按 dataType 投到 intValue / doubleValue / stringValue 字段后下发。
 * - boolean         → intValue (0/1)
 * - number + BOOL/INT → intValue
 * - number + 其他   → doubleValue
 * - string          → stringValue
 * - dataType 缺省   → BOOL (与旧 controlData 行为一致)
 */
export function controlData(req: ControlDataServiceReq): RequestChain<DataRecord> {
    const {value, dataType} = req;
    let intValue: number | null = null;
    let doubleValue: number | null = null;
    let stringValue: string | null = null;
    if (typeof value === 'boolean') {
        intValue = value ? 1 : 0;
    } else if (typeof value === 'number') {
        if (dataType === 'BOOL' || dataType === 'INT') {
            intValue = value;
        } else {
            // FLOAT / DOUBLE / STRING(数值情况)
            doubleValue = value;
        }
    } else {
        stringValue = String(value);
    }
    return postControlData({
        deviceId: req.deviceId,
        pointCode: req.pointCode,
        intValue,
        doubleValue,
        stringValue,
        dataType: dataType ?? 'BOOL',
    });
}