import { useEffect } from 'react';

/**
 * 在有未保存内容时,阻止浏览器关闭/刷新页面。
 *
 * <p>典型用法:
 * <pre>{@code
 *   const [editing, setEditing] = useState(false);
 *   useBeforeUnload(editing);  // editing=true 时拦截 beforeunload
 * }</pre>
 *
 * <p>行为:仅当 {@code active} 为 true 时注册监听;active 变 false 或组件卸载时
 * 自动移除。SPA 内导航不受影响(那需要 react-router 的 unstable_usePrompt
 * 或自建 prompt),本 hook 只覆盖浏览器层"关闭 tab / 刷新 / 输入新 URL"。
 */
export function useBeforeUnload(active: boolean, message = ''): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 现代浏览器忽略自定义字符串,只关心 returnValue 是否被设置
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active, message]);
}