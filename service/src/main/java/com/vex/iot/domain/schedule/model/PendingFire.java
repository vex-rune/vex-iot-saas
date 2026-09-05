package com.vex.iot.domain.schedule.model;

import java.time.Instant;

/**
 * 待触发条目。
 *
 * @param fireTime 预计触发时间
 * @param schedule 对应的规则实体
 */
public record PendingFire(Instant fireTime, DeviceScheduleEntity schedule) {
}