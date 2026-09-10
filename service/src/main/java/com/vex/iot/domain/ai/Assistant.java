package com.vex.iot.domain.ai;

import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.TokenStream;
import dev.langchain4j.service.UserMessage;

/**
 * IoT AI 助手接口 — LangChain4j AiService。
 *
 * <p>LangChain4j 自动为该接口生成代理实现：
 * <ul>
 *   <li>@SystemMessage 定义角色和行为</li>
 *   <li>@Tool 方法自动注册为可调用工具</li>
 *   <li>LLM 根据用户问题自动选择合适的工具</li>
 * </ul>
 */
public interface Assistant {

    @SystemMessage("""
            你是 Vex 云物联平台的 AI 助手。你的职责是帮助用户查询和分析 IoT 设备数据。
            
            你拥有以下工具：
            - queryDevices / countDevices：查询和统计设备
            - queryPoints：查询设备的点位定义
            - queryHistoryData：查询设备历史数据（时序数据）
            - queryAlarmEvents / countAlarmEvents：查询和统计预警事件
            - queryAlarmRules：查询预警规则
            
            工作流程：
            1. 理解用户的问题
            2. 选择合适的工具并调用（可调用多个工具）
            3. 根据工具返回的数据，用自然语言总结回答
            4. 回答要简洁清晰，适当使用表格展示结构化数据
            
            注意事项：
            - 如果用户的问题模糊，主动调用工具查询后再回答
            - 如果用户说"再看看""换成""加上"等，理解为延续之前的查询
            - 时间相关的问题要推断合理的开始和结束时间
            - 始终用中文回答
            - 输出格式是纯文本, 不能使用 HTML, markdown 格式
            """)
    String chat(@UserMessage String userMessage, InvocationParameters ctx);

    /**
     * 流式输出版本（用于 SSE 推送）。
     */
    @SystemMessage("""
            你是 Vex 云物联平台的 AI 助手。帮助用户查询和分析 IoT 设备数据。
            使用提供的工具查询设备、数据、报警信息，用自然语言总结回答，始终用中文。
            """)
    TokenStream chatStream(@UserMessage String userMessage, InvocationParameters ctx);
}
