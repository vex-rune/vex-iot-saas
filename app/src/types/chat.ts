/**
 * AI 对话类型定义。
 */

/** 对话消息 */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    /** AI 返回的结构化数据 */
    data?: Record<string, unknown>[];
    /** 推荐的可视化方式 */
    visualization?: 'text' | 'table' | 'line-chart' | 'bar-chart' | 'gauge';
    /** 对话 ID */
    conversationId?: string;
    timestamp: number;
}

/** AI 对话请求 */
export interface ChatRequest {
    message: string;
    conversationId?: string;
}

/** AI 对话响应 */
export interface ChatApiResponse {
    reply: string;
    data?: Record<string, unknown>[];
    resource?: string;
    action?: string;
    visualization?: string;
    conversationId?: string;
}
