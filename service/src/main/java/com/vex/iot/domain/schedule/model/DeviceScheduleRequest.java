package com.vex.iot.domain.schedule.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * 设备定时控制-保存请求。
 * <p>actions 嵌入在 schedule 中，作为 JSON 字段存储。
 */
public record DeviceScheduleRequest(
        @NotNull @Valid DeviceScheduleEntity schedule
) {
}
