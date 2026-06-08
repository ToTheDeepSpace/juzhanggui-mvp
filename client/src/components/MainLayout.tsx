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

type Tab = 'platform' | 'stores' | 'adminUsers' | 'templates' | 'auditLogs' | 'rooms' | 'actors' | 'scripts' | 'schedule' | 'customers' | 'conflicts';

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
      { id: 'adminUsers' as Tab, label: '👤 账号管理', color: 'bg-cyan-600', path: `${basePath}/admin-users` },
      { id: 'templates' as Tab, label: '📚 模板中心', color: 'bg-emerald-600', path: `${basePath}/templates` },
      { id: 'auditLogs' as Tab, label: '🧾 操作日志', color: 'bg-amber-600', path: `${basePath}/audit-logs` },
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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                <span className="text-indigo-500">剧</span>司辰
                <span className="hidden sm:inline text-sm font-normal text-gray-400 ml-2 tracking-wider">剧本杀排期系统</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <AccountSecurityMenu />
              <NotificationBell />
              <button
                onClick={logout}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
          <nav className="flex space-x-2 overflow-x-auto pb-1">
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
          {isSuperAdmin && <Route path="admin-users" element={<AdminUsersPanel />} />}
          {isSuperAdmin && <Route path="templates" element={<TemplateCenterPanel />} />}
          {isSuperAdmin && <Route path="audit-logs" element={<AuditLogsPanel />} />}
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
  recentAdminUsers: PlatformAdminUser[];
  recentSchedules: PlatformSchedule[];
}

interface PlatformAdminUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  display_name?: string | null;
  role: string;
  status: string;
  store?: { name?: string | null; city?: string | null; status?: string | null } | null;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
}

interface PlatformSchedule {
  id: string;
  scheduled_date?: string | null;
  start_time?: string | null;
  status?: string | null;
  created_at?: string | null;
  store?: { name?: string | null; city?: string | null } | null;
  script?: { name?: string | null } | null;
}

interface ScriptTemplateRow {
  id: string;
  name: string;
  duration_minutes?: number;
  min_duration_hours?: number;
  max_duration_hours?: number;
  player_roles?: { role_name: string; gender?: string }[];
  actor_roles?: { role_name: string; gender?: string }[];
  usage_count?: number;
  created_by?: string | null;
  created_at?: string | null;
  store?: { name?: string | null; city?: string | null } | null;
}

interface AuditLogRow {
  id: string;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;
  detail?: Record<string, unknown>;
  ip_address?: string | null;
  created_at?: string | null;
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold text-gray-900 mb-4">最近后台账号</h3>
          <div className="divide-y divide-gray-100">
            {(summary?.recentAdminUsers || []).map(user => (
              <div key={user.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-800">{user.display_name || user.email || user.phone || '未命名账号'}</p>
                  <p className="text-sm text-gray-500">{user.store?.name || '未绑定店家'} · {user.role}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                    {user.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : ''}</p>
                </div>
              </div>
            ))}
            {summary && summary.recentAdminUsers.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">暂无后台账号</p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold text-gray-900 mb-4">最近排期</h3>
          <div className="divide-y divide-gray-100">
            {(summary?.recentSchedules || []).map(schedule => (
              <div key={schedule.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-800">{schedule.script?.name || '未命名剧本'}</p>
                  <p className="text-sm text-gray-500">{schedule.store?.name || '未知店家'} · {schedule.scheduled_date || '未定日期'} {schedule.start_time || ''}</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{schedule.status || 'unknown'}</span>
                  <p className="text-xs text-gray-400 mt-1">{schedule.created_at ? new Date(schedule.created_at).toLocaleString('zh-CN') : ''}</p>
                </div>
              </div>
            ))}
            {summary && summary.recentSchedules.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">暂无排期</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminUsersPanel() {
  const { get, put, post, loading } = useApi();
  const [users, setUsers] = useState<PlatformAdminUser[]>([]);
  const [message, setMessage] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  const loadUsers = async () => {
    const result = await get<PlatformAdminUser[]>('/platform/admin-users');
    if (result.success && result.data) {
      setUsers(result.data);
      setMessage('');
    } else {
      setMessage(result.error || '账号加载失败');
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const setStatus = async (user: PlatformAdminUser, status: 'active' | 'disabled') => {
    const result = await put<PlatformAdminUser>(`/platform/admin-users/${user.id}/status`, { status });
    if (result.success) {
      setMessage(status === 'active' ? '账号已启用' : '账号已停用');
      void loadUsers();
    } else {
      setMessage(result.error || '状态修改失败');
    }
  };

  const resetPassword = async (user: PlatformAdminUser) => {
    const confirmed = window.confirm(`确定要重置 ${user.email || user.phone || user.display_name} 的密码吗？`);
    if (!confirmed) return;
    const result = await post<{ tempPassword: string }>(`/platform/admin-users/${user.id}/reset-password`, {});
    if (result.success && result.data?.tempPassword) {
      setTempPassword(result.data.tempPassword);
      setMessage('临时密码已生成，只在这里显示一次');
      void loadUsers();
    } else {
      setMessage(result.error || '重置失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">后台账号管理</h2>
            <p className="text-sm text-gray-500 mt-1">查看店家后台账号，必要时停用账号或生成一次性临时密码。</p>
          </div>
          <button onClick={loadUsers} disabled={loading} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50">
            {loading ? '刷新中' : '刷新'}
          </button>
        </div>
        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
        {tempPassword && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700">临时密码</p>
            <p className="mt-1 break-all font-mono text-sm text-amber-900">{tempPassword}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">账号</th>
                <th className="px-4 py-3">店家</th>
                <th className="px-4 py-3">角色</th>
                <th className="px-4 py-3">认证</th>
                <th className="px-4 py-3">最近登录</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{user.display_name || '未命名'}</p>
                    <p className="text-xs text-gray-500">{user.email || user.phone || user.id}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.store?.name || '未绑定'}</td>
                  <td className="px-4 py-3 text-gray-600">{user.role}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {user.email_verified_at ? '邮箱已验' : '邮箱未验'} · {user.phone_verified_at ? '手机已验' : '手机未验'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{user.last_login_at ? new Date(user.last_login_at).toLocaleString('zh-CN') : '从未登录'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>{user.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => resetPassword(user)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">重置密码</button>
                      {user.status === 'active' ? (
                        <button onClick={() => setStatus(user, 'disabled')} className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">停用</button>
                      ) : (
                        <button onClick={() => setStatus(user, 'active')} className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50">启用</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">暂无后台账号</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TemplateCenterPanel() {
  const { get, post, loading } = useApi();
  const [templates, setTemplates] = useState<ScriptTemplateRow[]>([]);
  const [message, setMessage] = useState('');

  const loadTemplates = async () => {
    const result = await get<ScriptTemplateRow[]>('/platform/script-templates');
    if (result.success && result.data) {
      setTemplates(result.data);
      setMessage('');
    } else {
      setMessage(result.error || '模板加载失败');
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const syncExistingScripts = async () => {
    const result = await post<{ count: number }>('/platform/script-templates/sync-existing', {});
    if (result.success) {
      setMessage(`已同步 ${result.data?.count || 0} 个已有剧本模板`);
      void loadTemplates();
    } else {
      setMessage(result.error || '同步失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">公共剧本模板中心</h2>
          <p className="text-sm text-gray-500 mt-1">所有店家发布到公共模板库的剧本，其他店家可一键导入。旧数据可由超管一键同步进模板库。</p>
          {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={syncExistingScripts} disabled={loading} className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm hover:bg-emerald-100 disabled:opacity-50">
            同步已有剧本
          </button>
          <button onClick={loadTemplates} disabled={loading} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50">
            {loading ? '刷新中' : '刷新'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map(template => (
          <article key={template.id} className="bg-white rounded-lg shadow p-5 border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900">{template.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{template.store?.name || '未知来源'} · 已导入 {template.usage_count || 0} 次</p>
              </div>
              <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">模板</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
              <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{template.duration_minutes || 0}</p><p>分钟</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{template.player_roles?.length || 0}</p><p>玩家位</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{template.actor_roles?.length || 0}</p><p>卡司位</p></div>
            </div>
            <p className="mt-4 text-xs text-gray-400">创建：{template.created_at ? new Date(template.created_at).toLocaleString('zh-CN') : ''}</p>
          </article>
        ))}
        {templates.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 bg-white rounded-lg shadow p-10 text-center text-gray-400">暂无公共剧本模板</div>
        )}
      </div>
    </div>
  );
}

function AuditLogsPanel() {
  const { get, loading } = useApi();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [message, setMessage] = useState('');

  const loadLogs = async () => {
    const result = await get<AuditLogRow[]>('/platform/audit-logs');
    if (result.success && result.data) {
      setLogs(result.data);
      setMessage('');
    } else {
      setMessage(result.error || '日志加载失败');
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">平台操作日志</h2>
          <p className="text-sm text-gray-500 mt-1">记录超管进入店家视角、启停账号、重置密码、新建店家等关键动作。</p>
          {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
        </div>
        <button onClick={loadLogs} disabled={loading} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50">
          {loading ? '刷新中' : '刷新'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">时间</th>
                <th className="px-4 py-3">操作者</th>
                <th className="px-4 py-3">动作</th>
                <th className="px-4 py-3">对象</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : ''}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{log.actor_email || '系统'}</p>
                    <p className="text-xs text-gray-400">{log.actor_role || ''}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{log.action}</td>
                  <td className="px-4 py-3 text-gray-600">{log.target_label || log.target_id || log.target_type || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{log.ip_address || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">暂无操作日志</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AccountSecurityMenu() {
  const { user, sendBindPhoneCode, bindPhone, sendAdminEmailCode, changePasswordWithEmail } = useAuth();
  const [open, setOpen] = useState(false);
  const [hasSuperAdminBackup, setHasSuperAdminBackup] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setHasSuperAdminBackup(!!localStorage.getItem('super_admin_token_backup'));
  }, []);

  const restoreSuperAdmin = () => {
    const token = localStorage.getItem('super_admin_token_backup');
    const userJson = localStorage.getItem('super_admin_user_backup');
    if (!token || !userJson) {
      setMessage('没有可恢复的超管会话');
      return;
    }
    localStorage.setItem('auth_token', token);
    localStorage.setItem('admin_user', userJson);
    localStorage.removeItem('super_admin_token_backup');
    localStorage.removeItem('super_admin_user_backup');
    window.location.href = `${basePath}/platform`;
  };

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

  const sendEmailPasswordCode = async () => {
    if (!user?.email) {
      setMessage('当前账号没有邮箱');
      return;
    }
    setSendingEmail(true);
    setMessage('');
    const result = await sendAdminEmailCode(user.email, 'admin_reset_password');
    setSendingEmail(false);
    setMessage(result.success ? '改密验证码已发送到当前邮箱' : result.error || '邮箱验证码发送失败');
  };

  const submitPasswordChange = async () => {
    if (!emailCode.trim() || !newPassword.trim()) {
      setMessage('请填写邮箱验证码和新密码');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('两次输入的新密码不一致');
      return;
    }
    setChangingPassword(true);
    setMessage('');
    const result = await changePasswordWithEmail(emailCode, newPassword);
    setChangingPassword(false);
    if (result.success) {
      setMessage('密码已修改');
      setEmailCode('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage(result.error || '修改密码失败');
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      {hasSuperAdminBackup && (
        <button
          type="button"
          onClick={restoreSuperAdmin}
          className="px-3 py-1.5 text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
        >
          返回超管
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="px-3 py-1.5 text-sm rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
      >
        账号安全 / 改密码
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white shadow-xl p-4 text-left">
          <div className="space-y-2">
            <div className="pb-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">账号安全</p>
              <p className="text-xs text-gray-500 mt-1">{user?.email || '未设置邮箱'}{user?.phone ? ` · ${user.phone}` : ''}</p>
            </div>

            <div className="pt-2">
              <p className="text-sm font-semibold text-gray-800">验证邮箱修改密码</p>
              <p className="text-xs text-gray-500 mt-1">验证码会发送到当前登录邮箱，验证后直接更新后台密码。</p>
            </div>
            <div className="flex gap-2">
              <input value={emailCode} onChange={event => setEmailCode(event.target.value)} placeholder="邮箱验证码"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <button type="button" onClick={sendEmailPasswordCode} disabled={sendingEmail || !user?.email}
                className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-40">
                {sendingEmail ? '发送中' : '发码'}
              </button>
            </div>
            <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="新密码，至少 8 位"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="确认新密码"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <div className="flex justify-end">
              <button type="button" onClick={submitPasswordChange} disabled={changingPassword}
                className="px-3 py-1.5 text-sm text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 rounded-lg">
                {changingPassword ? '修改中' : '确认修改密码'}
              </button>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-800">绑定后台手机号</p>
              <p className="text-xs text-gray-500 mt-1">绑定后可用验证码直接进入店家后台。</p>
            </div>
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
