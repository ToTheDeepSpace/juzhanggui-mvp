import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const API_BASE = '/api';

interface AuthConfig {
  smsEnabled: boolean;
  smsRequired: boolean;
  wechatEnabled: boolean;
  legacyPhoneLoginEnabled: boolean;
}

const DEFAULT_AUTH_CONFIG: AuthConfig = {
  smsEnabled: false,
  smsRequired: false,
  wechatEnabled: false,
  legacyPhoneLoginEnabled: true,
};

function decodeLoginPayload(payload: string) {
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch {
    try { return JSON.parse(atob(payload)); } catch { return null; }
  }
}

export default function PlayerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig>(DEFAULT_AUTH_CONFIG);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payload = params.get('wechat_login');
    const authError = params.get('auth_error');
    if (authError) {
      setErrorMsg(authError);
      window.history.replaceState(null, '', '/player/login');
      return;
    }
    if (!payload) return;
    const data = decodeLoginPayload(payload);
    if (data?.token && data?.player) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('player_info', JSON.stringify(data.player));
      navigate('/player/dashboard', { replace: true });
    } else {
      setErrorMsg('微信登录结果无效，请重试');
      window.history.replaceState(null, '', '/player/login');
    }
  }, [location.search, navigate]);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/player/auth/config`)
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.success && data.data) {
          setAuthConfig({ ...DEFAULT_AUTH_CONFIG, ...data.data });
        }
      })
      .catch(() => {
        if (mounted) setAuthConfig(DEFAULT_AUTH_CONFIG);
      });
    return () => { mounted = false; };
  }, []);

  const sendCode = async () => {
    setErrorMsg(null);
    if (!authConfig.smsEnabled) {
      setErrorMsg('短信验证暂未启用，当前可使用手机号和昵称登录');
      return;
    }
    if (!phone.trim() || phone.trim().replace(/\D/g, '').length !== 11) {
      setErrorMsg('请填写正确的手机号');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/player/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        setErrorMsg('验证码已发送，请查看短信');
      } else {
        setErrorMsg(data.error || '验证码发送失败');
      }
    } catch {
      setErrorMsg('网络错误，请重试');
    } finally {
      setSending(false);
    }
  };

  const startWechatLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/player/wechat/url?redirect=/player/dashboard`);
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setErrorMsg(data.error || '微信扫码登录尚未配置');
      }
    } catch {
      setErrorMsg('微信登录启动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!phone.trim() || phone.trim().length < 5) {
      setErrorMsg('请填写正确的手机号');
      return;
    }
    if (!displayName.trim()) {
      setErrorMsg('请填写您的昵称');
      return;
    }
    if (authConfig.smsRequired && !code.trim()) {
      setErrorMsg('请填写验证码');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string> = {
        phone: phone.trim(),
        displayName: displayName.trim(),
      };
      if (code.trim()) payload.code = code.trim();
      const res = await fetch(`${API_BASE}/player/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('auth_token', data.data.token);
        localStorage.setItem('player_info', JSON.stringify(data.data.player));
        navigate('/player/dashboard');
      } else {
        setErrorMsg(data.error || '登录失败');
      }
    } catch (err: unknown) {
      setErrorMsg('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎮</div>
          <h1 className="text-2xl font-bold text-gray-800">玩家中心</h1>
          <p className="text-gray-500 mt-1">登录查看您的所有排班记录</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="请输入手机号"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">您的昵称</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="如：小明"
                required
              />
            </div>

            {authConfig.smsEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  短信验证码{authConfig.smsRequired ? '' : '（可选）'}
                </label>
                <div className="grid grid-cols-[1fr_112px] gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="6位验证码"
                    required={authConfig.smsRequired}
                  />
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={sending}
                    className="px-3 py-3 border border-indigo-200 text-indigo-700 rounded-xl font-medium hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                  >
                    {sending ? '发送中' : sent ? '重发' : '获取'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '登录中...' : '进入玩家中心'}
            </button>

            {authConfig.wechatEnabled && (
              <button
                type="button"
                onClick={startWechatLogin}
                disabled={loading}
                className="w-full py-3 border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-xl font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                微信扫码登录
              </button>
            )}
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            {authConfig.smsRequired ? '首次验证登录将自动创建账号；微信登录后如需匹配历史排班，请再绑定手机号' : '首次登录将自动创建账号；后续会逐步支持短信和微信验证登录'}
          </p>
        </div>
      </div>
    </div>
  );
}
