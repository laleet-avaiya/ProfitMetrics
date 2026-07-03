import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useNotification } from './useNotification';

export function notDeleted<T extends { deleted?: boolean }>(item: T): boolean {
  return !item.deleted;
}

interface UseEntityListOptions<T> {
  fetch: (companyId: string) => Promise<T>;
  initialData: T;
  errorMessage?: string;
  enabled?: boolean;
}

export function useEntityList<T>({
  fetch,
  initialData,
  errorMessage = 'Failed to load data',
  enabled = true,
}: UseEntityListOptions<T>) {
  const { company, loading: authLoading } = useAuth();
  const notification = useNotification();
  const fetchRef = useRef(fetch);
  const initialDataRef = useRef(initialData);

  useEffect(() => {
    fetchRef.current = fetch;
  }, [fetch]);

  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!enabled) {
      setData(initialDataRef.current);
      setLoading(false);
      return;
    }

    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!company) {
      setData(initialDataRef.current);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchRef
      .current(company.id)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          notification.error(errorMessage);
          setData(initialDataRef.current);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, company, enabled, errorMessage, notification, reloadKey]);

  return { data, loading, reload };
}
