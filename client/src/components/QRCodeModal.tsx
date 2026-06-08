import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { CHECKIN_BASE_URL } from '../config';
import { useScheduleCheckins } from '../hooks/useScheduleCheckins';
import CheckInRoles from './CheckInRoles';
import { useApi } from '../hooks/useApi';

interface RoleItem {
  name: string;
  gender?: string;
}
interface QRCodeModalProps {
  schedule: { id: string; script_name: string; start_time: string; room_name?: string; player_roles?: RoleItem[] | string; status?: string } | null;
  visible: boolean;
  onClose: () => void;
  onKickGuest?: (guestName: string, role: string) => void;
  onChanged?: () => void;
}

interface JoinRequest {
  id: string;
  display_name: string;
  role_name?: string | null;
  note?: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  created_at: string;
}

type Tab = 'join' | 'checkin' | 'evaluate';

export default function QRCodeModal({ schedule, visible, onClose, onKickGuest, onChanged }: QRCodeModalProps) {
  const { get, post, put } = useApi();
  const [tab, setTab] = useState<Tab>('join');
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [message, setMessage] = useState('');
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const { count, checkins, refresh } = useScheduleCheckins(schedule?.id);

  const loadJoinRequests = async () => {
    if (!schedule?.id) return;
    const result = await get<JoinRequest[]>(`/schedules/${schedule.id}/join-requests`);
    if (result.success) setJoinRequests(result.data || []);
  };

  useEffect(() => {
    if (visible && schedule?.id) {
      void loadJoinRequests();
      setMessage('');
      setTab('join');
      setShowStaffForm(false);
      setStaffName('');
      setStaffPhone('');
      setStaffRole('');
    }
  }, [visible, schedule?.id]);

  if (!visible || !schedule) return null;

  const evaluateUrl = `${CHECKIN_BASE_URL}/evaluate/${schedule.id}`;
  const checkinUrl = `${CHECKIN_BASE_URL}/checkin/${schedule.id}`;
  const joinUrl = `${CHECKIN_BASE_URL}/join/${schedule.id}`;
  const pendingRequests = joinRequests.filter(request => request.status === 'pending');
  const playerRoles = Array.isArray(schedule.player_roles) ? schedule.player_roles.map((r: any) => r.name || r) : [];
  const takenRoles = new Set(checkins.map(item => item.role).filter(Boolean));
  const availableRoles = playerRoles.filter(role => !takenRoles.has(role));

  const copyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setMessage('拼车加入链接已复制');
    } catch {
      setMessage(joinUrl);
    }
  };

  const reviewRequest = async (request: JoinRequest, action: 'confirm' | 'reject') => {
    const result = await put(`/schedules/${schedule.id}/join-requests/${request.id}`, { action });
    if (result.success) {
      setMessage(action === 'confirm' ? '已确认上车' : '已拒绝申请');
      await loadJoinRequests();
      refresh();
      onChanged?.();
    } else {
      setMessage(result.error || '处理失败');
    }
  };

  const submitStaffCheckin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!staffName.trim()) {
      setMessage('请填写玩家称呼');
      return;
    }
    if (!staffRole) {
      setMessage('请选择角色');
      return;
    }
    setStaffSubmitting(true);
    setMessage('');
    const result = await post(`/schedules/${schedule.id}/staff-checkin`, {
      name: staffName.trim(),
      phone: staffPhone.trim() || null,
      role: staffRole,
      avatar: null,
    });
    setStaffSubmitting(false);
    if (result.success) {
      setMessage(`已为 ${staffName.trim()} 上车`);
      setStaffName('');
      setStaffPhone('');
      setStaffRole('');
      refresh();
      onChanged?.();
    } else {
      setMessage(result.error || '上车失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">分享二维码</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <h4 className="font-medium text-blue-900 mb-0.5">{schedule.script_name}</h4>
          <p className="text-sm text-blue-700">
            {format(parseISO(schedule.start_time), 'MM月dd日 HH:mm', { locale: zhCN })}
            {schedule.room_name && ` · ${schedule.room_name}`}
          </p>
        </div>

        {/* Tab 切换：拼车加入 / 签到码 / 评价码 */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'join' ? 'bg-white text-emerald-600 shadow' : 'text-gray-500'
            }`}
          >
            拼车加入
          </button>
          <button
            onClick={() => setTab('checkin')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'checkin' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'
            }`}
          >
            签到码
          </button>
          <button
            onClick={() => setTab('evaluate')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'evaluate' ? 'bg-white text-orange-600 shadow' : 'text-gray-500'
            }`}
          >
            评价码
          </button>
        </div>

        {tab === 'join' ? (
          <>
            <div className="text-center">
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg mb-3">
                <p className="text-sm text-emerald-700">玩家扫码后登录，提交加入申请；店家确认后才正式上车。</p>
              </div>
              <div className="bg-gray-100 p-4 rounded-lg mb-3 inline-block">
                <QRCodeSVG value={joinUrl} size={200} level="M" includeMargin />
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={copyJoinUrl} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                  复制拼车链接
                </button>
                <button onClick={() => window.open(joinUrl, '_blank')} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">
                  打开
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800">待确认申请</h4>
                <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600">{pendingRequests.length} 条</span>
              </div>
              <div className="space-y-2">
                {pendingRequests.map(request => (
                  <div key={request.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-800">{request.display_name}</p>
                        <p className="text-xs text-gray-500 mt-1">{request.role_name || '不挑角色'} · {new Date(request.created_at).toLocaleString('zh-CN')}</p>
                        {request.note && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{request.note}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => reviewRequest(request, 'confirm')} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700">确认</button>
                        <button onClick={() => reviewRequest(request, 'reject')} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs hover:bg-gray-200">拒绝</button>
                      </div>
                    </div>
                  </div>
                ))}
                {pendingRequests.length === 0 && (
                  <p className="py-5 text-center text-sm text-gray-400">暂无待确认申请</p>
                )}
              </div>
            </div>
            {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
          </>
        ) : tab === 'checkin' ? (
          <>
            <div className="text-center">
              <div className="bg-gray-100 p-4 rounded-lg mb-3 inline-block">
                <QRCodeSVG value={checkinUrl} size={200} level="M" includeMargin />
              </div>
              <p className="text-sm text-gray-600 mb-3">
                已有 <span className="font-bold text-blue-600">{count}</span> 人扫码上车
              </p>
              
              <div className="mt-3 mb-3">
                <button
                  onClick={() => setShowStaffForm(value => !value)}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm"
                >
                  {showStaffForm ? '收起客服代填' : '客服代填上车'}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  玩家懒得注册时，店家可直接代录入；玩家扫码加入仍需要登录。
                </p>
              </div>
            </div>
            {showStaffForm && (
              <form onSubmit={submitStaffCheckin} className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">玩家称呼</label>
                    <input
                      value={staffName}
                      onChange={event => setStaffName(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="例如：泡泡"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">手机号（可选）</label>
                    <input
                      value={staffPhone}
                      onChange={event => setStaffPhone(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="留空也能上车"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">角色</label>
                  <select
                    value={staffRole}
                    onChange={event => setStaffRole(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">选择未占用角色</option>
                    {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                  {availableRoles.length === 0 && <p className="mt-1 text-xs text-amber-600">当前没有可选空位。</p>}
                </div>
                <button
                  type="submit"
                  disabled={staffSubmitting || availableRoles.length === 0}
                  className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {staffSubmitting ? '上车中...' : '确认代填上车'}
                </button>
              </form>
            )}
            {schedule.player_roles && (
              <CheckInRoles
                checkins={checkins}
                playerRoles={playerRoles}
                onKickGuest={onKickGuest}
              />
            )}
          </>
        ) : (
          <div className="text-center">
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg mb-3">
              <p className="text-sm text-orange-700">打完本后请客户扫码评价</p>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg mb-3 inline-block">
              <QRCodeSVG value={evaluateUrl} size={200} level="M" includeMargin />
            </div>
            <p className="text-sm text-gray-500">评价结果可在剧本管理中查看</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
