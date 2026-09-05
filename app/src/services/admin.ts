/**
 * 后台管理 service — UI 调用入口(barrel re-export,语义隔离层)
 *
 * 严格分层:
 *   - @/api/admin 只做 HTTP 声明
 *   - 本 service 是 UI 唯一入口
 */
export {
  queryAccounts, countAccounts,
  getAccount, createAccount, setAccountEnabled, deleteAccount,
  type AccountCreateReq,
  queryTenants, countTenants,
  getTenant, getTenantByCode, getTenantDetail,
  linkTenantAccounts, unlinkTenantAccounts,
  createTenant, updateTenant, deleteTenant,
  type TenantUpsertReq,
} from '@/api/admin';