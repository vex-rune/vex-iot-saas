package com.vex.iot.domain.ai;

import com.vex.iot.app.ai.IoTTools;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.service.AiServices;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * LangChain4j 配置 — 创建 ChatModel 和 AiService。
 */
@Configuration
public class AiConfig {

    @Bean
    public ChatModel chatLanguageModel(
            @Value("${vex.ai.base-url}") String baseUrl,
            @Value("${vex.ai.api-key}") String apiKey,
            @Value("${vex.ai.model}") String model,
            @Value("${vex.ai.temperature:0.1}") double temperature,
            @Value("${vex.ai.max-tokens:2048}") int maxTokens
    ) {
        return OpenAiChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(model)
                .temperature(temperature)
                .maxTokens(maxTokens)
                .logRequests(true)
                .logResponses(true)
                .build();
    }

    @Bean
    public Assistant assistant(ChatModel chatLanguageModel,
                               IoTTools ioTTools) {
        return AiServices.builder(Assistant.class)
                .chatModel(chatLanguageModel)
                .tools(ioTTools)
                .build();
    }
}
