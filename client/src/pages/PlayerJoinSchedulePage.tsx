import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const API_BASE = '/api';

interface PublicSchedule {
  id: string;
  script_name?: string;
  store_name?: string;
  store_city?: string;
  room_name?: string;
  start_time: string;
  end_time: string;
  status: string;
  note?: string | null;
  player_roles?: { name: string; gender?: string }[];
  taken_roles?: string[];
  pending_request_count?: number;
}

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

function getPlayerToken() {
  if (!localStorage.getItem('player_info')) return '';
  return localStorage.getItem('player_auth_token') || '';
}

export default function PlayerJoinSchedulePage() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [schedule, setSchedule] = useState<PublicSchedule | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig>(DEFAULT_AUTH_CONFIG);
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const availableRoles = useMemo(() => {
    const taken = new Set(schedule?.taken_roles || []);
    return (schedule?.player_roles || []).filter(role => !taken.has(role.name));
  }, [schedule]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payload = params.get('wechat_login');
    const authError = params.get('auth_error');
    if (authError) {
      setMessage(authError);
      window.history.replaceState(null, '', `/join/${scheduleId}`);
      return;
    }
    if (!payload) return;
    const data = decodeLoginPayload(payload);
    if (data?.token && data?.player) {
      localStorage.setItem('player_auth_token', data.token);
      localStorage.setItem('player_info', JSON.stringify(data.player));
      window.history.replaceState(null, '', `/join/${scheduleId}`);
      setMessage('微信登录成功，可以提交加入申请');
    } else {
      setMessage('微信登录结果无效，请重试');
      window.history.replaceState(null, '', `/join/${scheduleId}`);
    }
  }, [location.search, scheduleId]);

  useEffect(() => {
    if (!scheduleId) return;
    fetch(`${API_BASE}/schedules/${scheduleId}/public`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setSchedule(data.data);
        else setMessage(data.error || '排期不存在');
      })
      .catch(() => setMessage('排期加载失败'));

    fetch(`${API_BASE}/player/auth/config`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) setAuthConfig({ ...DEFAULT_AUTH_CONFIG, ...data.data });
      })
      .catch(() => setAuthConfig(DEFAULT_AUTH_CONFIG));
  }, [scheduleId]);

  const sendCode = async () => {
    if (!authConfig.smsEnabled) {
      setMessage('短信验证暂未启用，当前可用手机号和昵称登录');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone.replace(/\D/g, ''))) {
      setMessage('请填写正确的手机号');
      return;
    }
    setSending(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/player/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      setMessage(data.success ? '验证码已发送' : data.error || '验证码发送失败');
    } catch {
      setMessage('验证码发送失败');
    } finally {
      setSending(false);
    }
  };

  const loginPlayer = async () => {
    if (!phone.trim() || !displayName.trim()) {
      setMessage('请填写手机号和昵称');
      return false;
    }
    if (authConfig.smsRequired && !code.trim()) {
      setMessage('请填写短信验证码');
      return false;
    }
    const payload: Record<string, string> = { phone: phone.trim(), displayName: displayName.trim() };
    if (code.trim()) payload.code = code.trim();
    const res = await fetch(`${API_BASE}/player/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      setMessage(data.error || '登录失败');
      return false;
    }
    localStorage.setItem('player_auth_token', data.data.token);
    localStorage.setItem('player_info', JSON.stringify(data.data.player));
    return true;
  };

  const submitRequest = async () => {
    if (!scheduleId) return;
    setLoading(true);
    setMessage('');
    try {
      let token = getPlayerToken();
      if (!token) {
        const loggedIn = await loginPlayer();
        if (!loggedIn) return;
        token = getPlayerToken();
      }
      const res = await fetch(`${API_BASE}/player/join-schedules/${scheduleId}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roleName: roleName || null, note, source: 'qr_join' }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.data?.existing ? '你已经提交过申请了，等待店家确认' : '申请已提交，等待店家确认');
      } else if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('player_info');
        localStorage.removeItem('player_auth_token');
        setMessage(data.error || '请先登录玩家账号');
      } else {
        setMessage(data.error || '提交失败');
      }
    } catch {
      setMessage('提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const startWechatLogin = async () => {
    if (!scheduleId) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/player/wechat/url?redirect=${encodeURIComponent(`/join/${scheduleId}`)}`);
      const data = await res.json();
      if (data.success && data.data?.url) window.location.href = data.data.url;
      else setMessage(data.error || '微信扫码登录尚未配置');
    } catch {
      setMessage('微信登录启动失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <main className="mx-auto max-w-lg space-y-4">
        <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-semibold text-indigo-600">剧司辰拼车加入</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{schedule?.script_name || '排期加载中'}</h1>
          {schedule && (
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>{schedule.store_name || '店家'}{schedule.store_city ? ` · ${schedule.store_city}` : ''}</p>
              <p>{format(parseISO(schedule.start_time), 'yyyy年M月d日 EEEE HH:mm', { locale: zhCN })}</p>
              <p>{schedule.room_name || '房间待定'} · {schedule.status}</p>
              {schedule.pending_request_count ? <p>已有 {schedule.pending_request_count} 个申请等待确认</p> : null}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">想上哪个角色</label>
            <select value={roleName} onChange={event => setRoleName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">不挑角色 / 听店家安排</option>
              {availableRoles.map(role => (
                <option key={role.name} value={role.name}>{role.name}{role.gender ? ` (${role.gender})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">申请备注</label>
            <textarea value={note} onChange={event => setNote(event.target.value)}
              placeholder="例如：能反串、可补位、和朋友一起、偏好情感位"
              className="w-full min-h-24 rounded-xl border border-slate-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </section>

        {!getPlayerToken() && (
          <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 space-y-4">
            <h2 className="font-bold text-slate-900">先登录玩家身份</h2>
            <input value={phone} onChange={event => setPhone(event.target.value)} placeholder="手机号"
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="昵称"
              className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            {authConfig.smsEnabled && (
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <input value={code} onChange={event => setCode(event.target.value)} placeholder="验证码"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={sendCode} disabled={sending} className="rounded-xl border border-indigo-200 text-indigo-700 text-sm disabled:opacity-50">
                  {sending ? '发送中' : '发码'}
                </button>
              </div>
            )}
            {authConfig.wechatEnabled && (
              <button onClick={startWechatLogin} disabled={loading}
                className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 disabled:opacity-50">
                微信扫码登录
              </button>
            )}
          </section>
        )}

        {message && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{message}</div>
        )}

        <button onClick={submitRequest} disabled={loading || !schedule}
          className="w-full rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-sm disabled:opacity-50">
          {loading ? '提交中' : getPlayerToken() ? '提交加入申请' : '登录并提交申请'}
        </button>

        <button onClick={() => navigate('/')} className="w-full py-2 text-sm text-slate-400">返回剧司辰</button>
      </main>
    </div>
  );
}
