import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HeroUIProvider, ToastProvider, addToast } from '@heroui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { BizError } from '@/lib/api-client';
import { AxiosError } from 'axios';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

/**
 * 全局兜底: 任何位置抛出的未捕获 Promise rejection 都会触发 toast,
 * 避免业务错误被静默吃掉. 注意: 各业务模块仍应尽量在 catch 内自行提示以提供更精确文案,
 * 这里只是 last-line-of-defense.
 */
function describeError(reason: unknown): { title: string; description: string } {
  if (reason instanceof BizError) {
    return {
      title: '业务异常',
      description: `${reason.envelope.message}  [${reason.envelope.code}]`,
    };
  }
  if (reason instanceof AxiosError) {
    const status = reason.response?.status ?? 0;
    const map: Record<number, string> = {
      400: '请求参数错误',
      401: '身份已失效',
      403: '没有访问权限',
      404: '资源不存在',
      405: '请求方式不被允许',
    };
    return {
      title: map[status] || (status >= 500 ? '服务器异常' : '请求失败'),
      description: status === 0 ? '无法连接到服务器' : reason.message,
    };
  }
  if (reason instanceof Error) return { title: '运行异常', description: reason.message };
  if (typeof reason === 'string') return { title: '运行异常', description: reason };
  return { title: '运行异常', description: JSON.stringify(reason) };
}

window.addEventListener('unhandledrejection', (e) => {
  const { title, description } = describeError(e.reason);
  addToast({ title, description, color: 'danger' });
  // 控制台不静默, 方便调试
  // eslint-disable-next-line no-console
  console.error('[unhandledrejection]', e.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <ToastProvider placement="bottom-left" toastOffset={60} />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </HeroUIProvider>
  </StrictMode>,
);
