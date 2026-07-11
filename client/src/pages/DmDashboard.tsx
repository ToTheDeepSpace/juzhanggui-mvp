import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = '/api';
const TOKEN_KEY = 'dm_auth_token';
const ACTOR_KEY = 'dm_actor_info';

interface AuthConfig {
  smsEnabled: boolean;
  smsRequired: boolean;
  wechatEnabled: boolean;
  legacyPhoneLoginEnabled: boolean;
}

interface DmActor {
  id: string;
  name: string;
  phone: string;
  totalSessions: number;
  totalScripts: number;
  level: string;
}

interface DmSchedule {
  assignmentId: string;
  scheduleId: string;
  scriptId: string | null;
  scriptName: string;
  roomName: string | null;
  roleName: string;
  startAt: string;
  endAt: string;
  status: string;
  statusText: string;
  customerName: string | null;
  playerCount: number;
  note: string | null;
  execution?: {
    confirmedAt?: string | null;
    arrivedAt?: string | null;
    prepCheckedAt?: string | null;
    playersReadyAt?: string | null;
    startedAt?: string | null;
    heartbuildDoneAt?: string | null;
    currentAct?: number;
    totalActs?: number;
    endedAt?: string | null;
    checkoutConfirmedAt?: string | null;
    propsChecked?: boolean;
    costumesChecked?: boolean;
    scriptCardsChecked?: boolean;
    reviewRequested?: boolean;
    debriefDone?: boolean;
    leftAt?: string | null;
  };
}

interface DmTask {
  id: string;
  title: string;
  dueLabel: string;
  priority: 'high' | 'normal' | 'low';
  status: string;
  source: string;
}

interface SalaryEstimate {
  month: string;
  completedSessions: number;
  upcomingSessions: number;
  estimatedMin: number;
  estimatedMax: number;
  rules: string[];
}

interface DmRating {
  level: string;
  score: number;
  stabilityScore: number;
  feedbackScore: number;
  experienceScore: number;
  avgRating: number | null;
  feedbackCount: number;
}

interface ScriptStat {
  scriptId: string | null;
  scriptName: string;
  count: number;
  lastOpenedAt: string;
  roles: string[];
}

interface DmSkill {
  id: string;
  scriptId: string;
  scriptName: string;
  roleName: string;
  roleType: string;
  proficiency: number;
}

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
}

interface ExperienceNote {
  id: string;
  script_name: string;
  title: string;
  content: string;
  tags: string[];
  visibility: 'internal' | 'private';
  created_at: string;
}

interface DmDashboardData {
  actor: DmActor;
  schedules: DmSchedule[];
  tasks: DmTask[];
  salaryEstimate: SalaryEstimate;
  rating: DmRating;
  scriptStats: ScriptStat[];
  skills: DmSkill[];
  leaveRequests: LeaveRequest[];
  experienceNotes: ExperienceNote[];
  meta?: {
    leaveTableReady?: boolean;
    experienceTableReady?: boolean;
  };
}

type TabKey = 'overview' | 'schedule' | 'salary' | 'history' | 'leave' | 'experience';

const DEFAULT_AUTH_CONFIG: AuthConfig = {
  smsEnabled: false,
  smsRequired: false,
  wechatEnabled: false,
  legacyPhoneLoginEnabled: true,
};

const statusClass: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-blue-100 text-blue-700',
  locked: 'bg-indigo-100 text-indigo-700',
  ongoing: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  bombed: 'bg-red-100 text-red-700',
};

const leaveStatusText: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已取消',
};

function formatDateTime(value: string) {
  if (!value) return '待定';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: string) {
  if (!value) return '待定';
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function moneyRange(salary: SalaryEstimate | undefined) {
  if (!salary) return '¥0-0';
  return `¥${salary.estimatedMin}-${salary.estimatedMax}`;
}
function roleTypeText(value: string) {
  return ({
    dm: 'DM',
    actor: '演绎',
    field_control: '场控',
    npc: 'NPC',
    assistant: '助演',
    player: '玩家角色',
  } as Record<string, string>)[value] || value || '演绎';
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || '请求失败');
  return data.data as T;
}

export default function DmDashboard() {
  const navigate = useNavigate();
  const [authConfig, setAuthConfig] = useState<AuthConfig>(DEFAULT_AUTH_CONFIG);
  const [actor, setActor] = useState<DmActor | null>(null);
  const [dashboard, setDashboard] = useState<DmDashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [message, setMessage] = useState('');
  const [leaveForm, setLeaveForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    leaveType: '事假',
    reason: '',
  });
  const [experienceForm, setExperienceForm] = useState({
    scriptName: '',
    title: '',
    tags: '',
    content: '',
    visibility: 'internal',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<DmDashboardData>('/dm/dashboard');
      setDashboard(data);
      setActor(data.actor);
      localStorage.setItem(ACTOR_KEY, JSON.stringify(data.actor));
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ACTOR_KEY);
      setActor(null);
      setDashboard(null);
      setMessage(error instanceof Error ? error.message : '登录已失效，请重新登录');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(`${API_BASE}/dm/auth/config`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) setAuthConfig({ ...DEFAULT_AUTH_CONFIG, ...data.data });
      })
      .catch(() => setAuthConfig(DEFAULT_AUTH_CONFIG));

    const token = getToken();
    const storedActor = localStorage.getItem(ACTOR_KEY);
    if (!token || !storedActor) {
      setLoading(false);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) throw new Error('expired');
      setActor(JSON.parse(storedActor));
      loadDashboard();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ACTOR_KEY);
      setLoading(false);
    }
  }, []);

  const scheduleGroups = useMemo(() => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const schedules = dashboard?.schedules || [];
    return {
      today: schedules.filter((item) => item.startAt.startsWith(today) && !['cancelled', 'bombed'].includes(item.status)),
      upcoming: schedules.filter((item) => new Date(item.startAt).getTime() >= now && !item.startAt.startsWith(today) && !['cancelled', 'bombed'].includes(item.status)),
      history: schedules.filter((item) => new Date(item.startAt).getTime() < now || item.status === 'completed').slice().reverse(),
    };
  }, [dashboard?.schedules]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (authConfig.smsRequired && !loginCode.trim()) {
      setMessage('请填写短信验证码');
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; actor: DmActor }>('/dm/login', {
        method: 'POST',
        body: JSON.stringify({ phone: loginPhone.trim(), code: loginCode.trim() || undefined }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(ACTOR_KEY, JSON.stringify(data.actor));
      setActor(data.actor);
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败');
      setLoading(false);
    }
  };

  const sendLoginCode = async () => {
    setMessage('');
    if (!authConfig.smsEnabled) {
      setMessage('短信验证暂未启用，当前可用已登记手机号登录');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(loginPhone.replace(/\D/g, ''))) {
      setMessage('请填写正确的手机号');
      return;
    }
    setCodeSending(true);
    try {
      await apiRequest('/dm/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: loginPhone.trim() }),
      });
      setMessage('验证码已发送，请查看短信');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验证码发送失败');
    } finally {
      setCodeSending(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTOR_KEY);
    setActor(null);
    setDashboard(null);
    setActiveTab('overview');
  };

  const submitLeave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      await apiRequest('/dm/leave-requests', {
        method: 'POST',
        body: JSON.stringify(leaveForm),
      });
      setMessage('请假申请已提交，等待店家确认');
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const submitExperience = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      await apiRequest('/dm/experience-notes', {
        method: 'POST',
        body: JSON.stringify({
          ...experienceForm,
          tags: experienceForm.tags.split(/[，,\s]+/).map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      setExperienceForm({ scriptName: '', title: '', tags: '', content: '', visibility: 'internal' });
      setMessage('经验记录已保存');
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };
  const runScheduleAction = async (schedule: DmSchedule, action: string, payload: Record<string, unknown> = {}) => {
    setMessage('');
    try {
      await apiRequest(`/dm/schedules/${schedule.scheduleId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, ...payload }),
      });
      await loadDashboard();
      setMessage('排班进度已更新');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    }
  };
  const updateAct = async (schedule: DmSchedule) => {
    const current = window.prompt('现在进行到第几幕？', String(schedule.execution?.currentAct || 1));
    if (!current) return;
    const total = window.prompt('这个本一共几幕？', String(schedule.execution?.totalActs || current));
    if (!total) return;
    await runScheduleAction(schedule, 'act_update', { currentAct: Number(current), totalActs: Number(total) });
  };

  if (!actor) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="max-w-5xl mx-auto px-5 py-5 flex items-center justify-between">
          <button onClick={() => navigate('/store')} className="text-sm text-slate-300 hover:text-white">
            返回店家入口
          </button>
          <span className="text-xs text-slate-500">剧司辰 · DM 内部工作台</span>
        </header>

        <main className="max-w-md mx-auto px-5 pt-10 pb-16">
          <div className="mb-8">
            <p className="text-sm text-indigo-300 mb-2">店内卡司专用</p>
            <h1 className="text-3xl font-bold mb-3">DM 工作台</h1>
            <p className="text-sm text-slate-400 leading-6">
              使用店家在卡司管理里登记的手机号登录。公开主页、认证身份和社区资料仍在剧幕录，这里只处理店内工作流。
            </p>
          </div>

          <form onSubmit={handleLogin} className="rounded-lg border border-white/10 bg-white/[0.04] p-5 space-y-4">
            {message && (
              <div className={`rounded-md border px-3 py-2 text-sm ${message.includes('已发送') ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'}`}>
                {message}
              </div>
            )}
            <div>
              <label className="text-sm text-slate-300 mb-1 block">手机号</label>
              <input
                type="tel"
                value={loginPhone}
                onChange={(event) => setLoginPhone(event.target.value)}
                className="w-full rounded-md border border-white/15 bg-white/10 px-3 py-3 text-white outline-none focus:border-indigo-400"
                placeholder="请输入已登记手机号"
                required
              />
            </div>

            {authConfig.smsEnabled && (
              <div>
                <label className="text-sm text-slate-300 mb-1 block">
                  短信验证码{authConfig.smsRequired ? '' : '（可选）'}
                </label>
                <div className="grid grid-cols-[1fr_96px] gap-2">
                  <input
                    value={loginCode}
                    onChange={(event) => setLoginCode(event.target.value)}
                    className="w-full rounded-md border border-white/15 bg-white/10 px-3 py-3 text-white outline-none focus:border-indigo-400"
                    placeholder="验证码"
                    required={authConfig.smsRequired}
                  />
                  <button
                    type="button"
                    onClick={sendLoginCode}
                    disabled={codeSending}
                    className="rounded-md border border-white/15 bg-white/10 text-sm text-indigo-100 hover:bg-white/15 disabled:opacity-50"
                  >
                    {codeSending ? '发送中' : '获取'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? '登录中...' : '进入工作台'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  const salary = dashboard?.salaryEstimate;
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: '总览' },
    { key: 'schedule', label: '排班' },
    { key: 'salary', label: '工资' },
    { key: 'history', label: '履历' },
    { key: 'leave', label: '请假' },
    { key: 'experience', label: '经验' },
  ];
  const fieldClass = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-indigo-300 mb-1">剧司辰 · DM 内部工作台</p>
              <h1 className="text-2xl font-bold">{dashboard?.actor.name || actor.name}</h1>
              <p className="text-sm text-slate-400 mt-1">
                {dashboard?.actor.phone || actor.phone || '手机号未公开'} · {dashboard?.actor.level || actor.level || '待积累'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/store')} className="rounded-md border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                店家入口
              </button>
              <button onClick={handleLogout} className="rounded-md border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {message && (
          <div className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {message}
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="累计开本" value={`${dashboard?.actor.totalSessions ?? actor.totalSessions ?? 0}`} sub="按已完成和已开场次统计" />
          <MetricCard label="开过剧本" value={`${dashboard?.actor.totalScripts ?? actor.totalScripts ?? 0}`} sub="不同剧本数" />
          <MetricCard label="本月预估" value={moneyRange(salary)} sub={`${salary?.completedSessions || 0} 场已完成 · ${salary?.upcomingSessions || 0} 场待开`} />
          <MetricCard label="内部评级" value={dashboard?.rating.level || actor.level || '待积累'} sub={`${dashboard?.rating.score || 0} 分`} />
        </div>

        <div className="mb-5 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-4 py-2 text-sm font-medium ${activeTab === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !dashboard ? (
          <div className="rounded-lg bg-white p-10 text-center text-slate-500">加载中...</div>
        ) : (
          <>
            {activeTab === 'overview' && dashboard && (
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <Panel title="今日和近期任务">
                  {dashboard.tasks.length ? (
                    <div className="space-y-3">
                      {dashboard.tasks.map((task) => <TaskItem key={task.id} task={task} />)}
                    </div>
                  ) : (
                    <EmptyState text="目前没有待处理任务。" />
                  )}
                </Panel>

                <Panel title="内部评级构成">
                  <div className="space-y-3">
                    <ScoreRow label="玩家反馈" value={dashboard.rating.feedbackScore} />
                    <ScoreRow label="稳定出勤" value={dashboard.rating.stabilityScore} />
                    <ScoreRow label="经验积累" value={dashboard.rating.experienceScore} />
                    <p className="text-xs text-slate-500">
                      均分 {dashboard.rating.avgRating ?? '暂无'} · {dashboard.rating.feedbackCount} 条评价。评级用于店内参考，不对外展示。
                    </p>
                  </div>
                </Panel>

                <Panel title="今日排班">
                  <ScheduleList schedules={scheduleGroups.today} emptyText="今天没有排班。" onAction={runScheduleAction} onActUpdate={updateAct} />
                </Panel>

                <Panel title="最近经验">
                  {dashboard.experienceNotes.length ? (
                    <div className="space-y-3">
                      {dashboard.experienceNotes.slice(0, 3).map((note) => <ExperienceItem key={note.id} note={note} />)}
                    </div>
                  ) : (
                    <EmptyState text="还没有经验记录，可以先把某个本的控场心得写下来。" />
                  )}
                </Panel>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="space-y-5">
                <Panel title="今日排班">
                  <ScheduleList schedules={scheduleGroups.today} emptyText="今天没有排班。" onAction={runScheduleAction} onActUpdate={updateAct} />
                </Panel>
                <Panel title="未来排班">
                  <ScheduleList schedules={scheduleGroups.upcoming} emptyText="暂无未来排班。" onAction={runScheduleAction} onActUpdate={updateAct} />
                </Panel>
                <Panel title="历史排班">
                  <ScheduleList schedules={scheduleGroups.history.slice(0, 20)} emptyText="暂无历史排班。" onAction={runScheduleAction} onActUpdate={updateAct} />
                </Panel>
              </div>
            )}

            {activeTab === 'salary' && dashboard && (
              <Panel title={`${dashboard.salaryEstimate.month} 工资预估`}>
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard label="预估区间" value={moneyRange(dashboard.salaryEstimate)} sub="非最终工资条" light />
                  <MetricCard label="已完成场次" value={`${dashboard.salaryEstimate.completedSessions}`} sub="按当前月统计" light />
                  <MetricCard label="未来已排场次" value={`${dashboard.salaryEstimate.upcomingSessions}`} sub="按当前月统计" light />
                </div>
                <ul className="mt-5 space-y-2 text-sm text-slate-600">
                  {dashboard.salaryEstimate.rules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {activeTab === 'history' && dashboard && (
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <Panel title="开过什么本">
                  {dashboard.scriptStats.length ? (
                    <div className="space-y-3">
                      {dashboard.scriptStats.map((stat) => <ScriptStatItem key={stat.scriptId || stat.scriptName} stat={stat} />)}
                    </div>
                  ) : (
                    <EmptyState text="还没有可统计的开本履历。" />
                  )}
                </Panel>

                <Panel title="技能和角色熟练度">
                  {dashboard.skills.length ? (
                    <div className="space-y-3">
                      {dashboard.skills.map((skill) => (
                        <div key={skill.id} className="rounded-md border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{skill.scriptName}</p>
                      <p className="text-sm text-slate-500">{skill.roleName || '未标注角色'} · {roleTypeText(skill.roleType)}</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">熟练度 {skill.proficiency}/5</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="店家还没有维护你的技能和角色熟练度。" />
                  )}
                </Panel>
              </div>
            )}

            {activeTab === 'leave' && dashboard && (
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <Panel title="提交请假">
                  <form onSubmit={submitLeave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="开始日期">
                        <input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm({ ...leaveForm, startDate: event.target.value })} className={fieldClass} required />
                      </Field>
                      <Field label="结束日期">
                        <input type="date" value={leaveForm.endDate} onChange={(event) => setLeaveForm({ ...leaveForm, endDate: event.target.value })} className={fieldClass} required />
                      </Field>
                    </div>
                    <Field label="请假类型">
                      <select value={leaveForm.leaveType} onChange={(event) => setLeaveForm({ ...leaveForm, leaveType: event.target.value })} className={fieldClass}>
                        <option>事假</option>
                        <option>病假</option>
                        <option>考试/工作冲突</option>
                        <option>临时不可用</option>
                      </select>
                    </Field>
                    <Field label="说明">
                      <textarea value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} className={`${fieldClass} min-h-28`} placeholder="写清楚不可排班的原因和需要店家注意的时间段" />
                    </Field>
                    <button disabled={submitting} className="w-full rounded-md bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                      {submitting ? '提交中...' : '提交请假申请'}
                    </button>
                  </form>
                </Panel>

                <Panel title="请假记录">
                  {dashboard.leaveRequests.length ? (
                    <div className="space-y-3">
                      {dashboard.leaveRequests.map((leave) => (
                        <div key={leave.id} className="rounded-md border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{leave.start_date} 至 {leave.end_date}</p>
                              <p className="text-sm text-slate-500">{leave.leave_type} · {leave.reason || '无说明'}</p>
                              {leave.review_note && <p className="mt-1 text-xs text-slate-500">审核备注：{leave.review_note}</p>}
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{leaveStatusText[leave.status] || leave.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="还没有请假记录。" />
                  )}
                </Panel>
              </div>
            )}

            {activeTab === 'experience' && dashboard && (
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <Panel title="新增经验记录">
                  <form onSubmit={submitExperience} className="space-y-4">
                    <Field label="关联剧本">
                      <input
                        list="dm-script-options"
                        value={experienceForm.scriptName}
                        onChange={(event) => setExperienceForm({ ...experienceForm, scriptName: event.target.value })}
                        className={fieldClass}
                        placeholder="选择或输入剧本名称"
                        required
                      />
                      <datalist id="dm-script-options">
                        {dashboard.scriptStats.map((stat) => <option key={stat.scriptId || stat.scriptName} value={stat.scriptName} />)}
                      </datalist>
                    </Field>
                    <Field label="标题">
                      <input value={experienceForm.title} onChange={(event) => setExperienceForm({ ...experienceForm, title: event.target.value })} className={fieldClass} placeholder="例如：二幕推进卡住时怎么救" required />
                    </Field>
                    <Field label="标签">
                      <input value={experienceForm.tags} onChange={(event) => setExperienceForm({ ...experienceForm, tags: event.target.value })} className={fieldClass} placeholder="控场, 复盘, 情绪, 破冰" />
                    </Field>
                    <Field label="内容">
                      <textarea value={experienceForm.content} onChange={(event) => setExperienceForm({ ...experienceForm, content: event.target.value })} className={`${fieldClass} min-h-36`} placeholder="记录这个本里可复用的处理方式、雷点、玩家反应和下次改进" required />
                    </Field>
                    <Field label="可见范围">
                      <select value={experienceForm.visibility} onChange={(event) => setExperienceForm({ ...experienceForm, visibility: event.target.value })} className={fieldClass}>
                        <option value="internal">店内可见</option>
                        <option value="private">仅自己可见</option>
                      </select>
                    </Field>
                    <button disabled={submitting} className="w-full rounded-md bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                      {submitting ? '保存中...' : '保存经验'}
                    </button>
                  </form>
                </Panel>

                <Panel title="经验沉淀">
                  {dashboard.experienceNotes.length ? (
                    <div className="space-y-3">
                      {dashboard.experienceNotes.map((note) => <ExperienceItem key={note.id} note={note} />)}
                    </div>
                  ) : (
                    <EmptyState text="还没有经验记录。" />
                  )}
                </Panel>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, sub, light = false }: { label: string; value: string; sub: string; light?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${light ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-4 text-base font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{text}</div>;
}

function TaskItem({ task }: { task: DmTask }) {
  const dotClass = task.priority === 'high' ? 'bg-red-500' : task.priority === 'low' ? 'bg-slate-400' : 'bg-indigo-500';
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{task.title}</p>
          <p className="text-sm text-slate-500">{task.source} · {task.dueLabel} · {task.status}</p>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function ScheduleList({
  schedules,
  emptyText,
  onAction,
  onActUpdate,
}: {
  schedules: DmSchedule[];
  emptyText: string;
  onAction?: (schedule: DmSchedule, action: string, payload?: Record<string, unknown>) => void;
  onActUpdate?: (schedule: DmSchedule) => void;
}) {
  if (!schedules.length) return <EmptyState text={emptyText} />;
  return (
    <div className="space-y-3">
      {schedules.map((schedule) => (
        <div key={schedule.assignmentId} className="rounded-md border border-slate-200 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">{schedule.scriptName}</p>
              <p className="text-sm text-slate-500">{formatDateTime(schedule.startAt)} - {formatDateTime(schedule.endAt)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {schedule.roomName || '房间待定'} · {schedule.roleName} · {schedule.playerCount || 0} 人
              </p>
              {schedule.note && <p className="mt-1 text-xs text-slate-500">{schedule.note}</p>}
              {schedule.execution?.currentAct ? (
                <p className="mt-1 text-xs text-indigo-600">幕次：第 {schedule.execution.currentAct} / {schedule.execution.totalActs || '?'} 幕</p>
              ) : null}
            </div>
            <span className={`w-fit rounded-full px-2 py-1 text-xs ${statusClass[schedule.status] || 'bg-slate-100 text-slate-600'}`}>
              {schedule.statusText}
            </span>
          </div>
          {onAction && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!schedule.execution?.confirmedAt && <DmActionButton onClick={() => onAction(schedule, 'confirm_assignment')}>确认排班</DmActionButton>}
              {!schedule.execution?.arrivedAt && <DmActionButton onClick={() => onAction(schedule, 'arrive_prepare')}>到场准备</DmActionButton>}
              {!schedule.execution?.playersReadyAt && <DmActionButton onClick={() => onAction(schedule, 'players_ready')}>玩家到齐</DmActionButton>}
              {!schedule.execution?.startedAt && <DmActionButton onClick={() => onAction(schedule, 'start_game')}>开本</DmActionButton>}
              {schedule.execution?.startedAt && !schedule.execution?.heartbuildDoneAt && <DmActionButton onClick={() => onAction(schedule, 'heartbuild_done')}>心建完成</DmActionButton>}
              {schedule.execution?.startedAt && !schedule.execution?.endedAt && <DmActionButton onClick={() => onActUpdate?.(schedule)}>记录幕次</DmActionButton>}
              {schedule.execution?.startedAt && !schedule.execution?.endedAt && <DmActionButton onClick={() => onAction(schedule, 'end_game')}>结束</DmActionButton>}
              {schedule.execution?.endedAt && !schedule.execution?.checkoutConfirmedAt && <DmActionButton onClick={() => onAction(schedule, 'checkout_confirm')}>确认结账</DmActionButton>}
              {schedule.execution?.endedAt && !schedule.execution?.leftAt && (
                <DmActionButton onClick={() => onAction(schedule, 'wrapup_confirm', {
                  propsChecked: true,
                  costumesChecked: true,
                  scriptCardsChecked: true,
                  reviewRequested: true,
                  debriefDone: true,
                })}>
                  收尾离场
                </DmActionButton>
              )}
              {schedule.execution?.leftAt && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已离场 {formatDateTime(schedule.execution.leftAt)}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DmActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
      {children}
    </button>
  );
}

function ScriptStatItem({ stat }: { stat: ScriptStat }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{stat.scriptName}</p>
          <p className="text-sm text-slate-500">最近一次：{formatDate(stat.lastOpenedAt)}</p>
          {stat.roles.length > 0 && <p className="mt-1 text-xs text-slate-500">开过角色：{stat.roles.join('、')}</p>}
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">{stat.count} 场</span>
      </div>
    </div>
  );
}

function ExperienceItem({ note }: { note: ExperienceNote }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{note.title}</p>
          <p className="text-sm text-slate-500">{note.script_name} · {formatDate(note.created_at)} · {note.visibility === 'private' ? '仅自己可见' : '店内可见'}</p>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.content}</p>
      {note.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
