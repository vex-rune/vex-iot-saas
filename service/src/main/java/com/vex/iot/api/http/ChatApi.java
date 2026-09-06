package com.vex.iot.api.http;

import com.vex.iot.common.response.Response;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.ai.AiChatService;
import com.vex.iot.domain.ai.model.ChatResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 对话接口。
 */
@RestController
@RequiredArgsConstructor
public class ChatApi {

    private final AiChatService aiChatApp;

    /**
     * AI 对话（同步模式）。
     *
     * @param body 对话请求
     * @return AI 回复
     */
    @PostMapping("/api/ai/chat")
    public Response<ChatResponse> chat(@Valid @RequestBody ChatRequest body) {
        return Response.ok(aiChatApp.chat(body, UserContext.userId().get(), UserContext.tenantId().get()));
    }

    /**
     * 对话请求体。
     */
    public record ChatRequest(
            @NotBlank(message = "消息不能为空")
            @Size(max = 2000, message = "消息长度不能超过 2000 字符")
            String message,
            String conversationId
    ) {
    }
}
