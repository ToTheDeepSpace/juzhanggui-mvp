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
  emailVerified?: boolean;
  legacy?: boolean;
}

interface AuthContextType {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmailCode: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (payload: { email: string; password: string; displayName?: string; emailCode?: string; phone?: string; phoneCode?: string }) => Promise<{ success: boolean; error?: string }>;
  sendAdminEmailCode: (email: string, purpose: 'admin_login' | 'admin_register' | 'admin_reset_password') => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithEmail: (email: string, code: string, password: string) => Promise<{ success: boolean; error?: string }>;
  changePasswordWithEmail: (code: string, password: string) => Promise<{ success: boolean; error?: string }>;
  sendAdminCode: (phone: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPhone: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  sendBindPhoneCode: (phone: string) => Promise<{ success: boolean; error?: string }>;
  bindPhone: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const ADMIN_TOKEN_KEY = 'admin_auth_token';
const LEGACY_TOKEN_KEY = 'auth_token';
const ADMIN_USER_KEY = 'admin_user';
const SUPER_ADMIN_TOKEN_BACKUP_KEY = 'super_admin_token_backup';
const SUPER_ADMIN_USER_BACKUP_KEY = 'super_admin_user_backup';

function isAdminUser(user?: AdminUser | null) {
  return user?.role === 'store_admin' || user?.role === 'super_admin';
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isAuthenticated: false,
  loading: true,
  login: async () => ({ success: false }),
  loginWithEmail: async () => ({ success: false }),
  loginWithEmailCode: async () => ({ success: false }),
  registerWithEmail: async () => ({ success: false }),
  sendAdminEmailCode: async () => ({ success: false }),
  resetPasswordWithEmail: async () => ({ success: false }),
  changePasswordWithEmail: async () => ({ success: false }),
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
    localStorage.setItem(ADMIN_TOKEN_KEY, newToken);
    localStorage.setItem(LEGACY_TOKEN_KEY, newToken);
    if (newUser) localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(newUser));
    else localStorage.removeItem(ADMIN_USER_KEY);
    setToken(newToken);
    setUser(newUser || null);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    localStorage.removeItem(SUPER_ADMIN_TOKEN_BACKUP_KEY);
    localStorage.removeItem(SUPER_ADMIN_USER_BACKUP_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const loadUser = useCallback(async (activeToken: string) => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '登录已过期');
    const nextUser = data.data || null;
    if (!isAdminUser(nextUser)) throw new Error('不是后台账号');
    setUser(nextUser);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(nextUser));
  }, []);

  // 启动时从 localStorage 恢复 token
  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      const savedUser = localStorage.getItem(ADMIN_USER_KEY);
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (isAdminUser(parsed)) setUser(parsed);
          else localStorage.removeItem(ADMIN_USER_KEY);
        } catch { localStorage.removeItem(ADMIN_USER_KEY); }
      }
      fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${saved}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error('登录已过期');
          return res.json();
        })
        .then((data) => {
          if (!data?.success || !data?.data?.valid) throw new Error('登录已过期');
          return loadUser(saved);
        })
        .then(() => {
          localStorage.setItem(ADMIN_TOKEN_KEY, saved);
          localStorage.setItem(LEGACY_TOKEN_KEY, saved);
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

  const loginWithEmailCode = useCallback(async (email: string, code: string) => {
    try {
      const res = await fetch('/api/auth/email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
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

  const registerWithEmail = useCallback(async (payload: { email: string; password: string; displayName?: string; emailCode?: string; phone?: string; phoneCode?: string }) => {
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

  const sendAdminEmailCode = useCallback(async (email: string, purpose: 'admin_login' | 'admin_register' | 'admin_reset_password') => {
    try {
      const res = await fetch('/api/auth/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await res.json();
      return data.success ? { success: true } : { success: false, error: data.error || '邮箱验证码发送失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, []);

  const resetPasswordWithEmail = useCallback(async (email: string, code: string, password: string) => {
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data.token, data.data.user || null);
        return { success: true };
      }
      return { success: false, error: data.error || '修改密码失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, [setSession]);

  const changePasswordWithEmail = useCallback(async (code: string, password: string) => {
    try {
      if (!token) return { success: false, error: '请先登录' };
      const res = await fetch('/api/auth/password/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code, password }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data.token || token, data.data.user || null);
        return { success: true };
      }
      return { success: false, error: data.error || '修改密码失败' };
    } catch {
      return { success: false, error: '网络错误，请检查服务器连接' };
    }
  }, [setSession, token]);

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
        isAuthenticated: !!token && isAdminUser(user),
        loading,
        login,
        loginWithEmail,
        loginWithEmailCode,
        registerWithEmail,
        sendAdminEmailCode,
        resetPasswordWithEmail,
        changePasswordWithEmail,
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
