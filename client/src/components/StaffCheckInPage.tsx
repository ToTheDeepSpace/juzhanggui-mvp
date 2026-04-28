import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ScheduleItem {
  id: string;
  script_name: string;
  room_name: string;
  start_time: string;
  end_time: string;
  player_count?: number;
  taken_roles?: string[];
  player_roles?: string[];
}

export default function StaffCheckInPage() {
  const navigate = useNavigate();
  const { get, loading } = useApi();
  
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [filter, setFilter] = useState<'today' | 'upcoming' | 'past'>('today');
  const [error, setError] = useState('');

  // 加载排期数据
  const loadSchedules = async () => {
    const today = new Date();
    const startDate = format(today, 'yyyy-MM-dd');
    const endDate = format(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'); // 未来30天
    
    const res = await get<ScheduleItem[]>(`/schedules?startDate=${startDate}&endDate=${endDate}`);
    if (res.success && res.data) {
      setSchedules(res.data);
    } else {
      setError(res.error || '加载排期失败');
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  // 过滤排期
  const filteredSchedules = schedules.filter(schedule => {
    const scheduleDate = parseISO(schedule.start_time);
    const now = new Date();
    
    switch (filter) {
      case 'today':
        return isToday(scheduleDate);
      case 'upcoming':
        return scheduleDate > now && !isToday(scheduleDate);
      case 'past':
        return isPast(scheduleDate);
      default:
        return true;
    }
  });

  // 格式化时间
  const formatTime = (time: string) => {
    return format(parseISO(time), 'MM月dd日 HH:mm', { locale: zhCN });
  };

  // 获取剩余角色数量
  const getAvailableRolesCount = (schedule: ScheduleItem) => {
    const total = schedule.player_roles?.length || 0;
    const taken = schedule.taken_roles?.length || 0;
    return total - taken;
  };

  // 获取状态标签
  const getStatus = (schedule: ScheduleItem) => {
    const scheduleDate = parseISO(schedule.start_time);
    
    if (isPast(schedule.end_time)) return { text: '已结束', color: 'bg-gray-100 text-gray-600' };
    if (isPast(schedule.start_time)) return { text: '进行中', color: 'bg-green-100 text-green-600' };
    if (isToday(scheduleDate)) return { text: '今天', color: 'bg-blue-100 text-blue-600' };
    if (isTomorrow(scheduleDate)) return { text: '明天', color: 'bg-purple-100 text-purple-600' };
    return { text: '即将开始', color: 'bg-yellow-100 text-yellow-600' };
  };

  // 处理上车按钮点击
  const handleCheckIn = (scheduleId: string) => {
    navigate(`/checkin/${scheduleId}`);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">客服上车管理</h1>
          <p className="text-gray-600 mt-1">选择排期，为客人填写上车信息</p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('today')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'today'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            今日排期
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'upcoming'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            即将开始
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'past'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            历史排期
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {loading && !schedules.length ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-500">加载中...</p>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-4">📅</div>
          <p className="text-gray-500">暂无排期</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSchedules.map((schedule) => {
            const status = getStatus(schedule);
            const availableRoles = getAvailableRolesCount(schedule);
            const isEnded = isPast(parseISO(schedule.end_time));
            
            return (
              <div
                key={schedule.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{schedule.script_name}</h3>
                      <p className="text-sm text-gray-500">{schedule.room_name}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${status.color}`}>
                      {status.text}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">🕒</span>
                      <span>{formatTime(schedule.start_time)}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">👥</span>
                      <span>
                        {schedule.taken_roles?.length || 0} / {schedule.player_roles?.length || 0} 人
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      {availableRoles > 0 ? (
                        <span className="text-sm text-green-600">
                          🎭 剩余 {availableRoles} 个角色
                        </span>
                      ) : (
                        <span className="text-sm text-red-600">🚫 已满员</span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleCheckIn(schedule.id)}
                      disabled={isEnded || availableRoles <= 0}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        isEnded || availableRoles <= 0
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-indigo-500 text-white hover:bg-indigo-600'
                      }`}
                    >
                      {isEnded ? '已结束' : availableRoles <= 0 ? '已满员' : '填写上车'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-center">
          <div className="text-2xl mr-3">💡</div>
          <div>
            <h4 className="font-medium text-blue-900">使用说明</h4>
            <p className="text-sm text-blue-700 mt-1">
              1. 选择排期后点击"填写上车"按钮，进入客人信息填写页面。<br />
              2. 客服可为客人填写称呼、手机号、选择角色等信息。<br />
              3. 系统会自动保存客人信息，方便下次快速填写。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}