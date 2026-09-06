import {del, post, type RequestChain} from '@/lib/api-client';
import type {NotifyRecord, NotifyTemplate, NotifyUser, QueryBody,} from '@/types/api';

// ─── 通知用户 ────────────────────────────────────────────────
export function queryNotifyUsers(body: QueryBody): RequestChain<NotifyUser[]> {
    return post<NotifyUser[]>('/notify-users/query', body);
}

export function countNotifyUsers(body: QueryBody): RequestChain<number> {
    return post<number>('/notify-users/count', body);
}

export function saveNotifyUser(data: Partial<NotifyUser>): RequestChain<NotifyUser> {
    return post<NotifyUser>('/notify-users', data);
}

export function deleteNotifyUser(id: string): RequestChain<void> {
    return del<void>(`/notify-users/${id}`);
}

// ─── 通知记录(后端待接入,前端先留契约) ────────────────────────
export function queryNotifyRecords(body: QueryBody): RequestChain<NotifyRecord[]> {
    return post<NotifyRecord[]>('/notify-records/query', body);
}

export function countNotifyRecords(body: QueryBody): RequestChain<number> {
    return post<number>('/notify-records/count', body);
}

// ─── 通知模版 ────────────────────────────────────────────────
export function queryNotifyTemplates(body: QueryBody): RequestChain<NotifyTemplate[]> {
    return post<NotifyTemplate[]>('/notify-templates/query', body);
}

export function countNotifyTemplates(body: QueryBody): RequestChain<number> {
    return post<number>('/notify-templates/count', body);
}

export function saveNotifyTemplate(data: Partial<NotifyTemplate>): RequestChain<NotifyTemplate> {
    return post<NotifyTemplate>('/notify-templates', data);
}

export function deleteNotifyTemplate(id: string): RequestChain<void> {
    return del<void>(`/notify-templates/${id}`);
}
