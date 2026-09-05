/**
 * 控制执行记录 service — UI 调用入口(barrel re-export,语义隔离层)
 *
 * 严格分层:
 *   - @/api/controlRecords 只做 HTTP 声明
 *   - 本 service 是 UI 唯一入口
 */
export { queryControlRecords, countControlRecords } from '@/api/controlRecords';
export type { ControlRecord } from '@/api/controlRecords';