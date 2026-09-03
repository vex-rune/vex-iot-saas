package com.vex.iot.api.sse;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.event.IEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/// SSE 统一事件推送器 — 直接消费 {@link IEvent}，并按租户路由到对应连接。
@Slf4j
@Component
public class SsePusher {

    /**
     * 租户缺失时的兜底租户
     */
    static final String DEFAULT_TENANT_FALLBACK = "0";
    /**
     * SSE 连接超时：30 分钟
     */
    private static final long EMITTER_TIMEOUT = 1_800_000L;
    /**
     * SSE event.name 命名空间后缀（按项目约定加 {@code ":"} 前缀）
     */
    private static final String NAME_SUFFIX = ":";

    private final Map<String, Map<String, SseEmitter>> emitters = new ConcurrentHashMap<>();

    /**
     * 解析路由 tenantId；缺失则兜底
     */
    private static String resolveTenantId(IEvent.Metadata meta) {
        String tenantId = meta.tenantId();
        if (tenantId != null && !tenantId.isBlank()) {
            return tenantId;
        }
        log.warn("事件租户为空，使用默认租户兜底 eventId={} category={}",
                meta.eventId(), meta.category());
        return DEFAULT_TENANT_FALLBACK;
    }

    /**
     * IEvent -> SSE 数据体（metadata 摘要 + payload）
     */
    static Map<String, Object> envelopeOf(IEvent<?> event) {
        IEvent.Metadata meta = event.getMetadata();
        Map<String, Object> body = new HashMap<>();
        if (meta != null) {
            body.put("eventId", meta.eventId() != null ? meta.eventId() : IdGenerator.snowId());
            body.put("tenantId", meta.tenantId());
            body.put("source", meta.source());
            body.put("occurredAt", meta.occurredAt() != null ? meta.occurredAt() : Instant.now());
            body.put("deviceId", meta.deviceId());
            body.put("pointCode", meta.pointCode());
            body.put("category", meta.category());
        }
        body.put("data", event.getPayload());
        return body;
    }

    /// category -> SSE event.name 映射（旧的 resolveType 工具，保留供代码内参考）
    static String resolveType(String category) {
        if (category == null) return "system";
        return switch (category) {
            case "device.created", "device.updated",
                 "device.deleted", "device.enabled-changed" -> "device";
            case "device.online.heartbeat", "device.online.offline" -> "device.status";
            case "point.created", "point.updated",
                 "point.deleted", "point.sort-changed" -> "point";
            case "data.update" -> "point";
            case "alarm" -> "alarm";
            default -> "system";
        };
    }

    /**
     * 注册 SSE 连接
     */
    public SseEmitter register(String tenantId, String connectionId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT);
        emitters.computeIfAbsent(tenantId, k -> new ConcurrentHashMap<>()).put(connectionId, emitter);
        emitter.onCompletion(() -> remove(tenantId, connectionId));
        emitter.onTimeout(() -> remove(tenantId, connectionId));
        emitter.onError(t -> remove(tenantId, connectionId));
        log.debug("SSE连接注册 tenantId={} connectionId={}", tenantId, connectionId);
        return emitter;
    }

    /**
     * 原子删除连接并清理空桶
     */
    private void remove(String tenantId, String connectionId) {
        emitters.computeIfPresent(tenantId, (k, inner) -> {
            inner.remove(connectionId);
            return inner.isEmpty() ? null : inner;
        });
        log.debug("SSE连接移除 tenantId={} connectionId={}", tenantId, connectionId);
    }

    /**
     * 推送 {@link IEvent} 到目标租户的所有连接。
     *
     * @param eventName SSE 事件名（最终会拼上 {@code ":"} 后缀）
     * @param event     业务事件（不允许为 null，由调用方保证）
     */
    public void push(String eventName, IEvent<?> event) {
        if (event == null) {
            log.warn("事件为 null，跳过推送 eventName={}", eventName);
            return;
        }

        IEvent.Metadata meta = event.getMetadata();
        String tenantId = resolveTenantId(meta);

        Map<String, SseEmitter> connections = emitters.get(tenantId);
        if (connections == null || connections.isEmpty()) {
            log.debug("租户无SSE连接 tenantId={}", tenantId);
            return;
        }

        Object envelope = envelopeOf(event);

        for (Map.Entry<String, SseEmitter> entry : connections.entrySet()) {
            sendOne(tenantId, entry, eventName, envelope);
        }
    }

    /**
     * 单条推送，失败则清理连接
     */
    private void sendOne(String tenantId, Map.Entry<String, SseEmitter> entry, String sseName, Object payload) {
        String cid = entry.getKey();
        SseEmitter em = entry.getValue();
        try {
            em.send(SseEmitter.event()
                    .name(sseName)
                    .id(cid)
                    .data(payload));
        } catch (IOException ex) {
            log.debug("SSE推送失败 tenantId={} cid={}", tenantId, cid);
            remove(tenantId, cid);
        } catch (Exception ex) {
            log.warn("SSE推送异常 tenantId={} cid={}", tenantId, cid, ex);
            remove(tenantId, cid);
        }
    }
}