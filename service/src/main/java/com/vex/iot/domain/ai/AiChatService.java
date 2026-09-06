package com.vex.iot.domain.ai;

import com.vex.iot.api.http.ChatApi;
import com.vex.iot.domain.ai.model.ChatCompletedEvent;
import com.vex.iot.domain.ai.model.ChatResponse;
import dev.langchain4j.invocation.InvocationParameters;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

/**
 * AI 对话编排核心 — 使用 LangChain4j AiService。
 *
 * <p>LLM 通过 @Tool 自动调用 IoTTools 查询数据，
 * 不再需要手动解析 JSON 和构建 QueriesPageRequest。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiChatService {

    private final Assistant assistant;
    private final ApplicationEventPublisher eventPublisher;


    public ChatResponse chat(ChatApi.@Valid ChatRequest chatRequest, String userId, String tenantId) {
        String userMessage = chatRequest.message();


        try {
            // LangChain4j 自动：调用 @Tool → 执行查询 → 生成自然语言回答
            String reply = assistant.chat(userMessage, InvocationParameters.from("tenantId", tenantId));
            log.info("[AI Chat] reply length={}", reply != null ? reply.length() : 0);

            eventPublisher.publishEvent(new ChatCompletedEvent(userId, tenantId, "ai_chat", "chat"));
            return ChatResponse.text(reply != null ? reply : "抱歉，我暂时无法回答。", userId);

        } catch (Exception e) {
            log.error("[AI Chat] failed: {}", e.getMessage(), e);
            return ChatResponse.text("AI 服务暂时不可用，请稍后重试。", userId);
        }
    }

}
