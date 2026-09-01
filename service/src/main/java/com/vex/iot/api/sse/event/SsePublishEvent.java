package com.vex.iot.api.sse.event;

import com.vex.iot.api.sse.SseMessage;
import org.springframework.context.ApplicationEvent;

/**
 * SSE发布事件
 *
 * <p>通过 Spring 事件机制发布 SSE 消息。
 */
public class SsePublishEvent extends ApplicationEvent {

    /**
     * 目标租户ID
     */
    private final String tenantId;

    /**
     * SSE消息
     */
    private final SseMessage message;

    public SsePublishEvent(Object source, String tenantId, SseMessage message) {
        super(source);
        this.tenantId = tenantId;
        this.message = message;
    }

    public String tenantId() {
        return tenantId;
    }

    public SseMessage message() {
        return message;
    }
}
