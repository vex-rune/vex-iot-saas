package com.vex.iot.domain.pdata.event;

import com.vex.iot.common.model.CurrentUser;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * 点位实时值快照事件:实时表 upsert 后广播,
 * 供报警引擎、点位推送(SSE)、审计等横切逻辑订阅。
 *
 * <p>异步订阅方不再依赖 ThreadLocal 的 UserContext,事件本身携带触发者 CurrentUser。
 * 设备上行场景的 triggerUser 由 UpstreamMqttSubscriber 通过 ofDevice() 构造。
 * <p>
 * 注意:values 是"原始字符串值",订阅方按点位定义自行转换为展示值。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PointValueSnapshot {

    /**
     * 触发本次快照的上下文:可能是用户,也可能是设备。
     */
    private CurrentUser triggerUser;

    private String tenantId;
    private String deviceId;
    private String deviceCode;
    private Instant timestamp;
    private Map<String, String> values;
}
