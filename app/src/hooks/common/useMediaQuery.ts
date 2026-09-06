import {useEffect, useState} from 'react';
import {useViewModeStore} from '@/stores/viewModeStore';

/**
 * 订阅媒体查询。
 *  - 首次返回 false（避免 SSR/首屏闪烁）
 *  - 仅在挂载后通过 matchMedia 同步真实值
 *  - 卸载时自动移除监听
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * 是否处于移动端视口（< Tailwind md 断点 768px）。与 AppShell 侧边栏/底部导航的切档点保持一致。
 * viewMode 强制覆盖:auto 时跟随 matchMedia;mobile/desktop 时直接返回布尔。
 */
export function useIsMobile(): boolean {
  const viewMode = useViewModeStore((s) => s.viewMode);
  const realMatches = useMediaQuery('(max-width: 767.98px)');
  if (viewMode === 'mobile') return true;
  if (viewMode === 'desktop') return false;
  return realMatches;
}
