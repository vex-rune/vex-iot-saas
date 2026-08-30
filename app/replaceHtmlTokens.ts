import type { Plugin, ResolvedConfig } from 'vite';

/**
 * 构建期把 index.html 里出现的占位标记 {{...}} 替换为对应环境变量,
 * 避免硬编码官方域名等需要"集中改一处"的字面量。
 *
 * 占位标记格式: {{ VITE_OFFICIAL_URL }} / {{ VITE_APP_TITLE }} 等,
 * 名称大小写不敏感:占位写 vite_official_url 与 VITE_OFFICIAL_URL 都行,
 *   都会去 Vite 解析后的 env(VITE_* 变量)取值。
 *
 * 用法:在 vite.config.ts 的 plugins 数组中加 replaceHtmlTokens()
 */
export function replaceHtmlTokens(): Plugin {
  let resolvedEnv: Record<string, unknown>;
  return {
    name: 'app:replace-html-tokens',
    // 仅处理生产构建:dev 期保留原样便于 HMR 与本地静态服务调试
    apply: 'build',
    configResolved(config) {
      // Vite 在 import.meta.env 中暴露 VITE_* 变量;
      // resolvedConfig.env 是解析后的字典(含 .env 文件的值)
      resolvedEnv = config.env;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, name: string) => {
          // 自动补 VITE_ 前缀(占位写 official_url 与 VITE_OFFICIAL_URL 等价)
          const envKey = name.toUpperCase().startsWith('VITE_')
            ? name.toUpperCase()
            : `VITE_${name.toUpperCase()}`;
          const value = resolvedEnv[envKey];
          if (value === undefined) {
            // 占位但无环境变量:留空 + 警告,避免 build 静默挂掉
            // eslint-disable-next-line no-console
            console.warn(`[replaceHtmlTokens] 未找到环境变量 ${envKey},留空`);
            return '';
          }
          return String(value);
        });
      },
    },
  };
}
