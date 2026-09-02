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

import java.util.Optional;

/// 广播应用 — 采集 Data/Device/Alarm 域 IEvent，直接转发到 SsePusher。
///
/// <p>采用 {@link Optional} 表达"事件可能为空"的语义，
/// {@link #broadcast} 入口接收 {@link Optional} 容器，
/// 内部统一以 {@code isPresent() / orElseThrow()} 流程处理。
///
/// @author Vex
/// @since 1.0
@Slf4j
@Service
@RequiredArgsConstructor
public class BroadcastApp {

    private final SsePusher ssePusher;

    @Async
    @EventListener
    public void onDataEvent(DataEvent<?> event) {
        broadcast(Optional.ofNullable(event));
    }

    @Async
    @EventListener
    public void onDeviceEvent(DeviceEvent<?> event) {
        broadcast(Optional.ofNullable(event));
    }

    @Async
    @EventListener
    public void onAlarmEvent(AlarmTriggeredEvent event) {
        broadcast(Optional.ofNullable(event));
    }

    /// 统一广播入口：接收 {@link Optional} 容器，自动跳过空事件。
    void broadcast(Optional<IEvent<?>> ievent) {
        ievent
                .filter(this::shouldBroadcast)
                .ifPresentOrElse(
                        this::pushSafely,
                        () -> log.debug("事件为空或被广播策略过滤，跳过")
                );
    }

    /// 内部推送（异常隔离）。
    private void pushSafely(IEvent<?> event) {
        try {
            ssePusher.push("broadcast",event);
            IEvent.Metadata meta = event.getMetadata();
            log.info("广播事件已下发 category={} tenantId={} deviceId={} point={}",
                    meta.category(), meta.tenantId(), meta.deviceId(), meta.pointCode());
        } catch (Exception ex) {
            log.error("广播事件处理失败 event={}", event, ex);
        }
    }

    /// 广播策略钩子 — 屏蔽内部 / 测试事件，按需扩展。
    protected boolean shouldBroadcast(IEvent<?> ievent) {
        return ievent != null;
    }
}