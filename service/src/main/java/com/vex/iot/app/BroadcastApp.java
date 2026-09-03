package com.vex.iot.app;

import com.vex.iot.api.sse.SsePusher;
import com.vex.iot.domain.alarm.event.AlarmTriggeredEvent;
import com.vex.iot.domain.data.event.DataEvent;
import com.vex.iot.domain.device.event.DeviceEvent;
import com.vex.iot.domain.event.IEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Objects;

/// 广播应用 — 采集 Data / Device / Alarm 三个域的 {@link IEvent}，统一通过
/// {@link SsePusher} 推送 SSE 到前端连接。
///
/// <p>{@link #onDataEvent} / {@link #onDeviceEvent} / {@link #onAlarmEvent} 三个监听器都用
/// {@link Async} 异步执行；广播链路任何异常都不会反向影响原业务。
///
/// <p>事件载荷：{@link IEvent#getPayload()}；租户路由：{@link IEvent.Metadata#tenantId()}；
/// SSE 事件名由调用方提供（项目约定加 {@code ":"} 后缀）。
///
/// @author Vex
/// @since 1.0
@Slf4j
@Service
@RequiredArgsConstructor
public class BroadcastApp {

    private final SsePusher ssePusher;

    /// Data 域事件入口 — 异步监听所有 {@link DataEvent} 子类。
    @Async
    @EventListener
    public void onDataEvent(DataEvent<?> event) {
        if (Objects.isNull(event)) {
            log.error("DataEvent is null ");
        }
        ssePusher.push("broadcast", event);
    }

    /// Device 域事件入口 — 异步监听所有 {@link DeviceEvent} 子类。
    @Async
    @EventListener
    public void onDeviceEvent(DeviceEvent<?> event) {
        if (Objects.isNull(event)) {
            log.error("DeviceEvent is null ");
        }
        ssePusher.push("broadcast", event);
    }

    /// Alarm 域事件入口 — 异步监听 {@link AlarmTriggeredEvent}。
    @Async
    @EventListener
    public void onAlarmEvent(AlarmTriggeredEvent event) {
        if (Objects.isNull(event)) {
            log.error("AlarmTriggeredEvent is null ");
        }
        ssePusher.push("broadcast", event);
    }

}