package com.vex.iot.domain.ai.model;

import lombok.Data;

@Data
public class ChatResponse {
    private String reply;
    private Object data;
    private String resource;
    private String action;
    private String visualization;
    private String conversationId;

    public static ChatResponse text(String reply, String conversationId) {
        ChatResponse resp = new ChatResponse();
        resp.reply = reply;
        resp.conversationId = conversationId;
        return resp;
    }
}
