import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = '/api';

interface ScheduleInfo {
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
    customerName: string | null;
    playerCount: number | null;
  } | null;
}

interface PlayerInfo {
  id: string;
  displayName: string;
  phone: string;
  totalGames: number;
}

export default function PlayerDashboard() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');

  useEffect(() => {
    // 读取玩家信息
    const stored = localStorage.getItem('player_info');
    if (stored) {
      setPlayerInfo(JSON.parse(stored));
    } else {
      // 如果没有 player_info，尝试从 token 解析或跳转登录
      navigate('/player/login');
      return;
    }

    // 加载排班
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/player/schedules`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data.success) {
        setSchedules(data.data || []);
      } else {
        setErrorMsg(data.error || '加载失败');
        if (res.status === 401) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('player_info');
          navigate('/player/login');
        }
      }
    } catch {
      setErrorMsg('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('player_info');
    navigate('/player/login');
  };

  const now = new Date().toISOString();
  const upcoming = schedules.filter(
    (s) => s.schedule && s.schedule.startTime >= now && s.schedule.status !== 'cancelled'
  );
  const history = schedules.filter(
    (s) => !s.schedule || s.schedule.startTime < now || s.schedule.status === 'cancelled'
  );

  const displaySchedules = tab === 'upcoming' ? upcoming : history;

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-700',
      ongoing: 'bg-green-100 text-green-700',
      completed: 'bg-gray-100 text-gray-600',
      cancelled: 'bg-red-100 text-red-600',
      pending: 'bg-yellow-100 text-yellow-700',
    };
    const labelMap: Record<string, string> = {
      scheduled: '已确认',
      ongoing: '进行中',
      completed: '已完成',
      cancelled: '已取消',
      pending: '待确认',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {labelMap[status] || status}
      </span>
    );
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部栏 */}
      <header className="bg-indigo-600 text-white">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">玩家中心</h1>
              {playerInfo && (
                <p className="text-indigo-200 text-sm mt-0.5">
                  {playerInfo.displayName} · {playerInfo.phone}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-indigo-200 text-sm">
                共 {playerInfo?.totalGames || schedules.length} 场
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-indigo-200 hover:text-white transition-colors"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab 切换 */}
      <div className="max-w-lg mx-auto px-4 mt-4">
        <div className="flex bg-white rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setTab('upcoming')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'upcoming' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            即将开始 ({upcoming.length})
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'history' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            历史记录 ({history.length})
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
            {errorMsg}
            <button onClick={loadSchedules} className="ml-2 underline">重试</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-400 mt-3 text-sm">加载中...</p>
          </div>
        ) : displaySchedules.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">
              {tab === 'upcoming' ? '📭' : '📂'}
            </div>
            <p className="text-gray-400">
              {tab === 'upcoming' ? '暂无即将开始的排班' : '暂无历史记录'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displaySchedules.map((item) => (
              <div key={item.checkinId} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-800">
                    {item.schedule?.scriptName || '未知剧本'}
                  </h3>
                  {item.schedule && getStatusBadge(item.schedule.status)}
                </div>

                <div className="space-y-1.5 text-sm text-gray-500">
                  {item.schedule?.roomName && (
                    <p>📍 {item.schedule.roomName}</p>
                  )}
                  <p>
                    🕐 {item.schedule ? formatDate(item.schedule.startTime) : ''}
                    {' '}{item.schedule ? formatTime(item.schedule.startTime) : ''}
                    {' ~ '}{item.schedule ? formatTime(item.schedule.endTime) : ''}
                  </p>
                  {item.role && (
                    <p>🎭 角色：{item.role}</p>
                  )}
                  {item.schedule?.customerName && (
                    <p>👤 预约人：{item.schedule.customerName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
