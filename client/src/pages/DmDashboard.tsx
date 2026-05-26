import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ScheduleItem {
  checkinId: string;
  role: string | null;
  checkedAt: string | null;
  schedule: {
    id: string;
    scriptName: string;
    roomName: string | null;
    startTime: string;
    endTime: string;
    status: string;
  } | null;
}

interface PlayerInfo {
  id: string;
  displayName: string;
  phone: string;
  totalGames: number;
}

const API_BASE = '/api';

export default function DmDashboard() {
  const navigate = useNavigate();
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginMode, setLoginMode] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('player_info');
    const token = localStorage.getItem('auth_token');
    if (stored && token) {
      // 检查 token 是否过期
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('player_info');
          setLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('player_info');
        setLoading(false);
        return;
      }
      setPlayerInfo(JSON.parse(stored));
      loadSchedules();
    } else {
      setLoading(false);
    }
  }, []);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/player/schedules`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('player_info');
        setPlayerInfo(null);
        setSchedules([]);
        return;
      }
      const data = await res.json();
      if (data.success) setSchedules(data.data || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/player/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone.trim(), displayName: loginName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('auth_token', data.data.token);
        localStorage.setItem('player_info', JSON.stringify(data.data.player));
        setPlayerInfo(data.data.player);
        loadSchedules();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('player_info');
    setPlayerInfo(null);
    setSchedules([]);
  };

  const now = new Date().toISOString();
  const todaySchedules = schedules.filter(
    (s) => s.schedule && s.schedule.startTime.startsWith(now.substring(0, 10))
  );
  const upcomingSchedules = schedules.filter(
    (s) => s.schedule && s.schedule.startTime > now && s.schedule.status !== 'cancelled'
  );

  // 登录界面
  if (!playerInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white">
        <header className="max-w-md mx-auto px-6 py-6">
          <button onClick={() => navigate('/store')} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← 返回角色选择
          </button>
        </header>
        <div className="max-w-md mx-auto px-6 pt-12">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎭</div>
            <h1 className="text-2xl font-bold">卡司/DM 工作台</h1>
            <p className="text-gray-400 text-sm mt-1">输入手机号登录查看排班</p>
          </div>
          <form onSubmit={handleLogin} className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">手机号</label>
              <input
                type="tel" value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                placeholder="请输入手机号" required
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">昵称</label>
              <input
                type="text" value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                placeholder="您的称呼" required
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-medium hover:opacity-90 transition-opacity">
              {loading ? '登录中...' : '进入卡司工作台'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶栏 */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">🎭 卡司工作台</h1>
              <p className="text-indigo-200 text-sm mt-0.5">{playerInfo.displayName} · {playerInfo.phone}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-indigo-200 text-sm">共 {playerInfo.totalGames || schedules.length} 场</span>
              <button onClick={handleLogout} className="text-sm text-indigo-200 hover:text-white">退出</button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* 今日排班 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📋 今日排班</h2>
          {todaySchedules.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
              今天没有排班，好好休息吧
            </div>
          ) : (
            <div className="space-y-3">
              {todaySchedules.map((item) => (
                <div key={item.checkinId} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{item.schedule?.scriptName || '未知剧本'}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.schedule?.status === 'ongoing' ? 'bg-green-100 text-green-700' :
                      item.schedule?.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {item.schedule?.status === 'ongoing' ? '进行中' :
                       item.schedule?.status === 'scheduled' ? '已排班' : item.schedule?.status}
                    </span>
                  </div>
                  {item.schedule && (
                    <div className="text-sm text-gray-500 space-y-1">
                      {item.schedule.roomName && <p>📍 {item.schedule.roomName}</p>}
                      <p>🕐 {new Date(item.schedule.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        ~ {new Date(item.schedule.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                      {item.role && <p>🎭 角色：{item.role}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 即将开始的排班 */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4">📅 即将开始的排班</h2>
          {upcomingSchedules.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
              暂无其他排班安排
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSchedules.map((item) => (
                <div key={item.checkinId} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <h3 className="font-semibold mb-1">{item.schedule?.scriptName || '未知剧本'}</h3>
                  {item.schedule && (
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>📅 {new Date(item.schedule.startTime).toLocaleDateString('zh-CN')}</p>
                      <p>🕐 {new Date(item.schedule.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        ~ {new Date(item.schedule.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
