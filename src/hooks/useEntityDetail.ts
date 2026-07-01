import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useNotification } from './useNotification';

function entityNotDeleted<T>(entity: T): boolean {
  return !(entity as { deleted?: boolean }).deleted;
}

interface UseEntityDetailOptions<T> {
  id: string | undefined;
  fetch: (companyId: string, id: string) => Promise<T | null>;
  isValid?: (entity: T) => boolean;
  errorMessage?: string;
}

export function useEntityDetail<T>({
  id,
  fetch,
  isValid = entityNotDeleted,
  errorMessage = 'Failed to load record',
}: UseEntityDetailOptions<T>) {
  const { company, loading: authLoading } = useAuth();
  const notification = useNotification();
  const [entity, setEntity] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!id) {
      setEntity(null);
      setLoading(false);
      return;
    }

    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!company) {
      setEntity(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(company.id, id)
      .then((result) => {
        if (cancelled) return;
        setEntity(result && isValid(result) ? result : null);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          notification.error(errorMessage);
          setEntity(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, company, errorMessage, fetch, id, isValid, reloadKey]);

  return { entity, loading, notFound: !loading && !entity, reload };
}
