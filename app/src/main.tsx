import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {HeroUIProvider, ToastProvider} from '@heroui/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import App from './App';
import {BizError} from '@/lib/api-client';
import {toastError, toastPermission} from '@/lib/toast';
import {AxiosError} from 'axios';
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
function describeAndToast(reason: unknown): void {
  if (reason instanceof BizError) {
      toastError('业务异常', `${reason.envelope.message}  [${reason.envelope.code}]`);
      return;
  }
  if (reason instanceof AxiosError) {
    const status = reason.response?.status ?? 0;
      if (status === 403) {
          toastPermission();
          return;
      }
    const map: Record<number, string> = {
      400: '请求参数错误',
      401: '身份已失效',
      404: '资源不存在',
      405: '请求方式不被允许',
    };
      const title = map[status] || (status >= 500 ? '服务器异常' : '请求失败');
      const description = status === 0 ? '无法连接到服务器' : reason.message;
      toastError(title, description);
      return;
  }
    if (reason instanceof Error) {
        toastError('运行异常', reason.message);
        return;
    }
    if (typeof reason === 'string') {
        toastError('运行异常', reason);
        return;
    }
    toastError('运行异常', JSON.stringify(reason));
}

window.addEventListener('unhandledrejection', (e) => {
    describeAndToast(e.reason);
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
