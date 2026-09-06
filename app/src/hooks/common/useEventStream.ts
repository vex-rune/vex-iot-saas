import {useEffect, useRef, useState} from 'react';
import {useAuthStore} from '@/stores/authStore';
import {API_BASE} from '@/lib/env';

/**
 * SSE 事件载荷(handler 收到的 data 参数)。
 *
 * <p>hook 在拿到 SSE 消息后,自动尝试 {@code JSON.parse},失败则降级为原始字符串;
 * handler 收到的总是同一类型,无需自行解析。</p>
 */
export type SsePayload = unknown;

/**
 * SSE 连接状态。
 *
 * <ul>
 *   <li>{@code connecting}: 正在建立连接</li>
 *   <li>{@code open}: 连接已建立,正在接收事件</li>
 *   <li>{@code closed}: 连接已断开(主动关闭或被禁用),不会再自动重连</li>
 *   <li>{@code error}: 上次连接异常,正在等待重连</li>
 * </ul>
 */
export type SseStatus = 'connecting' | 'open' | 'closed' | 'error';

export type SseEventHandler = (payload: SsePayload, raw: MessageEvent) => void;
export type SseEventMap = Record<string, SseEventHandler>;

export interface UseEventStreamResult {
  /** 当前连接状态 */
  status: SseStatus;
}

/**
 * SSE 单连接,断线 5s 自动重连;组件卸载或 enabled=false 时关闭.
 *
 * 使用 fetch + ReadableStream 实现, 支持 Authorization header 传 token.
 * (浏览器原生 EventSource 不支持自定义 header)
 *
 * <p>事件载荷会自动 {@code JSON.parse}:handler 收到的是解析后的 JS 对象;
 * 解析失败则降级为原始字符串。ISO 时间字符串不会自动转 Date,handler 需自行
 * 用 {@code @/lib/time} 的 {@code parseUtcIso} 处理。</p>
 *
 * <p>使用示例:
 * <pre>{@code
 *   const { status } = useEventStream({
 *     'point.realtime': (payload) => {
 *       const p = payload as { deviceId: string; value: number; timestamp: string };
 *       console.log(parseUtcIso(p.timestamp));
 *     },
 *   });
 * }</pre>
 */
export function useEventStream(
  events: SseEventMap,
  enabled = true,
): UseEventStreamResult {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const [status, setStatus] = useState<SseStatus>(enabled ? 'connecting' : 'closed');

  useEffect(() => {
    if (!enabled) {
      setStatus('closed');
      return;
    }
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      setStatus('closed');
      return;
    }

    let controller: AbortController | null = null;
    let reconnectTimer: number | null = null;
    let stopped = false;

    setStatus('connecting');

    const connect = async () => {
      if (stopped) return;

      controller = new AbortController();

      try {
        const resp = await fetch(`${API_BASE}/sse/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!resp.ok) {
          // 非 2xx: 不重连(401/403 等,需用户重新登录)
          if (!stopped) setStatus('error');
          return;
        }

        if (!stopped) setStatus('open');

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

            const handler = eventsRef.current[eventType];
            if (handler) {
              // 自动 JSON.parse:后端约定 SSE data 是 JSON 字符串
              let payload: SsePayload = eventData;
              if (eventData.length > 0) {
                try {
                  payload = JSON.parse(eventData);
                } catch {
                  // 不是 JSON,降级为原始字符串
                  payload = eventData;
                }
              }
              handler(payload, new MessageEvent(eventType, { data: eventData }));
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (!stopped) setStatus('error');
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
      setStatus('closed');
    };
  }, [enabled]);

  return { status };
}