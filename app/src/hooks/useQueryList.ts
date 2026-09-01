import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RequestChain } from '@/lib/api-client';
import type { QueryBody } from '@/types/api';

interface UseQueryListOptions<T> {
  queryKey: string;
  /** 返回 RequestChain<T[]> 的查询方法 */
  queryFn: (body: QueryBody) => RequestChain<T[]>;
  countFn: (body: QueryBody) => RequestChain<number>;
  defaultSize?: number;
  defaultPredicate?: QueryBody['predicate'];
  /** 初始排序(同 defaultPredicate 仅作初始值;后续变更请用 setOrder) */
  defaultOrder?: QueryBody['order'];
}

/**
 * 把 RequestChain 转 Promise, 让 react-query 接管 loading/error 状态.
 * onBizError / onHttpError 走 RequestChain 内置默认 toast, 这里只把异常 reject 出去.
 */
export function chainToPromise<T>(chain: RequestChain<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chain
      .onSuccess((data) => resolve(data))
      .onBizError((err) => reject(err))
      .onHttpError((err) => reject(err))
      .execute();
  });
}

export function useQueryList<T>({
  queryKey,
  queryFn,
  countFn,
  defaultSize = 20,
  defaultPredicate,
  defaultOrder,
}: UseQueryListOptions<T>) {
  const [page, setPage] = useState(0); // 后端分页从 0 开始
  const [size, setSizeState] = useState(defaultSize);
  const [predicate, setPredicate] = useState<QueryBody['predicate']>(defaultPredicate);
  const [order, setOrder] = useState<QueryBody['order']>(defaultOrder);

  const body: QueryBody = useMemo(
    () => ({ predicate, order, page: { page, size } }),
    [predicate, order, page, size],
  );

  const listQuery = useQuery({
    queryKey: [`${queryKey}.list`, body],
    queryFn: () => chainToPromise(queryFn(body)),
  });

  const countQuery = useQuery({
    queryKey: [`${queryKey}.count`, { predicate }],
    queryFn: () => chainToPromise(countFn({ predicate })),
  });

  const totalCount = countQuery.data ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / size));

  const goToPage = useCallback(
    (p: number) => setPage(Math.max(0, Math.min(p, totalPages - 1))),
    [totalPages],
  );
  const nextPage = useCallback(() => goToPage(page + 1), [goToPage, page]);
  const prevPage = useCallback(() => goToPage(page - 1), [goToPage, page]);

  return {
    data: listQuery.data ?? [],
    total: totalCount,
    page,
    size,
    totalPages,
    isLoading: listQuery.isLoading || countQuery.isLoading,
    isFetching: listQuery.isFetching || countQuery.isFetching,
    setPage: goToPage,
    setSize: (s: number) => { setSizeState(s); setPage(0); },
    setPredicate,
    setOrder,
    nextPage,
    prevPage,
    refetch: () => { listQuery.refetch(); countQuery.refetch(); },
  };
}