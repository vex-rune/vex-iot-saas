package com.vex.iot.app.http.model;

import com.vex.iot.domain.schedule.model.DeviceScheduleActionEntity;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;

import java.util.List;

/**
 * 设备定时控制-返回详情
 */
public record DeviceScheduleDetail(
        DeviceScheduleEntity schedule,
        List<DeviceScheduleActionEntity> actions
) {}
