package com.vex.iot.app.http.sse;

import com.vex.iot.app.http.sse.event.SsePublishEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SSE统一事件推送器
 *
 * <p>按 tenantId 管理 SSE 连接，通过 Spring 事件异步推送各类消息。
 */
@Slf4j
@Component
public class SsePusher {

    /**
     * SSE连接超时时间：30分钟
     */
    private static final long EMITTER_TIMEOUT = 1_800_000L;

    /**
     * SSE发射器映射
     * <p>Key：tenantId，Value：Map<连接ID, SseEmitter>
     */
    private final Map<String, Map<String, SseEmitter>> emitters = new ConcurrentHashMap<>();

    /**
     * 注册SSE连接
     *
     * @param tenantId     租户ID
     * @param connectionId 连接ID
     * @return SSE发射器
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
     * 移除SSE连接
     *
     * @param tenantId     租户ID
     * @param connectionId 连接ID
     */
    private void remove(String tenantId, String connectionId) {
        Map<String, SseEmitter> inner = emitters.get(tenantId);
        if (inner == null) return;
        inner.remove(connectionId);
        if (inner.isEmpty()) {
            emitters.compute(tenantId, (k, v) -> (v == null || v.isEmpty()) ? null : v);
            log.debug("SSE连接全部移除 tenantId={}", tenantId);
        }
    }

    /**
     * 推送消息到指定租户
     *
     * @param tenantId 租户ID
     * @param message  SSE消息
     */
    public void push(String tenantId, SseMessage message) {
        Map<String, SseEmitter> map = emitters.get(tenantId);
        if (map == null || map.isEmpty()) {
            log.debug("租户无SSE连接 tenantId={}", tenantId);
            return;
        }
        map.forEach((cid, em) -> {
            try {
                em.send(SseEmitter.event()
                        .name(message.type())
                        .id(cid)
                        .data(message.payload()));
            } catch (IOException ex) {
                log.debug("SSE推送失败 tenantId={} cid={}", tenantId, cid);
                remove(tenantId, cid);
            } catch (Exception ex) {
                log.warn("SSE推送异常 tenantId={} cid={}", tenantId, cid, ex);
                remove(tenantId, cid);
            }
        });
    }

    /**
     * 处理SSE发布事件
     *
     * @param event SSE发布事件
     */
    @Async
    @EventListener
    public void onSseEvent(SsePublishEvent event) {
        push(event.tenantId(), event.message());
    }
}
