import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

interface AsyncResource<T> {
  data: T;
  error: string;
  loading: boolean;
  refreshing: boolean;
  reload: (refresh?: boolean) => Promise<void>;
  setData: Dispatch<SetStateAction<T>>;
}

export function useAsyncResource<T>(loader: () => Promise<T>, initialValue: T, fallbackError: string): AsyncResource<T> {
  const [data, setData] = useState(initialValue);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  const reload = useCallback(async (refresh = false) => {
    const currentRequest = ++requestId.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const nextData = await loader();
      if (mounted.current && currentRequest === requestId.current) setData(nextData);
    } catch (value) {
      if (mounted.current && currentRequest === requestId.current) setError(value instanceof Error ? value.message : fallbackError);
    } finally {
      if (mounted.current && currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [fallbackError, loader]);

  return { data, error, loading, refreshing, reload, setData };
}
