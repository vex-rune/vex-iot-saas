package com.vex.iot.api.sse;

import java.util.Map;

/**
 * SSE消息
 *
 * @param type    消息类型：point-点位数据, alarm-报警, notify-通知, system-系统通知
 * @param payload 消息内容（信封结构：包含 metadata 元数据 + data 具体内容）
 */
public record SseMessage(String type, Payload payload) {

    /**
     * 信封结构：包含元数据和具体内容
     *
     * @param metadata 元数据（如：时间戳、来源等）
     * @param data     具体业务内容
     */
    public record Payload(Map<String, Object> metadata, Object data) {
    }

    public static SseMessage point(Object data) {
        return new SseMessage("point", new Payload(Map.of("timestamp", System.currentTimeMillis()), data));
    }

    public static SseMessage alarm(Object data) {
        return new SseMessage("alarm", new Payload(Map.of("timestamp", System.currentTimeMillis()), data));
    }

    public static SseMessage notify(Object data) {
        return new SseMessage("notify", new Payload(Map.of("timestamp", System.currentTimeMillis()), data));
    }

    public static SseMessage system(Object data) {
        return new SseMessage("system", new Payload(Map.of("timestamp", System.currentTimeMillis()), data));
    }

    /**
     * 带自定义元数据的工厂方法
     */
    public static SseMessage of(String type, Map<String, Object> metadata, Object data) {
        return new SseMessage(type, new Payload(metadata, data));
    }
}
