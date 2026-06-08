import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import RoomManager from './RoomManager';
import ActorManager from './ActorManager';
import ScriptManager from './ScriptManager';
import ScheduleCalendar from './ScheduleCalendar';
import CustomerManager from './CustomerManager';
import ConflictResolutionPage from '../pages/ConflictResolutionPage';
import StoreManager from './StoreManager';
import { useApi } from '../hooks/useApi';
import type { StoreRecord } from '../types';

type Tab = 'platform' | 'stores' | 'rooms' | 'actors' | 'scripts' | 'schedule' | 'customers' | 'conflicts';

const basePath = '/store/manage';
const storeTabs = [
  { id: 'schedule' as Tab, label: '📅 排期管理', color: 'bg-blue-500', path: `${basePath}/schedule` },
  { id: 'stores' as Tab, label: '🏪 多店家', color: 'bg-indigo-500', path: `${basePath}/stores` },
  { id: 'rooms' as Tab, label: '🚪 房间管理', color: 'bg-green-500', path: `${basePath}/rooms` },
  { id: 'actors' as Tab, label: '🎭 卡司管理', color: 'bg-purple-500', path: `${basePath}/actors` },
  { id: 'scripts' as Tab, label: '📖 剧本管理', color: 'bg-orange-500', path: `${basePath}/scripts` },
  { id: 'customers' as Tab, label: '⭐ 会员管理', color: 'bg-yellow-500', path: `${basePath}/customers` },
  { id: 'conflicts' as Tab, label: '⚖️ 矛盾调解', color: 'bg-red-500', path: `${basePath}/conflicts` },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const tabs = isSuperAdmin
    ? [
      { id: 'platform' as Tab, label: '📊 平台总览', color: 'bg-slate-900', path: `${basePath}/platform` },
      { id: 'stores' as Tab, label: '🏪 店家管理', color: 'bg-indigo-500', path: `${basePath}/stores` },
    ]
    : storeTabs;
  
  const currentPath = location.pathname;
  const activeTab = tabs.find(t => t.path === currentPath)?.id || (isSuperAdmin ? 'platform' : 'schedule');

  const handleTabChange = (tabId: Tab) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      navigate(tab.path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Logo size={32} />
              <h1 className="text-2xl font-bold text-gray-800">
                <span className="text-indigo-500">剧</span>司辰
                <span className="text-sm font-normal text-gray-400 ml-2 tracking-wider">剧本杀排期系统</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <AccountPhoneBinder />
              <NotificationBell />
              <button
                onClick={logout}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
          <nav className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? `${tab.color} text-white shadow-md`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          {isSuperAdmin && <Route path="platform" element={<PlatformOverview />} />}
          <Route path="stores" element={<StoreManager />} />
          {!isSuperAdmin && <Route path="rooms" element={<RoomManager />} />}
          {!isSuperAdmin && <Route path="actors" element={<ActorManager />} />}
          {!isSuperAdmin && <Route path="scripts" element={<ScriptManager />} />}
          {!isSuperAdmin && <Route path="schedule" element={<ScheduleCalendar />} />}
          {!isSuperAdmin && <Route path="customers" element={<CustomerManager />} />}
          {!isSuperAdmin && <Route path="conflicts" element={<ConflictResolutionPage />} />}
          <Route path="" element={<Navigate to={isSuperAdmin ? `${basePath}/platform` : `${basePath}/schedule`} replace />} />
        </Routes>
      </main>

      <footer className="text-center py-6 border-t border-gray-200 text-sm text-gray-400">
        <a
          href="https://lingqi.jusichen.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-500 hover:text-indigo-600 transition-colors font-medium"
        >
          灵契 · 创作者数字名片 →
        </a>
      </footer>
    </div>
  );
}

interface PlatformSummary {
  storeCount: number;
  activeStoreCount: number;
  adminUserCount: number;
  scriptCount: number;
  scheduleCount: number;
  recentStores: StoreRecord[];
}

function PlatformOverview() {
  const { get, loading } = useApi();
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [message, setMessage] = useState('');

  const loadSummary = async () => {
    const result = await get<PlatformSummary>('/platform/summary');
    if (result.success && result.data) {
      setSummary(result.data);
      setMessage('');
    } else {
      setMessage(result.error || '平台数据加载失败');
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const cards = [
    { label: '注册店家', value: summary?.storeCount ?? 0, hint: `${summary?.activeStoreCount ?? 0} 家启用中` },
    { label: '后台账号', value: summary?.adminUserCount ?? 0, hint: '邮箱/手机号后台账号' },
    { label: '剧本数据', value: summary?.scriptCount ?? 0, hint: '所有店家累计' },
    { label: '排期数据', value: summary?.scheduleCount ?? 0, hint: '所有店家累计' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">平台总览</h2>
            <p className="text-sm text-gray-500 mt-1">超级管理员视角，只看平台聚合数据和店家注册情况。</p>
          </div>
          <button
            type="button"
            onClick={loadSummary}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? '刷新中' : '刷新'}
          </button>
        </div>
        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map(card => (
          <article key={card.label} className="bg-white rounded-lg shadow p-5 border border-gray-100">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
            <p className="text-xs text-gray-400 mt-2">{card.hint}</p>
          </article>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold text-gray-900 mb-4">最近注册店家</h3>
        <div className="divide-y divide-gray-100">
          {(summary?.recentStores || []).map(store => (
            <div key={store.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-800">{store.name}</p>
                <p className="text-sm text-gray-500">{store.city || '未设置城市'}{store.address ? ` · ${store.address}` : ''}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">{store.status}</span>
                <p className="text-xs text-gray-400 mt-1">{store.created_at ? new Date(store.created_at).toLocaleString('zh-CN') : ''}</p>
              </div>
            </div>
          ))}
          {summary && summary.recentStores.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">暂无店家注册</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountPhoneBinder() {
  const { user, sendBindPhoneCode, bindPhone } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const sendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone.replace(/\D/g, ''))) {
      setMessage('请填写正确的手机号');
      return;
    }
    setSending(true);
    setMessage('');
    const result = await sendBindPhoneCode(phone);
    setSending(false);
    setMessage(result.success ? '验证码已发送' : result.error || '验证码发送失败');
  };

  const submit = async () => {
    if (!phone.trim() || !code.trim()) {
      setMessage('请填写手机号和验证码');
      return;
    }
    setSaving(true);
    setMessage('');
    const result = await bindPhone(phone, code);
    setSaving(false);
    if (result.success) {
      setMessage('手机号已绑定');
      setOpen(false);
      setPhone('');
      setCode('');
    } else {
      setMessage(result.error || '绑定失败');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
          user?.phone
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
        }`}
      >
        {user?.phone ? `${user.displayName || '管理员'} · ${user.phone}` : '绑定手机'}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-80 rounded-xl border border-gray-200 bg-white shadow-xl p-4 text-left">
          <div className="mb-3">
            <p className="text-sm font-semibold text-gray-800">绑定后台手机号</p>
            <p className="text-xs text-gray-500 mt-1">绑定后可用验证码直接进入店家后台。</p>
          </div>
          <div className="space-y-2">
            <input value={phone} onChange={event => setPhone(event.target.value)} placeholder="手机号"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <div className="flex gap-2">
              <input value={code} onChange={event => setCode(event.target.value)} placeholder="验证码"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <button type="button" onClick={sendCode} disabled={sending || !phone.trim()}
                className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-40">
                {sending ? '发送中' : '发码'}
              </button>
            </div>
            {message && <p className="text-xs text-gray-500">{message}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
              <button type="button" onClick={submit} disabled={saving}
                className="px-3 py-1.5 text-sm text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 rounded-lg">
                {saving ? '绑定中' : '确认绑定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
