import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { Room, Actor, Script } from '../types';
import type { ScheduleWithDetails, ScheduleFormData, SelectedActor } from '../types/schedule';
import { format, addDays, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 子组件
import ScheduleCalendarModal from './ScheduleCalendarModal';
import QRCodeModal from './QRCodeModal';
import ConfirmScheduleModal from './ConfirmScheduleModal';

export default function ScheduleCalendar() {
  const { get, post, put, del, loading } = useApi();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  // 弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithDetails | null>(null);
  const [isPendingMode, setIsPendingMode] = useState(false);

  const [showQRModal, setShowQRModal] = useState(false);
  const [qrSchedule, setQrSchedule] = useState<ScheduleWithDetails | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingSchedule, setConfirmingSchedule] = useState<ScheduleWithDetails | null>(null);
  const [confirmRoomId, setConfirmRoomId] = useState('');

  // 表单状态
  const [formData, setFormData] = useState<ScheduleFormData>({
    roomId: '', scriptId: '', date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '14:00', customerName: '', customerPhone: '',
    playerCount: '', note: '',
  });
  const [selectedActors, setSelectedActors] = useState<SelectedActor[]>([]);

  // 加载数据
  useEffect(() => { loadData(); }, []);

  // 自动轮询刷新（每15秒刷新一次，确保客上车后实时更新）
  useEffect(() => {
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  // 页面回到焦点时刷新（客服从签到页切回来后自动更新）
  useEffect(() => {
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const loadData = async () => {
    const [roomsRes, actorsRes, scriptsRes, schedulesRes] = await Promise.all([
      get<Room[]>('/rooms'), get<Actor[]>('/actors'),
      get<Script[]>('/scripts'), get<ScheduleWithDetails[]>('/schedules'),
    ]);
    if (roomsRes.success) setRooms(roomsRes.data || []);
    if (actorsRes.success) setActors(actorsRes.data || []);
    if (scriptsRes.success) setScripts(scriptsRes.data || []);
    if (schedulesRes.success) setSchedules(schedulesRes.data || []);
  };

  // 踢出客人
  const handleKickGuest = async (scheduleId: string, guestName: string, role: string) => {
    if (!confirm(`确定要踢出 "${guestName}"（${role}）吗？`)) return;
    const res = await post(`/schedules/${scheduleId}/checkins/kick`, { guestName, role });
    if (res.success) { alert('已踢出'); loadData(); }
    else alert('踢出失败：' + res.error);
  };

  // 确认排期
  const handleConfirmSchedule = async () => {
    if (!confirmingSchedule || !confirmRoomId) { alert('请选择房间'); return; }
    const res = await put(`/schedules/${confirmingSchedule.id}/confirm`, { roomId: confirmRoomId });
    if (res.success) {
      setShowConfirmModal(false); setConfirmingSchedule(null); setConfirmRoomId(''); loadData();
    } else alert('确认失败：' + (res.error || '未知错误'));
  };

  const openCreateModal = (dateStr?: string) => {
    setEditingSchedule(null); setIsPendingMode(false);
    setFormData({
      roomId: '', scriptId: '', date: dateStr || format(new Date(), 'yyyy-MM-dd'),
      startTime: '14:00', customerName: '', customerPhone: '', playerCount: '', note: '',
    });
    setSelectedActors([]); setShowModal(true);
  };

  const openEditModal = (schedule: ScheduleWithDetails) => {
    setEditingSchedule(schedule); setIsPendingMode(!schedule.room_id);
    const startDateTime = parseISO(schedule.start_time);
    setFormData({
      roomId: schedule.room_id || '', scriptId: schedule.script_id,
      date: format(startDateTime, 'yyyy-MM-dd'), startTime: format(startDateTime, 'HH:mm'),
      customerName: schedule.customer_name || '', customerPhone: schedule.customer_phone || '',
      playerCount: schedule.player_count ? String(schedule.player_count) : '', note: schedule.note || '',
    });
    setSelectedActors((schedule.actors || []).map(a => ({
      actorId: a.actor_id, roleName: a.role_name, startOffset: 0, duration: 240,
    })));
    setShowModal(true);
  };

  const openConfirmModal = (schedule: ScheduleWithDetails) => {
    setConfirmingSchedule(schedule); setConfirmRoomId(''); setShowConfirmModal(true);
  };

  const openQRModal = (schedule: ScheduleWithDetails, e: React.MouseEvent) => {
    e.stopPropagation(); setQrSchedule(schedule); setShowQRModal(true);
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
    const script = scripts.find(s => s.id === formData.scriptId);
    const duration = script?.duration || 240;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
    const data = {
      roomId: formData.roomId || undefined, scriptId: formData.scriptId,
      startTime: startDateTime.toISOString(), endTime: endDateTime.toISOString(),
      timeStart: formData.startTime, timeEnd: format(endDateTime, 'HH:mm'),
      date: formData.date,
      status: formData.roomId ? 'scheduled' : 'pending',
      customerName: formData.customerName || undefined,
      customerPhone: formData.customerPhone || undefined,
      playerCount: formData.playerCount ? parseInt(formData.playerCount) : undefined,
      note: formData.note || undefined,
      actors: selectedActors.map(sa => {
        const actorStart = new Date(startDateTime.getTime() + sa.startOffset * 60000);
        const actorEnd = new Date(actorStart.getTime() + sa.duration * 60000);
        return { actorId: sa.actorId, roleName: sa.roleName, startTime: actorStart.toISOString(), endTime: actorEnd.toISOString() };
      }),
    };
    const result = editingSchedule
      ? await put(`/schedules/${editingSchedule.id}`, data)
      : await post('/schedules', data);
    if (result.success) { setShowModal(false); loadData(); }
    else alert('保存失败: ' + (result.error || '未知错误'));
  };

  const handleDelete = async () => {
    if (!editingSchedule || !confirm('确定要删除这个排期吗？')) return;
    const result = await del(`/schedules/${editingSchedule.id}`);
    if (result.success) { setShowModal(false); loadData(); }
    else alert('删除失败: ' + (result.error || '未知错误'));
  };

  // ===== 布局 =====
  // ===== 按日期分组 =====
  const todayStr = format(currentDate, 'yyyy-MM-dd');
  const todaySchedules = schedules.filter(s => s.start_time.startsWith(todayStr) && s.status !== 'cancelled');
  const futureSchedules = schedules.filter(s => !s.start_time.startsWith(todayStr) && s.status !== 'cancelled' && s.start_time > todayStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const stText: Record<string, string> = {
    scheduled: '已确认', pending: '待排期', ongoing: '进行中', completed: '已完成', cancelled: '已取消',
  };
  const stColor: Record<string, string> = {
    scheduled: 'text-blue-600 bg-blue-50', pending: 'text-yellow-600 bg-yellow-50',
    ongoing: 'text-green-600 bg-green-50', completed: 'text-gray-500 bg-gray-100',
    cancelled: 'text-red-500 bg-red-50',
  };

  let carCounter = 0;
  function scheduleRow(s: ScheduleWithDetails, showActions: boolean) {
    const script = scripts.find(sc => sc.id === s.script_id);
    const sD = parseISO(s.start_time);
    const eD = parseISO(s.end_time);
    const dateStr = format(sD, 'yyyy-MM-dd');
    carCounter++;
    const carNum = `#${String(carCounter).padStart(3, '0')}`;
    return (
      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openEditModal(s)}>
        <td className="px-4 py-3">
          <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{carNum}</span>
        </td>
        <td className="px-4 py-3 text-gray-800 hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); openCreateModal(dateStr); }}>
          <span className="cursor-pointer" title="点击为此日期添加排班">{format(sD, 'M/d')}</span>
        </td>
        <td className="px-4 py-3 text-gray-500">{format(sD, 'EEEE', { locale: zhCN })}</td>
        <td className="px-4 py-3">
          <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600">{script?.dm_gender || '未分类'}</span>
        </td>
        <td className="px-4 py-3 text-gray-800">{format(sD, 'HH:mm')}-{format(eD, 'HH:mm')}</td>
        <td className="px-4 py-3 font-medium text-gray-900">{script?.name || '未知剧本'}</td>
        <td className="px-4 py-3 text-gray-600">{s.room_name || <span className="text-yellow-500 text-xs">待分配</span>}</td>
        <td className="px-4 py-3">
          <span className="text-sm">{s.player_count || '-'}人</span>
          {s.player_roles && (s.player_roles as any[]).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(s.player_roles as any[]).map((r: any) => {
                const taken = (s.checkins || []).some((c: any) => c.role === r.name);
                return (
                  <span key={r.name} className={`text-[10px] px-1.5 py-0.5 rounded ${taken ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {r.name}{r.gender ? `(${r.gender})` : ''}{taken ? '✓' : ''}
                  </span>
                );
              })}
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-full ${stColor[s.status] || 'bg-gray-50 text-gray-500'}`}>
            {stText[s.status] || s.status}
          </span>
        </td>
        {showActions && (
          <td className="px-4 py-3">
            <button onClick={(e) => { e.stopPropagation(); openEditModal(s); }} className="text-xs text-indigo-600 hover:underline">编辑</button>
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="space-y-6">
      {/* 5月5日（今天）大框 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-indigo-600 px-5 py-3 flex items-center justify-between">
          <h3 className="text-white font-bold">
            {format(currentDate, 'M月d日')} · 今天 · {format(currentDate, 'EEEE', { locale: zhCN })}
          </h3>
          <button onClick={() => openCreateModal()}
            className="px-3 py-1 bg-white text-indigo-700 text-sm rounded-lg hover:bg-gray-100 transition-colors font-medium">
            + 添加排期
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">车次</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">日期</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">星期</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">类型</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">时间</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">剧本</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">房间</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">人数</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {todaySchedules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">
                    <button onClick={() => openCreateModal(format(currentDate, 'yyyy-MM-dd'))} className="text-indigo-600 hover:underline text-sm">
                      今天暂无排班，点击添加 →
                    </button>
                  </td>
                </tr>
              ) : todaySchedules.map(s => scheduleRow(s, false))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6号及以后的档期 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-800 px-5 py-3 flex items-center justify-between">
          <h3 className="text-white font-bold">近期排班</h3>
          <button onClick={() => openCreateModal()}
            className="px-3 py-1 bg-white text-gray-800 text-sm rounded-lg hover:bg-gray-100 transition-colors font-medium">
            + 添加排期
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentDate(addDays(currentDate, -7))}
              className="text-xs text-gray-300 hover:text-white">← 上一周</button>
            <span className="text-xs text-gray-400">{format(currentDate, 'M月')}</span>
            <button onClick={() => setCurrentDate(addDays(currentDate, 7))}
              className="text-xs text-gray-300 hover:text-white">下一周 →</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">日期</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">星期</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">类型</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">时间</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">剧本</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">房间</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">人数</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">状态</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {futureSchedules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">
                    <button onClick={() => openCreateModal(format(addDays(currentDate, 1), 'yyyy-MM-dd'))} className="text-indigo-600 hover:underline text-sm">
                      暂无排班，点击添加 →
                    </button>
                  </td>
                </tr>
              ) : futureSchedules.map(s => scheduleRow(s, true))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 弹窗 */}
      <ScheduleCalendarModal
        visible={showModal}
        editingSchedule={editingSchedule}
        isPendingMode={isPendingMode}
        scripts={scripts} rooms={rooms} actors={actors}
        formData={formData} selectedActors={selectedActors}
        loading={loading}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        onFormDataChange={setFormData}
        onSelectedActorsChange={setSelectedActors}
        onKickGuest={(name, role) => editingSchedule && handleKickGuest(editingSchedule.id, name, role)}
        onOpenQRModal={(e) => editingSchedule && openQRModal(editingSchedule, e)}
      />

      <QRCodeModal
        schedule={qrSchedule}
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        onKickGuest={(name, role) => qrSchedule && handleKickGuest(qrSchedule.id, name, role)}
      />

      <ConfirmScheduleModal
        schedule={confirmingSchedule}
        roomId={confirmRoomId}
        rooms={rooms}
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSchedule}
        onRoomChange={setConfirmRoomId}
      />
    </div>
  );
}
