import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [page, setPage] = useState(0);
  const [size, setSizeState] = useState(defaultSize);

  // predicate/order 直接由 props 驱动,不维护内部 state.
  // 仅在 predicate/order 变化时重置到第 1 页.
  const prevPredicateJson = useRef(JSON.stringify(defaultPredicate ?? null));
  const prevOrderJson = useRef(JSON.stringify(defaultOrder ?? null));
  useEffect(() => {
    const json = JSON.stringify(defaultPredicate ?? null);
    if (json !== prevPredicateJson.current) {
      prevPredicateJson.current = json;
      setPage(0);
    }
  }, [defaultPredicate]);
  useEffect(() => {
    const json = JSON.stringify(defaultOrder ?? null);
    if (json !== prevOrderJson.current) {
      prevOrderJson.current = json;
      setPage(0);
    }
  }, [defaultOrder]);

  const body: QueryBody = useMemo(
    () => ({ predicate: defaultPredicate, order: defaultOrder, page: { page, size } }),
    [defaultPredicate, defaultOrder, page, size],
  );

  const listQuery = useQuery({
    queryKey: [`${queryKey}.list`, body],
    queryFn: () => chainToPromise(queryFn(body)),
  });

  const countQuery = useQuery({
    queryKey: [`${queryKey}.count`, { predicate: defaultPredicate }],
    queryFn: () => chainToPromise(countFn({ predicate: defaultPredicate })),
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
    nextPage,
    prevPage,
    refetch: () => { listQuery.refetch(); countQuery.refetch(); },
  };
}