import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { api } from '@/api/client'
import { toast } from '@/components/toast'
import { errorMessage } from '@/utils/format'

type Query = Record<string, string | number | boolean | null | undefined>

/** GET helper. The path+params form the cache key; previous data is kept while paging/filtering. */
export function useGet<T>(path: string | null, params?: Query, opts?: { refetchInterval?: number; enabled?: boolean }) {
  return useQuery<T>({
    queryKey: [path, params ?? null],
    queryFn: ({ signal }) => api.get<T>(path as string, params, signal),
    enabled: !!path && (opts?.enabled ?? true),
    placeholderData: keepPreviousData,
    refetchInterval: opts?.refetchInterval,
  })
}

/** Mutation with toast feedback and cache invalidation by path prefix. */
export function useSave<TVars, TRes = unknown>(
  fn: (v: TVars) => Promise<TRes>,
  o: { invalidate?: (string | null)[]; success?: string; onSuccess?: (r: TRes, v: TVars) => void } = {},
) {
  const qc = useQueryClient()
  return useMutation<TRes, Error, TVars>({
    mutationFn: fn,
    onSuccess: (r, v) => {
      o.invalidate?.forEach((p) =>
        qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith(p ?? '') }),
      )
      if (o.success) toast.ok(o.success)
      o.onSuccess?.(r, v)
    },
    onError: (e) => toast.err(errorMessage(e)),
  })
}

export const invalidateKeys = (qc: ReturnType<typeof useQueryClient>, key: QueryKey) => qc.invalidateQueries({ queryKey: key })
