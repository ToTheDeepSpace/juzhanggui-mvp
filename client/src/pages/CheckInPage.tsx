import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface RoleInfo {
  name: string;
  gender?: string;
}
interface CheckinInfo {
  role: string;
  gender?: string;
}
interface ScheduleInfo {
  id: string;
  script_name: string;
  room_name: string;
  start_time: string;
  end_time: string;
  player_roles?: RoleInfo[];
  player_count?: number;
  taken_roles?: string[];
  checkins?: CheckinInfo[];
}

export default function CheckInPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const { get, post, loading } = useApi();

  const [schedule, setSchedule] = useState<ScheduleInfo | null>(null);
  // 验证码登录
  const [authPhone, setAuthPhone] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  // 签到表单
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestGender, setGuestGender] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // 尝试从 localStorage 获取已保存的客人信息
  useEffect(() => {
    const savedName = localStorage.getItem('guest_name');
    const savedPhone = localStorage.getItem('guest_phone');
    if (savedName) setGuestName(savedName);
    if (savedPhone) setGuestPhone(savedPhone);
  }, []);

  // 加载排期信息
  useEffect(() => {
    if (scheduleId) { loadSchedule(); }
  }, [scheduleId]);

  const sendCode = async () => {
    if (!authPhone.trim()) { setError('请输入手机号'); return; }
    setCodeSending(true); setError('');
    const r = await post('/player/send-code', { phone: authPhone.trim() });
    setCodeSending(false);
    if (r.success) { setCodeSent(true); setError('验证码已发送（测试码：8888）'); }
    else setError(r.error || '发送失败');
  };

  const verifyCode = async () => {
    if (!authCode.trim()) { setError('请输入验证码'); return; }
    const r = await post('/player/verify-code', { phone: authPhone.trim(), code: authCode.trim() });
    if (r.success) {
      setAuthenticated(true); setPlayerId(r.data?.id || null);
      setGuestName(r.data?.display_name || '');
      setGuestPhone(authPhone.trim());
      localStorage.setItem('guest_name', r.data?.display_name || '');
      localStorage.setItem('guest_phone', authPhone.trim());
      setError('');
    } else { setError(r.error || '验证失败'); }
  };

  const loadSchedule = async () => {
    const res = await get<ScheduleInfo>(`/schedules/${scheduleId}/public`);
    if (res.success && res.data) {
      setSchedule(res.data);
    } else {
      setError('无效的二维码或排期已取消');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!guestName.trim()) {
      setError('请输入您的称呼');
      return;
    }

    if (!guestGender) {
      setError('请选择您的性别');
      return;
    }
    if (!selectedRole) {
      setError('请选择您想扮演的角色');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmCheckIn = async () => {
    if (!scheduleId) return;

    // 保存客人信息到 localStorage
    localStorage.setItem('guest_name', guestName);
    localStorage.setItem('guest_phone', guestPhone);

    const res = await post(`/schedules/${scheduleId}/checkin`, {
      name: guestName,
      phone: guestPhone || null,
      gender: guestGender,
      role: selectedRole,
      avatar: null
    });

    if (res.success) {
      setCheckedIn(true);
      setShowConfirm(false);
    } else {
      setError(res.error || '上车失败，请重试');
      setShowConfirm(false);
    }
  };

  if (error && !schedule && !authenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">出错了</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (checkedIn) {
    const isStaff = new URLSearchParams(window.location.search).get('staff') === 'true';
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-green-600 mb-2">上车成功！</h2>
          <p className="text-gray-600 mb-4">
            欢迎 {guestName}（{guestGender}），已上车
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 mb-4">
            <p className="font-medium">{schedule?.script_name}</p>
            <p>{schedule && format(parseISO(schedule.start_time), 'MM月dd日 HH:mm', { locale: zhCN })}</p>
            <p>{schedule?.room_name}</p>
          </div>
          {isStaff ? (
            <div className="space-y-2">
              <button
                onClick={() => { setCheckedIn(false); setGuestName(''); setGuestPhone(''); setGuestGender(''); setSelectedRole(''); setError(''); loadSchedule(); }}
                className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                + 继续添加下一位玩家
              </button>
              <button onClick={() => window.close()} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                完成，关闭页面
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-4">您可以关闭此页面</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎭</div>
          <h1 className="text-xl font-bold text-gray-800">剧本杀上车</h1>
        </div>

        {!authenticated ? (
          /* 验证码登录步骤 */
          <div className="space-y-4">
            <div className="text-center mb-2">
              <p className="text-sm text-gray-500">请先验证手机号</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
              <div className="flex gap-2">
                <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="请输入手机号" disabled={codeSent} />
                <button onClick={sendCode} disabled={codeSending || codeSent}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap">
                  {codeSending ? '发送中...' : codeSent ? '已发送' : '获取验证码'}
                </button>
              </div>
            </div>
            {codeSent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                <input type="text" value={authCode} onChange={e => setAuthCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="输入验证码" maxLength={6} />
                <button onClick={verifyCode} className="w-full mt-3 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 text-sm">
                  验证并上车
                </button>
              </div>
            )}
          </div>
        ) : (
        /* 已验证，显示签到表单 */
        <div className="space-y-4">
        {schedule && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h2 className="font-medium text-blue-900 mb-1">{schedule.script_name}</h2>
            <p className="text-sm text-blue-700">
              {format(parseISO(schedule.start_time), 'MM月dd日 HH:mm', { locale: zhCN })}
            </p>
            <p className="text-sm text-blue-700">{schedule.room_name}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              您的称呼 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="怎么称呼您"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              您的性别 <span className="text-red-500">*</span>
            </label>
            <select
              value={guestGender}
              onChange={(e) => setGuestGender(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">请选择性别</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
            <p className="text-xs text-gray-400 mt-2">
              🛈 默认上车配对为异性恋，如有其他性取向需求请跟客服私聊
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              手机号（选填）
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="方便客服联系您"
            />
          </div>

          {(() => {
            const roles = (schedule?.player_roles || []) as RoleInfo[];
            const takenNames = schedule?.taken_roles || [];
            const checkinList = (schedule?.checkins || []) as CheckinInfo[];
            const availableRoles = roles.filter(r => !takenNames.includes(r.name));
            const isFull = availableRoles.length === 0 && roles.length > 0;
            
            if (isFull) {
              return (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm text-center">
                    🚫 该场次所有角色已被选完
                  </p>
                </div>
              );
            }
            
            if (availableRoles.length > 0) {
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    选择角色 <span className="text-red-500">*</span>
                    {takenNames.length > 0 && (
                      <span className="text-xs text-gray-400 ml-2">
                        已选 {takenNames.length}/{roles.length} 人
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">请选择您想扮演的角色</option>
                    {availableRoles.map((role) => (
                      <option key={role.name} value={role.name}>
                        {role.name}{role.gender ? ` (${role.gender})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            
            return null;
          })()}

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            下一步
          </button>
        </form>

          <p className="text-xs text-gray-400 mt-4">
          填写信息后确认即可上车
        </p>
        </div>
        )}
      </div>

      {/* 确认弹窗 */}
      {showConfirm && schedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">📋</div>
              <h3 className="text-lg font-bold text-gray-800">请确认您的信息</h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">剧本</span>
                <span className="font-medium">{schedule.script_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">时间</span>
                <span className="font-medium">
                  {format(parseISO(schedule.start_time), 'MM月dd日 HH:mm', { locale: zhCN })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">房间</span>
                <span className="font-medium">{schedule.room_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">称呼</span>
                <span className="font-medium">{guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">性别</span>
                <span className="font-medium">{guestGender}</span>
              </div>
              {selectedRole && (
                <div className="flex justify-between">
                  <span className="text-gray-500">角色</span>
                  <span className="font-medium text-blue-600">{selectedRole}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleConfirmCheckIn}
                disabled={loading}
                className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '确认中...' : '确认上车'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
              >
                返回修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
