package com.vex.iot.domain.event;

import java.time.LocalDateTime;

/**
 * 领域事件统一接口 — 所有继承此接口的事件都会自动被 {@code BroadcastApp} 采集并广播。
 *
 * <p>采用方案 E：泛型接口 + 内嵌 {@link Metadata} record + 携带领域负载 {@code T}。
 * 设计动机：
 * <ul>
 *   <li>{@link Metadata} 集中描述跨域元数据（事件 ID、租户、来源、时间戳、关联设备/点位），避免每个 Event 重复字段；</li>
 *   <li>泛型 {@code T} 让领域负载类型安全，{@link #getPayload()} 返回真实业务对象，便于广播端序列化；</li>
 *   <li>保持 {@code POJO / record / class} 多形态兼容 —— 现有 {@code AlarmTriggeredEvent / DataUpdateEvent / DeviceHeartbeatEvent / DeviceOfflineEvent / ScheduleFiredEvent} 都可直接实现。</li>
 * </ul>
 *
 * <p>实现方约定：
 * <ol>
 *   <li>{@link #getMetadata()} 必须返回非 null 元数据；</li>
 *   <li>{@link #getPayload()} 返回具体的业务载荷；</li>
 *   <li>{@link #source()} 返回发布该事件的来源 Bean 名或类名，便于追踪与监控。</li>
 * </ol>
 *
 * @param <T> 领域负载类型
 * @author Vex
 * @since 1.0
 */
public interface IEvent<T> {

    /**
     * 元数据。
     */
    Metadata getMetadata();

    /**
     * 业务负载。
     */
    T getPayload();

    /**
     * 事件来源（发布方 Bean 名或类名）。
     */
    default String source() {
        return getClass().getSimpleName();
    }

    /**
     * 通用元数据 — 跨领域事件统一字段。
     *
     * @param eventId    事件唯一 ID（雪花算法）
     * @param tenantId   租户 ID
     * @param source     事件来源（如 {@code device-service} / {@code alarm-engine}）
     * @param occurredAt 事件发生时间
     * @param deviceId   关联设备 ID（可空）
     * @param pointCode  关联点位编码（可空）
     * @param category   事件分类（{@code alarm/data/device/schedule/...}），便于下游按类分发
     */
    record Metadata(
            String eventId,
            String tenantId,
            String source,
            LocalDateTime occurredAt,
            String deviceId,
            String pointCode,
            String category
    ) {
    }
}
