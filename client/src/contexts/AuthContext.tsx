import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AdminUser {
  id?: string;
  email?: string;
  phone?: string;
  displayName?: string;
  role?: string;
  tenantId?: string;
  storeId?: string | null;
  phoneVerified?: boolean;
  legacy?: boolean;
}

interface AuthContextType {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (payload: { email: string; password: string; displayName?: string; phone?: string; code?: string }) => Promise<{ success: boolean; error?: string }>;
  sendAdminCode: (phone: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPhone: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  sendBindPhoneCode: (phone: string) => Promise<{ success: boolean; error?: string }>;
  bindPhone: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isAuthenticated: false,
  loading: true,
  login: async () => ({ success: false }),
  loginWithEmail: async () => ({ success: false }),
  registerWithEmail: async () => ({ success: false }),
  sendAdminCode: async () => ({ success: false }),
  loginWithPhone: async () => ({ success: false }),
  sendBindPhoneCode: async () => ({ success: false }),
  bindPhone: async () => ({ success: false }),
  refreshUser: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((newToken: string, newUser?: AdminUser | null) => {
    localStorage.setItem('auth_token', newToken);
    if (newUser) localStorage.setItem('admin_user', JSON.stringify(newUser));
    else localStorage.removeItem('admin_user');
    setToken(newToken);
    setUser(newUser || null);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
  }, []);

  const loadUser = useCallback(async (activeToken: string) => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '登录已过期');
    setUser(data.data || null);
    if (data.data) localStorage.setItem('admin_user', JSON.stringify(data.data));
  }, []);

  // 启动时从 localStorage 恢复 token
  useEffect(() => {
    const saved = localStorage.getItem('auth_token');
    if (saved) {
      setToken(saved);
      const savedUser = localStorage.getItem('admin_user');
      if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch { localStorage.removeItem('admin_user'); }
      }
      // 验证 token 是否有效
      fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${saved}` },
      })
        .then((res) => {
          if (!res.ok) {
            clearSession();
            return;
          }
          return res.json();
        })
        .then((data) => {
          if (data && !data.success) clearSession();
          else if (data?.data?.valid) return loadUser(saved).catch(() => {});
          else if (data) clearSession();
        })
        .catch(() => clearSession())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [clearSession, loadUser]);

  const login = useCallback(async (password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        const newToken = data.data.token;
        setSession(newToken, data.data.user || null);
        return { success: true };
      }
      return { success: false, error: data.error || '登录失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, [setSession]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data.token, data.data.user || null);
        return { success: true };
      }
      return { success: false, error: data.error || '登录失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, [setSession]);

  const registerWithEmail = useCallback(async (payload: { email: string; password: string; displayName?: string; phone?: string; code?: string }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data.token, data.data.user || null);
        return { success: true };
      }
      return { success: false, error: data.error || '注册失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, [setSession]);

  const sendAdminCode = useCallback(async (phone: string) => {
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error || '验证码发送失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, []);

  const loginWithPhone = useCallback(async (phone: string, code: string) => {
    try {
      const res = await fetch('/api/auth/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data.token, data.data.user || null);
        return { success: true };
      }
      return { success: false, error: data.error || '登录失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, [setSession]);

  const sendBindPhoneCode = useCallback(async (phone: string) => {
    try {
      if (!token) return { success: false, error: '请先登录' };
      const res = await fetch('/api/auth/bind-phone/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error || '验证码发送失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, [token]);

  const bindPhone = useCallback(async (phone: string, code: string) => {
    try {
      if (!token) return { success: false, error: '请先登录' };
      const res = await fetch('/api/auth/bind-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data.token || token, data.data.user || null);
        return { success: true };
      }
      return { success: false, error: data.error || '绑定失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, [setSession, token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    await loadUser(token);
  }, [loadUser, token]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        loading,
        login,
        loginWithEmail,
        registerWithEmail,
        sendAdminCode,
        loginWithPhone,
        sendBindPhoneCode,
        bindPhone,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
