import dayjs from 'dayjs';

/** 系统默认时区偏移(后续若需多时区支持,改为按浏览器 tz 推断) */
export const TIMEZONE_OFFSET = '+08:00';

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : '-';
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('HH:mm:ss') : '-';
}

export function toIso(value?: Date | string | number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = dayjs(value);
  return d.isValid() ? d.toISOString() : undefined;
}

/**
 * 后端历史点位的时间戳字段名在不同接口间飘忽:
 * epochSecond (Protobuf 风格) / seconds (Google Timestamp 风格),
 * nanos / nano 同理。
 * 这里做兼容:任一字段有值就转成毫秒,缺值返回 undefined。
 */
export function toEpochMs(ts: { epochSecond?: number; seconds?: number } | undefined | null): number | undefined {
  if (!ts) return undefined;
  const sec = ts.epochSecond ?? ts.seconds;
  if (sec === undefined || sec === null) return undefined;
  return sec * 1000;
}

/** 历史点位组合 key(用于 React 列表稳定 key),结合秒级时间戳与纳秒偏移 */
export function historyKey(ts: { epochSecond?: number; seconds?: number; nano?: number; nanos?: number } | undefined | null): string {
  const sec = ts?.epochSecond ?? ts?.seconds ?? 0;
  const nano = ts?.nano ?? ts?.nanos ?? 0;
  return `${sec}-${nano}`;
}
