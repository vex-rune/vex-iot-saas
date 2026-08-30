package com.vex.iot.app.http.model;

import com.vex.iot.domain.schedule.model.DeviceScheduleActionEntity;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * 设备定时控制-保存请求
 * <p>包含规则主体与动作列表；服务端整体覆盖式保存（先删动作再插）。
 */
public record DeviceScheduleRequest(
        @NotNull @Valid DeviceScheduleEntity schedule,
        @NotNull List<DeviceScheduleActionEntity> actions
) {}
