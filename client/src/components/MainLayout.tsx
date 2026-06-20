import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import ComplianceFooter from './ComplianceFooter';
import RoomManager from './RoomManager';
import ActorManager from './ActorManager';
import ScriptManager from './ScriptManager';
import ScheduleCalendar from './ScheduleCalendar';
import CustomerManager from './CustomerManager';
import EvaluationManager from './EvaluationManager';
import ConflictResolutionPage from '../pages/ConflictResolutionPage';
import StoreManager from './StoreManager';
import { useApi } from '../hooks/useApi';
import type { ScriptBoard, StoreRecord } from '../types';

type Tab = 'platform' | 'stores' | 'adminUsers' | 'templates' | 'feedbackInbox' | 'auditLogs' | 'rooms' | 'actors' | 'scripts' | 'schedule' | 'evaluations' | 'customers' | 'conflicts' | 'feedback' | 'operationLogs';

const basePath = '/store/manage';
const storeTabs = [
  { id: 'schedule' as Tab, label: '📅 排期管理', color: 'bg-blue-500', path: `${basePath}/schedule` },
  { id: 'stores' as Tab, label: '🏪 店铺设置', color: 'bg-indigo-500', path: `${basePath}/stores` },
  { id: 'rooms' as Tab, label: '🚪 房间管理', color: 'bg-green-500', path: `${basePath}/rooms` },
  { id: 'actors' as Tab, label: '🎭 卡司管理', color: 'bg-purple-500', path: `${basePath}/actors` },
  { id: 'scripts' as Tab, label: '📖 剧本管理', color: 'bg-orange-500', path: `${basePath}/scripts` },
  { id: 'evaluations' as Tab, label: '⭐ 评价反馈', color: 'bg-amber-500', path: `${basePath}/evaluations` },
  { id: 'customers' as Tab, label: '⭐ 会员管理', color: 'bg-yellow-500', path: `${basePath}/customers` },
  { id: 'conflicts' as Tab, label: '⚖️ 矛盾调解', color: 'bg-red-500', path: `${basePath}/conflicts` },
  { id: 'operationLogs' as Tab, label: '🧾 操作日志', color: 'bg-slate-700', path: `${basePath}/operation-logs` },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { post } = useApi();
  const [switchingStore, setSwitchingStore] = useState(false);
  const [identityMessage, setIdentityMessage] = useState('');
  const isSuperAdmin = user?.role === 'super_admin';
  const tabs = isSuperAdmin
    ? [
      { id: 'platform' as Tab, label: '📊 平台总览', color: 'bg-slate-900', path: `${basePath}/platform` },
      { id: 'stores' as Tab, label: '🏪 店家管理', color: 'bg-indigo-500', path: `${basePath}/stores` },
      { id: 'adminUsers' as Tab, label: '👤 账号管理', color: 'bg-cyan-600', path: `${basePath}/admin-users` },
      { id: 'templates' as Tab, label: '📚 模板中心', color: 'bg-emerald-600', path: `${basePath}/templates` },
      { id: 'feedbackInbox' as Tab, label: '💬 站内信', color: 'bg-sky-600', path: `${basePath}/feedback-inbox` },
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

  const enterOwnStoreIdentity = async () => {
    const storeId = user?.storeId || user?.tenantId;
    const token = localStorage.getItem('admin_auth_token') || localStorage.getItem('auth_token');
    const userJson = localStorage.getItem('admin_user');
    if (!storeId || !token || !userJson) {
      setIdentityMessage('当前超管账号还没有绑定店家，先到店家管理里进入指定店家。');
      return;
    }
    setSwitchingStore(true);
    setIdentityMessage('');
    const result = await post<{ token: string; user: unknown }>('/platform/impersonate-store', { storeId });
    setSwitchingStore(false);
    if (!result.success || !result.data?.token) {
      setIdentityMessage(result.error || '进入店家身份失败');
      return;
    }
    localStorage.setItem('super_admin_token_backup', token);
    localStorage.setItem('super_admin_user_backup', userJson);
    localStorage.setItem('admin_auth_token', result.data.token);
    localStorage.setItem('auth_token', result.data.token);
    localStorage.setItem('admin_user', JSON.stringify(result.data.user));
    window.location.href = `${basePath}/schedule`;
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
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={enterOwnStoreIdentity}
                  disabled={switchingStore}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {switchingStore ? '切换中...' : '进入店家身份'}
                </button>
              )}
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
          {identityMessage && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {identityMessage}
            </div>
          )}
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
        {!isSuperAdmin && (
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <p className="font-semibold">内测试用说明</p>
              <p className="text-xs md:text-sm">当前版本建议由老板/店长使用；遇到数据异常或流程建议，请通过右侧“建议反馈”提交，关键操作会记录到店内操作日志。</p>
            </div>
          </div>
        )}
        <Routes>
          {isSuperAdmin && <Route path="platform" element={<PlatformOverview />} />}
          <Route path="stores" element={<StoreManager />} />
          {isSuperAdmin && <Route path="admin-users" element={<AdminUsersPanel />} />}
          {isSuperAdmin && <Route path="templates" element={<TemplateCenterPanel />} />}
          {isSuperAdmin && <Route path="feedback-inbox" element={<FeedbackInboxPanel />} />}
          {isSuperAdmin && <Route path="audit-logs" element={<AuditLogsPanel />} />}
          {!isSuperAdmin && <Route path="rooms" element={<RoomManager />} />}
          {!isSuperAdmin && <Route path="actors" element={<ActorManager />} />}
          {!isSuperAdmin && <Route path="scripts" element={<ScriptManager />} />}
          {!isSuperAdmin && <Route path="schedule" element={<ScheduleCalendar />} />}
          {!isSuperAdmin && <Route path="evaluations" element={<EvaluationManager />} />}
          {!isSuperAdmin && <Route path="feedback" element={<FeedbackPanel />} />}
          {!isSuperAdmin && <Route path="customers" element={<CustomerManager />} />}
          {!isSuperAdmin && <Route path="conflicts" element={<ConflictResolutionPage />} />}
          {!isSuperAdmin && <Route path="operation-logs" element={<StoreOperationLogsPanel />} />}
          <Route path="" element={<Navigate to={isSuperAdmin ? `${basePath}/platform` : `${basePath}/schedule`} replace />} />
          <Route path="*" element={<Navigate to={isSuperAdmin ? `${basePath}/platform` : `${basePath}/schedule`} replace />} />
        </Routes>
      </main>

      {!isSuperAdmin && currentPath !== `${basePath}/feedback` && (
        <button
          type="button"
          onClick={() => navigate(`${basePath}/feedback`)}
          className="fixed right-4 top-1/2 z-40 -translate-y-1/2 rounded-l-2xl rounded-r-md bg-sky-600 px-3 py-4 text-sm font-medium text-white shadow-lg transition hover:bg-sky-700 sm:right-6"
          title="建议反馈"
        >
          <span className="block leading-tight">建议</span>
          <span className="block leading-tight">反馈</span>
        </button>
      )}

      <ComplianceFooter />
    </div>
  );
}

type PlatformTodoItem = {
  id: string;
  title: string;
  store?: string;
  created_at?: string;
};

type PlatformTodoGroup = {
  key: string;
  title: string;
  count: number;
  tone: 'high' | 'medium' | 'normal';
  path: string;
  items: PlatformTodoItem[];
};

type PlatformSummary = {
  storeCount: number;
  activeStoreCount: number;
  adminUserCount: number;
  scriptCount: number;
  scheduleCount: number;
  todoItems?: PlatformTodoGroup[];
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
  player_count?: number;
  player_selection_rule?: string | null;
  player_roles?: { role_name: string; gender?: string }[];
  actor_roles?: { role_name: string; gender?: string }[];
  boards?: ScriptBoard[];
  usage_count?: number;
  created_by?: string | null;
  review_status?: 'pending' | 'approved' | 'rejected';
  reject_reason?: string | null;
  reviewed_at?: string | null;
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

interface FeedbackMessageRow {
  id: string;
  tenant_id?: string | null;
  admin_user_id?: string | null;
  category: string;
  title: string;
  content: string;
  moderation_precheck?: {
    decision?: 'pass' | 'review' | 'block';
    risk_score?: number;
    risk_labels?: string[];
    summary?: string;
  } | null;
  status: string;
  priority?: string | null;
  reply?: string | null;
  replied_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  store?: { name?: string | null; city?: string | null } | null;
  admin?: { email?: string | null; display_name?: string | null } | null;
  replier?: { email?: string | null; display_name?: string | null } | null;
}

const feedbackCategoryText: Record<string, string> = {
  suggestion: '建议',
  bug: '问题',
  question: '咨询',
  complaint: '投诉申诉',
  report: '举报',
  illegal_content: '违法信息',
  security: '账号/安全事件',
  privacy: '隐私/个人信息',
  other: '其他',
};
const feedbackStatusText: Record<string, string> = {
  new: '新反馈',
  processing: '处理中',
  resolved: '已处理',
  closed: '已关闭',
};
const feedbackPriorityText: Record<string, string> = {
  urgent: '紧急',
  high: '高优先级',
  normal: '普通',
  low: '低',
};

function ModerationPrecheckPill({ value }: { value?: FeedbackMessageRow['moderation_precheck'] }) {
  if (!value) return null;
  const decision = value.decision || 'pass';
  const colorClass = decision === 'block'
    ? 'border-red-200 bg-red-50 text-red-700'
    : decision === 'review'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  const label = decision === 'block' ? '建议拦截' : decision === 'review' ? '需关注' : '通过';
  const tags = Array.isArray(value.risk_labels) ? value.risk_labels.join(' / ') : '';
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-5 ${colorClass}`}>
      <span className="font-semibold">本地预审：{label}</span>
      {typeof value.risk_score === 'number' ? <span> · 风险 {value.risk_score}</span> : null}
      {tags ? <span> · {tags}</span> : null}
      {value.summary ? <p className="mt-1">{value.summary}</p> : null}
    </div>
  );
}

function PlatformOverview() {
  const navigate = useNavigate();
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

      <section className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900">超管待办事项</h3>
            <p className="mt-1 text-xs text-gray-500">按运营优先级聚合需要超管关注的事项。</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {(summary?.todoItems || []).reduce((sum, item) => sum + item.count, 0)} 项
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {(summary?.todoItems || []).map(group => (
            <article key={group.key} className={`rounded-xl border p-3 ${group.tone === 'high' ? 'border-red-100 bg-red-50' : group.tone === 'medium' ? 'border-amber-100 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{group.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{group.count > 0 ? `当前 ${group.count} 项待处理` : '暂无待处理'}</p>
                </div>
                <button type="button" onClick={() => navigate(group.path)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">去处理</button>
              </div>
              <div className="mt-3 space-y-2">
                {group.items.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{item.title || '未命名事项'}</p>
                      <p className="mt-0.5 truncate text-gray-400">{item.store || '未知来源'}</p>
                    </div>
                    <span className="shrink-0 text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : ''}</span>
                  </div>
                ))}
                {group.items.length === 0 && <p className="rounded-lg bg-white/70 px-3 py-4 text-center text-xs text-gray-400">暂时没有需要处理的事项</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

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
    const accountLabel = user.email || user.phone || user.display_name || '这个账号';
    const confirmed = window.confirm(`确定要为 ${accountLabel} 生成临时登录密码吗？\n\n这会覆盖该账号原密码。请只在账号本人无法登录时使用，并提醒对方登录后立刻修改密码。`);
    if (!confirmed) return;
    const result = await post<{ tempPassword: string }>(`/platform/admin-users/${user.id}/reset-password`, {});
    if (result.success && result.data?.tempPassword) {
      setTempPassword(result.data.tempPassword);
      setMessage('临时登录密码已生成，只在这里显示一次');
      void loadUsers();
    } else {
      setMessage(result.error || '生成失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">后台账号管理</h2>
            <p className="text-sm text-gray-500 mt-1">查看店家后台账号，必要时停用账号或生成一次性临时登录密码。</p>
          </div>
          <button onClick={loadUsers} disabled={loading} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50">
            {loading ? '刷新中' : '刷新'}
          </button>
        </div>
        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
        {tempPassword && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700">临时登录密码</p>
            <p className="mt-1 break-all font-mono text-sm text-amber-900">{tempPassword}</p>
            <p className="mt-2 text-xs text-amber-700">只在账号本人无法登录时发给对方，并要求登录后立刻修改。</p>
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
                      <button onClick={() => resetPassword(user)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">生成临时登录密码</button>
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
  const { get, post, put, loading } = useApi();
  const [templates, setTemplates] = useState<ScriptTemplateRow[]>([]);
  const [message, setMessage] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplateRow | null>(null);

  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();
  const visibleTemplates = normalizedTemplateSearch
    ? templates.filter(template => {
        const searchText = [
          template.name,
          template.store?.name || '',
          template.store?.city || '',
          template.created_by || '',
          template.review_status || '',
          ...(template.player_roles || []).map(role => role.role_name),
          ...(template.actor_roles || []).map(role => role.role_name),
        ].join(' ').toLowerCase();
        return searchText.includes(normalizedTemplateSearch);
      })
    : templates;

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

  const reviewTemplate = async (template: ScriptTemplateRow, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? window.prompt('填写驳回原因，店家后续可按原因重新提交：', '') || '' : '';
    if (action === 'reject' && !reason.trim()) return;
    const result = await put(`/platform/script-templates/${template.id}/review`, { action, reason });
    if (result.success) {
      setMessage(action === 'approve' ? `已通过《${template.name}》` : `已驳回《${template.name}》`);
      setSelectedTemplate(null);
      void loadTemplates();
    } else {
      setMessage(result.error || '审核失败');
    }
  };

  const statusText: Record<string, string> = { pending: '待审核', approved: '已入主库', rejected: '已驳回' };
  const statusClass: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-600',
    rejected: 'bg-red-50 text-red-600',
  };
  const playerSummary = (template: ScriptTemplateRow) => {
    const players = Number(template.player_count || template.player_roles?.length || 0);
    const candidates = Number(template.player_roles?.length || 0);
    const rule = template.player_selection_rule || (players && candidates > players ? `${candidates}选${players}` : '');
    return { players, candidates, rule };
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">公共剧本模板中心</h2>
          <p className="text-sm text-gray-500 mt-1">店家新建剧本后会自动生成主库候选；超管审核通过后，其他店家才可从公共模板库一键导入。</p>
          {message && <p className={`mt-3 text-sm ${message.includes('失败') ? 'text-red-600' : 'text-emerald-600'}`}>{message}</p>}
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

      <div className="bg-white rounded-lg shadow p-4">
        <label className="sr-only" htmlFor="platform-template-search">搜索公共剧本模板</label>
        <input
          id="platform-template-search"
          type="search"
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
          placeholder="搜索剧本名 / 角色名 / 店家 / 创建者 / 审核状态"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleTemplates.map(template => {
          const summary = playerSummary(template);
          return (
          <article key={template.id} className="bg-white rounded-lg shadow p-5 border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900">{template.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{template.store?.name || '未知来源'} · {template.created_by || '未知创建者'} · 已导入 {template.usage_count || 0} 次</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClass[template.review_status || 'pending'] || 'bg-gray-100 text-gray-500'}`}>
                {statusText[template.review_status || 'pending'] || template.review_status || '待审核'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-gray-500">
              <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{template.duration_minutes || 0}</p><p>分钟</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{summary.players}</p><p>开本人数</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{summary.candidates}</p><p>候选玩家</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{template.boards?.length || 0}</p><p>演绎板子</p></div>
            </div>
            {summary.rule && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">开本规则：{summary.rule}</p>}
            {template.reject_reason && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">驳回原因：{template.reject_reason}</p>
            )}
            <p className="mt-4 text-xs text-gray-400">创建：{template.created_at ? new Date(template.created_at).toLocaleString('zh-CN') : ''}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setSelectedTemplate(template)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                查看详情
              </button>
              <button onClick={() => reviewTemplate(template, 'approve')} disabled={template.review_status === 'approved'} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-40">
                通过入主库
              </button>
              <button onClick={() => reviewTemplate(template, 'reject')} disabled={template.review_status === 'rejected'} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
                驳回
              </button>
            </div>
          </article>
          );
        })}
        {templates.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 bg-white rounded-lg shadow p-10 text-center text-gray-400">暂无公共剧本模板</div>
        )}
        {templates.length > 0 && visibleTemplates.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 bg-white rounded-lg shadow p-10 text-center text-gray-400">没有匹配的公共剧本模板</div>
        )}
      </div>

      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedTemplate.store?.name || '未知来源'} · {selectedTemplate.created_by || '未知创建者'} · 已导入 {selectedTemplate.usage_count || 0} 次
                </p>
              </div>
              <button onClick={() => setSelectedTemplate(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                关闭
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">审核状态</p>
                  <p className="mt-1 font-semibold text-gray-900">{statusText[selectedTemplate.review_status || 'pending'] || selectedTemplate.review_status || '待审核'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">时长</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedTemplate.min_duration_hours || selectedTemplate.duration_minutes ? `${selectedTemplate.min_duration_hours || Math.round((selectedTemplate.duration_minutes || 0) / 60)}~${selectedTemplate.max_duration_hours || Math.round((selectedTemplate.duration_minutes || 0) / 60)}小时` : '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">开本人数</p>
                  <p className="mt-1 font-semibold text-gray-900">{playerSummary(selectedTemplate).players}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">候选玩家</p>
                  <p className="mt-1 font-semibold text-gray-900">{playerSummary(selectedTemplate).candidates}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">演绎板子</p>
                  <p className="mt-1 font-semibold text-gray-900">{selectedTemplate.boards?.length || 0}</p>
                </div>
              </div>

              {(selectedTemplate.player_selection_rule || playerSummary(selectedTemplate).rule) && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  开本规则：{selectedTemplate.player_selection_rule || playerSummary(selectedTemplate).rule}
                </div>
              )}

              {selectedTemplate.reject_reason && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  驳回原因：{selectedTemplate.reject_reason}
                </div>
              )}

              <section>
                <h4 className="text-sm font-bold text-gray-900">候选玩家角色</h4>
                {selectedTemplate.player_roles?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTemplate.player_roles.map((role, index) => (
                      <span key={`${role.role_name}-${index}`} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm text-blue-700">
                        {role.role_name}{role.gender ? ` · ${role.gender}` : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">暂无玩家角色</p>
                )}
              </section>

              <section>
                <h4 className="text-sm font-bold text-gray-900">演绎角色库</h4>
                {selectedTemplate.actor_roles?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTemplate.actor_roles.map((role, index) => (
                      <span key={`${role.role_name}-${index}`} className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-sm text-purple-700">
                        {role.role_name}{role.gender ? ` · ${role.gender}` : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">暂无卡司角色</p>
                )}
              </section>

              <section>
                <h4 className="text-sm font-bold text-gray-900">演绎板子</h4>
                {selectedTemplate.boards?.length ? (
                  <div className="mt-2 space-y-2">
                    {selectedTemplate.boards.map((board, index) => (
                      <div key={board.id || index} className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-purple-900">{board.name || (index === 0 ? '标准版' : `板子${index + 1}`)}{board.is_default ? ' · 标准' : ''}</p>
                          <p className="text-xs text-purple-700">开本{board.player_count || selectedTemplate.player_count || '-'}人 · {board.roles?.length || 0} 个演绎角色</p>
                        </div>
                        {board.notes && <p className="mt-1 text-xs text-purple-700">{board.notes}</p>}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(board.roles || []).map(role => (
                            <span key={role.role_name} className="rounded-full bg-white px-2 py-1 text-xs text-purple-700">
                              {role.role_name}{role.gender && role.gender !== '未指定' ? `(${role.gender})` : ''}
                            </span>
                          ))}
                        </div>
                        {(board.player_roles || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(board.player_roles || []).map(role => (
                              <span key={`player-${role.role_name}`} className="rounded-full bg-white px-2 py-1 text-xs text-blue-700">
                                玩家：{role.role_name}{role.gender && role.gender !== '未指定' ? `(${role.gender})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">暂无板子配置</p>
                )}
              </section>

              <div className="grid grid-cols-1 gap-3 text-sm text-gray-500 md:grid-cols-2">
                <p>创建时间：{selectedTemplate.created_at ? new Date(selectedTemplate.created_at).toLocaleString('zh-CN') : '-'}</p>
                <p>审核时间：{selectedTemplate.reviewed_at ? new Date(selectedTemplate.reviewed_at).toLocaleString('zh-CN') : '-'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button onClick={() => reviewTemplate(selectedTemplate, 'approve')} disabled={selectedTemplate.review_status === 'approved'} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-40">
                通过入主库
              </button>
              <button onClick={() => reviewTemplate(selectedTemplate, 'reject')} disabled={selectedTemplate.review_status === 'rejected'} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
                驳回
              </button>
            </div>
          </div>
        </div>
      )}
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
          <p className="text-sm text-gray-500 mt-1">记录超管进入店家视角、启停账号、生成临时登录密码、新建店家等关键动作。</p>
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

function StoreOperationLogsPanel() {
  const { get, loading } = useApi();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [message, setMessage] = useState('');

  const loadLogs = async () => {
    const result = await get<AuditLogRow[]>('/operation-logs');
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
          <h2 className="text-xl font-bold text-gray-900">店内操作日志</h2>
          <p className="text-sm text-gray-500 mt-1">记录排期、定金、结算、开本、收尾、指定卡司等关键操作，便于试用期追溯问题。</p>
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

function FeedbackPanel() {
  const { get, post, loading } = useApi();
  const [items, setItems] = useState<FeedbackMessageRow[]>([]);
  const [form, setForm] = useState({ category: 'suggestion', title: '', content: '' });
  const [message, setMessage] = useState('');

  const loadFeedback = async () => {
    const result = await get<FeedbackMessageRow[]>('/feedback');
    if (result.success && result.data) setItems(result.data);
    else setMessage(result.error || '反馈记录加载失败');
  };

  useEffect(() => {
    void loadFeedback();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const result = await post<FeedbackMessageRow>('/feedback', form);
    if (!result.success) {
      setMessage(result.error || '提交失败，请稍后再试');
      return;
    }
    setForm({ category: 'suggestion', title: '', content: '' });
    setMessage(['complaint', 'report', 'illegal_content', 'security', 'privacy'].includes(form.category) ? '已提交，平台会按安全工单优先处理并保留处置记录。' : '已提交，平台会在站内信里回复你。');
    await loadFeedback();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900">建议反馈</h2>
        <p className="mt-1 text-sm text-gray-500">遇到问题、想提建议，直接发给平台。处理结果会显示在下面。</p>
        <form onSubmit={submit} className="mt-5 grid gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="suggestion">建议</option>
              <option value="bug">问题</option>
              <option value="question">咨询</option>
              <option value="other">其他</option>
            </select>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="一句话标题" className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </div>
          <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="请描述具体建议或问题，越具体越好。" className="h-32 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <div className="flex items-center justify-between gap-3">
            {message && <p className="text-sm text-sky-700">{message}</p>}
            <button disabled={loading} className="ml-auto rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">提交反馈</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold text-gray-900">我的反馈记录</h3>
        <div className="mt-4 space-y-3">
          {items.length === 0 ? <p className="text-sm text-gray-400">暂无反馈记录</p> : items.map(item => (
            <div key={item.id} className="rounded-lg border border-gray-100 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{feedbackCategoryText[item.category] || item.category}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{feedbackStatusText[item.status] || item.status}</span>
                <span className="text-xs text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}</span>
              </div>
              <p className="mt-2 font-semibold text-gray-900">{item.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{item.content}</p>
              {item.reply && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">平台回复：{item.reply}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-amber-100 p-6 shadow">
        <h3 className="font-bold text-gray-900">投诉举报 / 安全事件</h3>
        <p className="mt-1 text-sm text-gray-500">违法信息、隐私泄露、账号安全、店家纠纷等放在这里提交。平台会记录账号、时间、IP、对象信息和处理结果，用于巡查、应急处置和依法协助。</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['complaint', '投诉申诉'],
            ['report', '举报'],
            ['illegal_content', '违法信息'],
            ['security', '账号/安全事件'],
            ['privacy', '隐私/个人信息'],
          ].map(([category, label]) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setForm({ category, title: '', content: '' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-6 text-amber-800">
          互联网不是法外之地。投诉举报应基于事实，不得捏造、恶意攻击或泄露无关个人信息；平台会对违法违规、侵权、隐私泄露、账号风险等内容进行巡查、下架、限制账号或配合主管机关处理。
        </p>
      </div>
    </div>
  );
}

function FeedbackInboxPanel() {
  const { get, put, loading } = useApi();
  const [items, setItems] = useState<FeedbackMessageRow[]>([]);
  const [message, setMessage] = useState('');
  const [savedId, setSavedId] = useState('');
  const [savingId, setSavingId] = useState('');
  const [editing, setEditing] = useState<Record<string, { status: string; reply: string }>>({});

  const loadFeedback = async () => {
    const result = await get<FeedbackMessageRow[]>('/platform/feedback');
    if (result.success && result.data) {
      setItems(result.data);
      setMessage('');
      const next: Record<string, { status: string; reply: string }> = {};
      result.data.forEach(item => { next[item.id] = { status: item.status || 'new', reply: item.reply || '' }; });
      setEditing(next);
    } else {
      setMessage(result.error || '站内信加载失败');
    }
  };

  useEffect(() => {
    void loadFeedback();
  }, []);

  const save = async (item: FeedbackMessageRow) => {
    const draft = editing[item.id] || { status: item.status, reply: item.reply || '' };
    const hasReply = !!draft.reply.trim();
    const status = hasReply && ['new', 'processing'].includes(draft.status) ? 'resolved' : draft.status;
    setSavingId(item.id);
    const result = await put<FeedbackMessageRow>(`/platform/feedback/${item.id}`, { ...draft, status });
    setSavingId('');
    if (!result.success) {
      setMessage(result.error || '保存失败');
      return;
    }
    const now = new Date().toISOString();
    const updatedItem = result.data || { ...item, status, reply: draft.reply, replied_at: hasReply ? now : item.replied_at };
    setItems(current => current.map(row => row.id === item.id ? { ...row, ...updatedItem, store: row.store, admin: row.admin } : row));
    setEditing(current => ({ ...current, [item.id]: { status: updatedItem.status || status, reply: updatedItem.reply || draft.reply } }));
    setSavedId(item.id);
    setMessage(hasReply ? '已回复店家，店家可在建议反馈页查看。' : '处理状态已保存。');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">投诉举报 / 站内工单</h2>
          <p className="mt-1 text-sm text-gray-500">查看店家提交的违法信息、投诉举报、安全事件、隐私请求和产品建议，并在这里回复处理结果。</p>
          {message && <p className={`mt-3 text-sm ${message.includes('失败') ? 'text-red-600' : 'text-emerald-600'}`}>{message}</p>}
        </div>
        <button onClick={loadFeedback} disabled={loading} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">刷新</button>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400">暂无站内信</div> : items.map(item => {
          const draft = editing[item.id] || { status: item.status, reply: item.reply || '' };
          return (
            <div key={item.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{feedbackCategoryText[item.category] || item.category}</span>
                    {item.priority && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.priority === 'urgent' ? 'bg-red-50 text-red-700' : item.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{feedbackPriorityText[item.priority] || item.priority}</span>}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{feedbackStatusText[item.status] || item.status}</span>
                    <span className="text-xs text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-gray-900">{item.title}</p>
                  <p className="mt-1 text-sm text-gray-500">{item.store?.name || '未知店家'}{item.store?.city ? ` · ${item.store.city}` : ''} · {item.admin?.display_name || item.admin?.email || '未知账号'}</p>
                </div>
                <select value={draft.status} onChange={e => setEditing({ ...editing, [item.id]: { ...draft, status: e.target.value } })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="new">新反馈</option>
                  <option value="processing">处理中</option>
                  <option value="resolved">已处理</option>
                  <option value="closed">已关闭</option>
                </select>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{item.content}</p>
              <ModerationPrecheckPill value={item.moderation_precheck} />
              {item.reply && (
                <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <p className="font-medium">已回复店家</p>
                  <p className="mt-1 whitespace-pre-wrap">{item.reply}</p>
                  {item.replied_at && <p className="mt-1 text-xs text-emerald-600">回复时间：{new Date(item.replied_at).toLocaleString('zh-CN')}</p>}
                </div>
              )}
              <textarea value={draft.reply} onChange={e => setEditing({ ...editing, [item.id]: { ...draft, reply: e.target.value } })} placeholder="输入给店家的回复，保存后店家会在建议反馈页看到。" className="mt-3 h-20 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400">{savedId === item.id ? '刚刚已保存' : draft.reply.trim() ? '将作为平台回复展示给店家' : '未填写回复时仅保存处理状态'}</span>
                <button onClick={() => save(item)} disabled={loading || savingId === item.id} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">{savingId === item.id ? '保存中...' : draft.reply.trim() ? '回复并保存' : '保存状态'}</button>
              </div>
            </div>
          );
        })}
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
    localStorage.setItem('admin_auth_token', token);
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
