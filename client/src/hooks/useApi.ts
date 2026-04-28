import { useState, useCallback } from 'react';

const API_BASE = '/api';

/** 模块级请求去重 Map，key = endpoint+method+body */
const inFlight = new Map<string, AbortController>();

function getRequestKey(endpoint: string, method: string, body?: unknown): string {
  return `${method}:${endpoint}:${body ? JSON.stringify(body) : ''}`;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  const key = getRequestKey(endpoint, options?.method || 'GET', options?.body);

  // 去重：如果有同样的请求在飞中，取消它（防止重复请求）
  if (inFlight.has(key)) {
    const existing = inFlight.get(key)!;
    existing.abort();
    inFlight.delete(key);
  }

  const controller = new AbortController();
  inFlight.set(key, controller);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      signal: controller.signal,
    });

    const text = await response.text();
    if (!text) {
      return { success: false, error: `服务器返回空响应 (HTTP ${response.status})` };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: `服务器返回无效JSON: ${text.substring(0, 100)}` };
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: '请求已取消' };
    }
    return { success: false, error: String(error) };
  } finally {
    inFlight.delete(key);
  }
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = useCallback(async <T,>(endpoint: string) => {
    setLoading(true);
    setError(null);
    const result = await fetchApi<T>(endpoint);
    setLoading(false);
    if (!result.success) setError(result.error || '请求失败');
    return result;
  }, []);

  const post = useCallback(async <T,>(endpoint: string, data: unknown) => {
    setLoading(true);
    setError(null);
    const result = await fetchApi<T>(endpoint, { method: 'POST', body: JSON.stringify(data) });
    setLoading(false);
    if (!result.success) setError(result.error || '请求失败');
    return result;
  }, []);

  const put = useCallback(async <T,>(endpoint: string, data: unknown) => {
    setLoading(true);
    setError(null);
    const result = await fetchApi<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) });
    setLoading(false);
    if (!result.success) setError(result.error || '请求失败');
    return result;
  }, []);

  const del = useCallback(async <T,>(endpoint: string) => {
    setLoading(true);
    setError(null);
    const result = await fetchApi<T>(endpoint, { method: 'DELETE' });
    setLoading(false);
    if (!result.success) setError(result.error || '请求失败');
    return result;
  }, []);

  return { get, post, put, del, loading, error };
}
