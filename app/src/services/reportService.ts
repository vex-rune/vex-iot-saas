/**
 * 报表 service — UI 调用入口(barrel re-export, 语义隔离层)
 *
 * 严格分层:
 *   - @/api/reportApi 只做 HTTP 声明
 *   - 本 service 是 UI 唯一入口
 */
export {
    queryReportDefinitions,
    countReportDefinitions,
    getReportDefinition,
    saveReportDefinition,
    updateReportDefinition,
    deleteReportDefinition,
    executeReport,
    previewReport,
    type ReportDefinition,
    type ReportColumnInfo,
    type ReportResultDTO,
    type ReportExecuteReq,
} from '@/api/reportApi';
