/**
 * 分级 Toast 工具
 *
 * 按严重程度提供不同的提示行为:
 *   - success : 操作成功(绿色,2.5s)
 *   - warning : 表单校验/上限提醒(黄色,5s)
 *   - error   : 服务端错误/业务异常(红色,8s,需用户关注)
 *   - permission : 403 无权限(黄橙色,10s,带引导文案)
 *   - info    : 状态通知(蓝色,3.5s)
 */
import {addToast} from '@heroui/react';

/** 成功 — 绿色, 2.5s 自动消失 */
export function toastSuccess(title: string, description?: string) {
    addToast({title, description, color: 'success', timeout: 2_500});
}

/** 警告 — 黄色, 5s */
export function toastWarning(title: string, description?: string) {
    addToast({title, description, color: 'warning', timeout: 5_000});
}

/** 错误 — 红色, 8s, 需要用户关注 */
export function toastError(title: string, description?: string) {
    addToast({title, description, color: 'danger', timeout: 8_000});
}

/** 权限不足 — 黄橙色, 10s, 带引导文案 */
export function toastPermission(title = '权限不足', description?: string) {
    addToast({
        title,
        description: description ?? '您当前角色无此操作权限，请联系管理员升级',
        color: 'warning',
        timeout: 10_000,
    });
}

/** 信息 — 蓝色, 3.5s */
export function toastInfo(title: string, description?: string) {
    addToast({title, description, color: 'primary', timeout: 3_500});
}