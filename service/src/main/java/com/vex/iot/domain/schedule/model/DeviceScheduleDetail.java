package com.vex.iot.domain.schedule.model;

/**
 * 设备定时控制-返回详情。
 * <p>直接包装 Entity，因为 actions 已嵌入在 Entity 中。
 */
public record DeviceScheduleDetail(DeviceScheduleEntity schedule) {}
