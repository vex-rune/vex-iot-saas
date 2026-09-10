/**
 * 报表字段白名单（前后端必须同步）
 * 对齐后端 ReportFieldWhitelist.java
 */
export type ReportDataSource = 'DEVICE' | 'POINT_HISTORY' | 'POINT_REALTIME';

export const REPORT_FIELDS: Record<ReportDataSource, string[]> = {
    DEVICE: [
        'id', 'deviceName', 'gatewayId', 'gatewayType',
        'templateId', 'enabled', 'online',
        'level1Tag', 'level2Tag', 'level3Tag',
        'lastHeartbeatAt', 'tenantId',
    ],
    POINT_HISTORY: [
        'id', 'deviceId', 'pointId', 'pointCode', 'pointName',
        'dataType', 'intValue', 'doubleValue', 'stringValue',
        'unit', 'ts', 'ingestedAt', 'dataState', 'tenantId',
    ],
    POINT_REALTIME: [
        'id', 'deviceId', 'pointId', 'pointName',
        'dataType', 'intValue', 'doubleValue', 'stringValue',
        'unit', 'ts', 'ingestedAt', 'dataState', 'tenantId',
    ],
};

export const REPORT_AGG_FUNCS = ['NONE', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'COUNT_DISTINCT'] as const;
export const REPORT_OPERATORS = ['ADD', 'SUB', 'MUL', 'DIV'] as const;
export const REPORT_FORMATS = ['raw', 'decimal2', 'decimal4', 'percent2', 'int', 'string'] as const;
export const REPORT_SOURCES: ReportDataSource[] = ['DEVICE', 'POINT_HISTORY', 'POINT_REALTIME'];
export const REPORT_SORT_DIRECTIONS = ['ASC', 'DESC'] as const;
