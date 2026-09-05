/**
 * 通知用户 service — UI 调用入口(barrel re-export,语义隔离层)
 *
 * 严格分层:
 *   - @/api/notifyUsers 只做 HTTP 声明
 *   - 本 service 是 UI 唯一入口
 */
export {
  queryNotifyUsers, countNotifyUsers,
  saveNotifyUser, deleteNotifyUser,
  queryNotifyRecords, countNotifyRecords,
  queryNotifyTemplates, countNotifyTemplates,
  saveNotifyTemplate, deleteNotifyTemplate,
} from '@/api/notifyUsers';