import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type LoginMode = 'login' | 'register' | 'resetPassword';

const modeTabs: Array<{ id: Exclude<LoginMode, 'resetPassword'>; label: string }> = [
  { id: 'login', label: '登录' },
  { id: 'register', label: '注册账号' },
];

interface AuthConfig {
  emailCodeEnabled: boolean;
  emailCodeRequired: boolean;
  phoneEnabled: boolean;
  smsEnabled: boolean;
  legacyPasswordEnabled: boolean;
}

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    emailCodeEnabled: false,
    emailCodeRequired: false,
    phoneEnabled: true,
    smsEnabled: false,
    legacyPasswordEnabled: false,
  });
  const { loginWithEmail, registerWithEmail, resetPasswordWithEmail, sendAdminEmailCode } = useAuth();
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
    if ((mode === 'register' || mode === 'resetPassword') && !authConfig.emailCodeEnabled) {
      setMode('login');
      setInfo('邮箱验证码暂未启用，暂不能注册或通过邮箱改密；已注册账号可用邮箱密码登录。');
    }
  }, [authConfig.emailCodeEnabled, mode]);

  const sendEmailCode = async () => {
    if (!authConfig.emailCodeEnabled) {
      setError('邮箱验证码暂未启用，请先使用密码登录');
      return;
    }
    if (!email.trim()) {
      setError('请先填写邮箱');
      return;
    }
    setSendingEmailCode(true);
    setError('');
    setInfo('');
    const purpose = mode === 'register' ? 'admin_register' : 'admin_reset_password';
    const result = await sendAdminEmailCode(email.trim(), purpose);
    setSendingEmailCode(false);
    if (result.success) setInfo('验证码已发送，请查看邮箱');
    else setError(result.error || '邮箱验证码发送失败');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setInfo('');

    let result: { success: boolean; error?: string } = { success: false, error: '登录方式无效' };
    if (mode === 'login') {
      if (!email.trim()) {
        setSubmitting(false);
        setError('请填写邮箱');
        return;
      }
      if (!password.trim()) {
        setSubmitting(false);
        setError('请填写密码');
        return;
      }
      result = await loginWithEmail(email.trim(), password);
    } else if (mode === 'register') {
      if (!authConfig.emailCodeEnabled) {
        setSubmitting(false);
        setError('邮箱验证码暂未启用，暂不能注册');
        return;
      }
      if (!email.trim() || !password.trim() || !emailCode.trim()) {
        setSubmitting(false);
        setError('请填写邮箱、邮箱验证码和密码');
        return;
      }
      if (!acceptedTerms) {
        setSubmitting(false);
        setError('请先阅读并同意用户协议和隐私政策');
        return;
      }
      result = await registerWithEmail({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        emailCode: emailCode.trim(),
      });
    } else if (mode === 'resetPassword') {
      if (!email.trim() || !emailCode.trim() || !password.trim()) {
        setSubmitting(false);
        setError('请填写邮箱、验证码和新密码');
        return;
      }
      if (password !== confirmPassword) {
        setSubmitting(false);
        setError('两次输入的新密码不一致');
        return;
      }
      result = await resetPasswordWithEmail(email.trim(), emailCode.trim(), password);
    }

    setSubmitting(false);
    if (result.success) goDashboard();
    else setError(result.error || '登录失败');
  };

  const showEmailCode = authConfig.emailCodeEnabled && (mode === 'register' || mode === 'resetPassword');
  const showPassword = mode === 'login' || mode === 'register' || mode === 'resetPassword';

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
          <p className="text-slate-300 mt-1">店家账号登录、注册和改密入口</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {modeTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                disabled={(tab.id === 'register' || tab.id === 'resetPassword') && !authConfig.emailCodeEnabled}
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

          <Field label="邮箱">
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"
              className={inputClass} autoFocus />
          </Field>

          {!authConfig.emailCodeEnabled && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-6 text-amber-800">
              邮箱验证码暂未启用，当前只能使用已注册账号的邮箱密码登录；注册账号和忘记密码会在邮箱验证码服务开通后开放。
            </div>
          )}
          {authConfig.emailCodeEnabled && mode === 'login' && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-xs leading-6 text-sky-800">
              邮箱只需在注册或忘记密码时验证一次，日常登录请直接使用邮箱和密码。
            </div>
          )}

          {showEmailCode && (
            <Field label={mode === 'register' ? '邮箱验证码' : mode === 'resetPassword' ? '改密验证码' : '验证码'}>
              <div className="flex gap-2">
                <input value={emailCode} onChange={event => setEmailCode(event.target.value)} placeholder="6位验证码"
                  className={`${inputClass} flex-1`} inputMode="numeric" />
                <button type="button" onClick={sendEmailCode} disabled={sendingEmailCode || !email.trim()}
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-40">
                  {sendingEmailCode ? '发送中' : '发验证码'}
                </button>
              </div>
            </Field>
          )}

          {showPassword && (
            <Field label={mode === 'register' ? '设置密码' : mode === 'resetPassword' ? '新密码' : '密码'}>
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'register' || mode === 'resetPassword' ? '至少 8 位' : '请输入密码'}
                className={inputClass} />
            </Field>
          )}

          {mode === 'resetPassword' && (
            <Field label="确认新密码">
              <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="再输入一次新密码"
                className={inputClass} />
            </Field>
          )}

          {mode === 'register' && (
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={event => setAcceptedTerms(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>
                我已阅读并同意
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="mx-1 font-semibold text-sky-700 hover:text-sky-600">《用户协议》</a>
                和
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="mx-1 font-semibold text-sky-700 hover:text-sky-600">《隐私政策》</a>
                ，知悉店家数据、线下履约、费用发票和账号安全等规则。
              </span>
            </label>
          )}

          {info && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">{info}</div>}
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={submitting || (mode === 'register' && !acceptedTerms)}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {submitting ? '处理中...' : mode === 'register' ? '注册并进入后台' : mode === 'resetPassword' ? '修改密码并进入后台' : '进入后台'}
          </button>

          {mode !== 'register' && (
            <div className="text-center">
              <button
                type="button"
                disabled={!authConfig.emailCodeEnabled}
                onClick={() => {
                  setMode('resetPassword');
                  setError('');
                  setInfo('');
                  setPassword('');
                  setConfirmPassword('');
                  setEmailCode('');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-sky-600 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                忘记密码？
              </button>
            </div>
          )}

          <p className="text-xs text-slate-500 leading-6">
            注册和忘记密码都必须先验证邮箱；验证通过后请用邮箱密码日常登录，手机号可在进入后台后绑定。
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
