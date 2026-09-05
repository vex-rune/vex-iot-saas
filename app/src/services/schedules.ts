/**
 * 设备定时 service — UI 调用入口(barrel re-export,语义隔离层)
 *
 * 严格分层:
 *   - @/api/schedules 只做 HTTP 声明
 *   - 本 service 是 UI 唯一入口
 */
export {
  listDeviceSchedules, listRawDeviceSchedules,
  getSchedule, getRawSchedule,
  saveSchedule, deleteSchedule,
  setScheduleEnabled,
} from '@/api/schedules';