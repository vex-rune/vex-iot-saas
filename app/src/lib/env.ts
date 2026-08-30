/**
 * 全局常量配置
 */

/** 应用名称(显示用) */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE ?? 'Vex 云物联';

/** 后端 API 基础路径(经 Nginx 反代) */
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

/**
 * 官方网站域名(裸域名,不带协议)
 * 用于 SEO、meta、跳转等对外展示场景
 */
export const OFFICIAL_SITE = import.meta.env.VITE_OFFICIAL_SITE ?? 'vexrune.top';

/**
 * 官方网站完整 URL(带协议)
 * 用户在控制台中"访问官网"按钮、登录页底部版权行、PWA 元信息等统一使用此常量
 */
export const OFFICIAL_URL = import.meta.env.VITE_OFFICIAL_URL ?? 'https://vexrune.top/';
