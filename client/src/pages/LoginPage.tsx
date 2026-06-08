import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type LoginMode = 'email' | 'phone' | 'register';

const modeTabs: Array<{ id: LoginMode; label: string }> = [
  { id: 'email', label: '邮箱登录' },
  { id: 'phone', label: '手机登录' },
  { id: 'register', label: '注册账号' },
];

interface AuthConfig {
  phoneEnabled: boolean;
  smsEnabled: boolean;
  legacyPasswordEnabled: boolean;
}

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ phoneEnabled: true, smsEnabled: false, legacyPasswordEnabled: false });
  const { loginWithEmail, loginWithPhone, registerWithEmail, sendAdminCode } = useAuth();
  const navigate = useNavigate();

  const goDashboard = () => navigate('/store/manage', { replace: true });

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/config')
      .then(res => res.json())
      .then(data => {
        if (mounted && data.success && data.data) setAuthConfig(data.data);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (mode === 'phone' && !authConfig.smsEnabled) {
      setMode('email');
      setInfo('短信验证码暂未启用，请先使用邮箱登录或注册。');
    }
  }, [authConfig.smsEnabled, mode]);

  const sendCode = async () => {
    if (!authConfig.smsEnabled) {
      setError('短信验证码暂未启用，请先使用邮箱登录');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone.replace(/\D/g, ''))) {
      setError('请填写正确的手机号');
      return;
    }
    setSendingCode(true);
    setError('');
    setInfo('');
    const result = await sendAdminCode(phone);
    setSendingCode(false);
    if (result.success) setInfo('验证码已发送，请查看短信');
    else setError(result.error || '验证码发送失败');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setInfo('');

    let result: { success: boolean; error?: string } = { success: false, error: '登录方式无效' };
    if (mode === 'email') {
      if (!email.trim() || !password.trim()) {
        setSubmitting(false);
        setError('请填写邮箱和密码');
        return;
      }
      result = await loginWithEmail(email.trim(), password);
    } else if (mode === 'phone') {
      if (!authConfig.smsEnabled) {
        setSubmitting(false);
        setError('短信验证码暂未启用，请先使用邮箱登录');
        return;
      }
      if (!phone.trim() || !code.trim()) {
        setSubmitting(false);
        setError('请填写手机号和验证码');
        return;
      }
      result = await loginWithPhone(phone.trim(), code.trim());
    } else if (mode === 'register') {
      if (!email.trim() || !password.trim()) {
        setSubmitting(false);
        setError('请填写邮箱和密码');
        return;
      }
      result = await registerWithEmail({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        phone: phone.trim() || undefined,
        code: code.trim() || undefined,
      });
    }

    setSubmitting(false);
    if (result.success) goDashboard();
    else setError(result.error || '登录失败');
  };

  const showPhoneCode = authConfig.smsEnabled && (mode === 'phone' || mode === 'register');
  const showEmail = mode === 'email' || mode === 'register';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-500/20 mb-4">
            <svg className="w-8 h-8 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">剧司辰店家后台</h1>
          <p className="text-slate-300 mt-1">用邮箱或手机号进入排期系统</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {modeTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                disabled={tab.id === 'phone' && !authConfig.smsEnabled}
                onClick={() => {
                  setMode(tab.id);
                  setError('');
                  setInfo('');
                }}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                  mode === tab.id ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                } disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === 'register' && (
            <Field label="店家名称">
              <input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="例如：清徽剧本杀"
                className={inputClass} />
            </Field>
          )}

          {showEmail && (
            <Field label="邮箱">
              <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"
                className={inputClass} autoFocus={mode === 'email'} />
            </Field>
          )}

          {showEmail && (
            <Field label={mode === 'register' ? '设置密码' : '密码'}>
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'register' ? '至少 8 位' : '请输入密码'}
                className={inputClass} />
            </Field>
          )}

          {showPhoneCode && (
            <Field label={mode === 'register' ? '绑定手机（可选）' : '手机号'}>
              <input value={phone} onChange={event => setPhone(event.target.value)} placeholder="中国大陆手机号"
                className={inputClass} autoFocus={mode === 'phone'} />
            </Field>
          )}

          {showPhoneCode && (
            <Field label={mode === 'register' ? '验证码（绑定手机时填写）' : '验证码'}>
              <div className="flex gap-2">
                <input value={code} onChange={event => setCode(event.target.value)} placeholder="6位验证码"
                  className={`${inputClass} flex-1`} />
                <button type="button" onClick={sendCode} disabled={sendingCode || !phone.trim()}
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-40">
                  {sendingCode ? '发送中' : '发验证码'}
                </button>
              </div>
            </Field>
          )}

          {info && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">{info}</div>}
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {submitting ? '处理中...' : mode === 'register' ? '注册并进入后台' : '进入后台'}
          </button>

          <p className="text-xs text-slate-500 leading-6">
            邮箱账号可以先注册使用，短信启用后可在后台绑定手机号并用验证码登录。
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors';
