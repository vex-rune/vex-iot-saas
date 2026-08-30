import { useMutation } from '@tanstack/react-query';
import type { RequestChain } from '@/lib/api-client';
import { BizError } from '@/lib/api-client';
import { AxiosError } from 'axios';

/**
 * 把 RequestChain 转 react-query mutation.
 * RequestChain.execute() 已经内置了 onBizError / onHttpError 默认 toast,
 * 这里只需把结果转换为 Promise resolve/reject, 让 react-query 进入对应状态.
 *
 *   const m = useApiMutation({
 *     mutationFn: (data) => createDevice(data),    // 返回 RequestChain<Device>
 *   });
 *   m.mutate(data, { onSuccess: (d) => ... });
 */
export function useApiMutation<TInput, TResult = unknown>(opts: {
  /** 返回 RequestChain<TResult> 的方法 */
  mutationFn: (input: TInput) => RequestChain<TResult>;
}) {
  return useMutation<TResult, BizError | AxiosError, TInput>({
    mutationFn: (input: TInput) =>
      new Promise<TResult>((resolve, reject) => {
        opts
          .mutationFn(input)
          // 不注入任何回调: 走默认 toast
          // 但需要捕获 reject 让 react-query 知道失败
          .onSuccess((data) => resolve(data))
          .onBizError((err) => reject(err))
          .onHttpError((err) => reject(err))
          .execute();
      }),
  });
}