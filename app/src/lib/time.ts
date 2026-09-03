/**
 * 时间工具集 — 统一处理 UTC ISO 8601 与本地(Asia/Shanghai)渲染。
 *
 * <p>后端 API 自 v2.0 起统一返回 {@code Instant} 序列化的 ISO 8601 字符串
 * (形如 {@code "2026-09-03T09:14:48.632Z"});前端拿到后:
 * <ul>
 *   <li>需要原始时间值时,使用 {@link parseUtcIso} 转为 {@link Date};</li>
 *   <li>需要展示时,使用 {@link formatDateTime} / {@link formatDate} 渲染为本地时间;</li>
 *   <li>需要构造请求参数时,使用 {@link nowIsoUtc} 生成 UTC ISO 字符串。</li>
 * </ul>
 */

const SHANGHAI_TZ = "Asia/Shanghai";

/**
 * 把 UTC ISO 字符串解析为 {@link Date};若解析失败或为空,返回 null。
 *
 * <p>兼容三种入参:
 * <ul>
 *   <li>{@code "2026-09-03T09:14:48.632Z"} — 带 Z(UTC)</li>
 *   <li>{@code "2026-09-03T09:14:48+08:00"} — 带偏移</li>
 *   <li>{@code "2026-09-03T09:14:48"} — 无时区(按本地时间解释)</li>
 * </ul>
 */
export function parseUtcIso(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 把 UTC ISO 字符串渲染为本地时间字符串(Asia/Shanghai)。
 *
 * @param input  UTC ISO 字符串(或 Date 实例)
 * @param pattern 可选;'datetime' 默认;'date' 仅日期;'time' 仅时间;'full' 带星期
 */
export function formatDateTime(
  input: string | Date | null | undefined,
  pattern: "datetime" | "date" | "time" | "full" = "datetime",
): string {
  const d = input instanceof Date ? input : parseUtcIso(input);
  if (!d) return "-";

  const opts: Intl.DateTimeFormatOptions =
    pattern === "date"
      ? { timeZone: SHANGHAI_TZ, year: "numeric", month: "2-digit", day: "2-digit" }
      : pattern === "time"
        ? { timeZone: SHANGHAI_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }
        : pattern === "full"
          ? {
              timeZone: SHANGHAI_TZ,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
              weekday: "short",
            }
          : {
              timeZone: SHANGHAI_TZ,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            };

  return new Intl.DateTimeFormat("zh-CN", opts).format(d);
}

/** 简短日期:YYYY-MM-DD */
export function formatDate(input: string | Date | null | undefined): string {
  return formatDateTime(input, "date");
}

/** 简短时间:HH:mm:ss */
export function formatTime(input: string | Date | null | undefined): string {
  return formatDateTime(input, "time");
}

/** 当前时间的 UTC ISO 8601 字符串(带 Z),用于请求参数。 */
export function nowIsoUtc(): string {
  return new Date().toISOString();
}

/** epoch 毫秒 → 本地时间字符串 */
export function fromEpochMillis(ms: number, pattern: "datetime" | "date" | "time" = "datetime"): string {
  return formatDateTime(new Date(ms), pattern);
}