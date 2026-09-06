/**
 * AI 对话 API。
 */
import {post, type RequestChain} from '@/lib/api-client';
import type {ChatApiResponse, ChatRequest} from '@/types/chat';

/**
 * POST /api/ai/chat
 * 发送对话消息，获取 AI 回复。
 */
export function sendChatMessage(body: ChatRequest): RequestChain<ChatApiResponse> {
    return post<ChatApiResponse>('/ai/chat', body, {timeout: 120_000});
}
