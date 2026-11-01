import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import api, { getErrorMessage } from '../api/client';

// GETs `path` (relative to /api) whenever it changes. The previous request is aborted, so a slow
// response can never overwrite a newer one. With keepPreviousData, the last result stays on screen
// while the next one loads (smooth paging); without it, data is null until the new path has loaded.
export default function useApi(path, { keepPreviousData = true } = {}) {
  const [state, setState] = useState({ data: null, forPath: null, error: null, status: null, loading: Boolean(path) });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path) return undefined;

    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null, status: null }));

    api.get(path, { signal: controller.signal })
      .then((response) => {
        setState({ data: response.data, forPath: path, error: null, status: response.status, loading: false });
      })
      .catch((error) => {
        if (axios.isCancel(error)) return;
        setState((previous) => ({
          ...previous,
          error: getErrorMessage(error),
          status: error.response?.status ?? null,
          loading: false
        }));
      });

    return () => controller.abort();
  }, [path, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  const data = keepPreviousData || state.forPath === path ? state.data : null;

  return { data, error: state.error, status: state.status, loading: state.loading, reload };
}
