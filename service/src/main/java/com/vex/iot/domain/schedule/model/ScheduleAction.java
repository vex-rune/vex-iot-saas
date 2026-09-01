package com.vex.iot.domain.schedule.model;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 定时规则动作（嵌入式，不单独建表）。
 * <p>值统一以字符串保存，触发时按点位 {@code dataType} 转换。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleAction {

    /// 目标点位ID（便于直接定位）
    @Size(max = 64)
    private String pointId;

    /// 目标点位编码（MQTT 通道标识）
    @Size(max = 64)
    private String pointCode;

    /// 写入值（字符串，触发时按点位类型转换）
    @Size(max = 256)
    private String valueText;

    /// 排序（多条动作时按此顺序执行）
    private Integer sortOrder;
}
