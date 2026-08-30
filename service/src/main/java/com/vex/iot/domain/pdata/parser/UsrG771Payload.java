package com.vex.iot.domain.pdata.parser;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * USR-G771 边缘网关 MQTT 上报报文解析结果。
 * 文档:docs/有人/边缘网关_USR-G771_MQTT_上报与写数据.md §3
 * <p>
 * 上报报文:
 * {
 * "params": {
 * "dir": "up",
 * "id": "00601924061200038538",
 * "r_data": [
 * { "name": "data1", "value": "10", "err": "0" },
 * ...
 * ]
 * }
 * }
 * <p>
 * 该结构只描述"原始点位值":字符串 value + 读取错误码。原始值保留字符串,
 * 由 PointDataServer / AlarmEngine 按点位定义的 forwardFormula 转换为展示值。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UsrG771Payload {

    /**
     * 设备唯一标识(网关 SN / ClientID)。
     */
    private String deviceCode;

    /**
     * 设备侧时间戳(网关未带则取服务端入库时间)。
     */
    private Instant deviceTimestamp;

    /**
     * 变量名 -> 原始字符串值。
     */
    private Map<String, String> values;

    /**
     * 变量名 -> 错误码(0=正常)。
     */
    private Map<String, String> errors;

    /**
     * r_data 顺序,用于必要时按顺序遍历。
     */
    private List<String> pointNames;
}