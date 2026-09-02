/**
 * 仪表盘业务 API (openapi v2 /api/dashboards/...)
 *
 * 包含:
 *   - DashboardDefinition (仪表盘本身,按 bizType 全局/设备/设备详情分类)
 *   - DashboardCard (仪表盘内的卡片,引用点位 + alarm list)
 *
 * 设计:
 *   - 不假定前端一定用到所有卡片类型.
 *   - 在 Batch 4,前端会接入 panel/widgets ↔ dashboard/cards 的映射.
 *   - 现阶段先给出 API 封装,至于 DashboardDetail/CardsEdit 页面留到 Batch 4.
 */
import { get, post, del, type RequestChain } from '@/lib/api-client';
import type {
  DashboardDefinition,
  DashboardCard,
} from '@/types/api';

// ─── 仪表盘定义 ──────────────────────────────────────────────────────

/**
 * GET /api/dashboards/global
 * 列出所有 GLOBAL 类型仪表盘.
 */
export function listGlobalDashboards(): RequestChain<DashboardDefinition[]> {
  return get<DashboardDefinition[]>('/dashboards/global');
}

/**
 * GET /api/dashboards/device/{deviceId}
 * 列出该设备相关的所有仪表盘.
 */
export function listDeviceDashboards(deviceId: string): RequestChain<DashboardDefinition[]> {
  return get<DashboardDefinition[]>(`/dashboards/device/${deviceId}`);
}

/**
 * GET /api/dashboards/device/{deviceId}/default
 * 取该设备的默认仪表盘(同一 deviceId + bizType=DEVICE_DETAIL 时只允许 1 条 isDefault=true).
 */
export function getDefaultDashboard(deviceId: string): RequestChain<DashboardDefinition> {
  return get<DashboardDefinition>(`/dashboards/device/${deviceId}/default`);
}

/**
 * GET /api/dashboards/{id}
 * 单仪表盘详情.
 */
export function getDashboard(id: string): RequestChain<DashboardDefinition> {
  return get<DashboardDefinition>(`/dashboards/${id}`);
}

/**
 * POST /api/dashboards
 * 保存仪表盘定义 (新增 / 更新).
 */
export function saveDashboard(
  data: Partial<DashboardDefinition>,
): RequestChain<DashboardDefinition> {
  return post<DashboardDefinition>('/dashboards', data);
}

/**
 * DELETE /api/dashboards/{id}
 * 删除仪表盘 (软删).
 */
export function deleteDashboard(id: string): RequestChain<void> {
  return del<void>(`/dashboards/${id}`);
}

// ─── 仪表盘卡片 ──────────────────────────────────────────────────────

/**
 * GET /api/dashboards/{dashboardId}/cards
 * 列出一张仪表盘下所有卡片.
 */
export function listCards(dashboardId: string): RequestChain<DashboardCard[]> {
  return get<DashboardCard[]>(`/dashboards/${dashboardId}/cards`);
}

/**
 * GET /api/dashboards/cards/{id}
 * 单卡片详情.
 */
export function getCard(id: string): RequestChain<DashboardCard> {
  return get<DashboardCard>(`/dashboards/cards/${id}`);
}

/**
 * POST /api/dashboards/cards
 * 保存卡片 (新增 / 更新).pointRefList 引用 PointDefinitionEntity.id.
 */
export function saveCard(data: Partial<DashboardCard>): RequestChain<DashboardCard> {
  return post<DashboardCard>('/dashboards/cards', data);
}

/**
 * DELETE /api/dashboards/cards/{id}
 * 删除卡片.
 */
export function deleteCard(id: string): RequestChain<void> {
  return del<void>(`/dashboards/cards/${id}`);
}
