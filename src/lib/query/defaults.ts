import { keepPreviousData, type QueryKey } from "@tanstack/react-query";

/** Default options for a list-shaped query. Always returns an array. */
export function listQuery<T>(key: QueryKey, queryFn: () => Promise<T[]>) {
  return {
    queryKey: key,
    queryFn,
    initialData: [] as T[],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  };
}

/** Default options for a single-item query. Returns T | null. */
export function itemQuery<T>(key: QueryKey, queryFn: () => Promise<T | null>) {
  return {
    queryKey: key,
    queryFn,
    initialData: null as T | null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  };
}
