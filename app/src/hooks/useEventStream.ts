import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { API_BASE } from '@/lib/env';

export type SseEventHandler = (event: MessageEvent) => void;
export type SseEventMap = Record<string, SseEventHandler>;

/**
 * SSE 单连接,断线 5s 自动重连;组件卸载或 enabled=false 时关闭.
 *
 * 使用 fetch + ReadableStream 实现, 支持 Authorization header 传 token.
 * (浏览器原生 EventSource 不支持自定义 header)
 */
export function useEventStream(events: SseEventMap, enabled = true): void {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!enabled) return;
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    let controller: AbortController | null = null;
    let reconnectTimer: number | null = null;
    let stopped = false;

    const connect = async () => {
      if (stopped) return;

      controller = new AbortController();

      try {
        const resp = await fetch(`${API_BASE}/sse/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!resp.ok) {
          // 非 2xx: 不重连
          return;
        }

        const reader = resp.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE 消息以 \n\n 分隔
          const messages = buffer.split('\n\n');
          buffer = messages.pop()!; // 最后一段可能不完整, 留到下次

          for (const msg of messages) {
            if (!msg.trim()) continue;

            let eventType = 'message';
            let eventData = '';

            for (const line of msg.split('\n')) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                eventData += (eventData ? '\n' : '') + line.slice(5).trim();
              }
            }

            // 触发注册的事件处理器
            const handler = eventsRef.current[eventType];
            if (handler) {
              handler(new MessageEvent(eventType, { data: eventData }));
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      } finally {
        if (!stopped) {
          reconnectTimer = window.setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      controller?.abort();
      controller = null;
    };
  }, [enabled]);
}
