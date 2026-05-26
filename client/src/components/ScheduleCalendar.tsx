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

  // 开始确认状态
  const [showStartModal, setShowStartModal] = useState(false);
  const [startingSchedule, setStartingSchedule] = useState<ScheduleWithDetails | null>(null);
  const [startActors, setStartActors] = useState<SelectedActor[]>([]);
  const [actualStartTime, setActualStartTime] = useState('');

  // 结束确认状态
  const [showEndModal, setShowEndModal] = useState(false);
  const [endingSchedule, setEndingSchedule] = useState<ScheduleWithDetails | null>(null);
  const [endType, setEndType] = useState('normal');
  const [endNote, setEndNote] = useState('');
  const [endSubmitting, setEndSubmitting] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [conflictType, setConflictType] = useState('service_attitude');
  const [conflictDesc, setConflictDesc] = useState('');

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

  const openQRModal = (schedule: ScheduleWithDetails, e: React.MouseEvent) => {
    e.stopPropagation(); setQrSchedule(schedule); setShowQRModal(true);
  };

  const openEndModal = (schedule: ScheduleWithDetails, e: React.MouseEvent) => {
    e.stopPropagation(); setEndingSchedule(schedule); setEndType('normal'); setEndNote(''); setShowEndModal(true);
  };

  const openStartModal = (schedule: ScheduleWithDetails, e: React.MouseEvent) => {
    e.stopPropagation(); setStartingSchedule(schedule);
    setActualStartTime(schedule.start_time ? schedule.start_time.split('T')[1]?.substring(0, 5) : '');
    setStartActors([]); setShowStartModal(true);
  };

  const handleStartConfirm = async () => {
    if (!startingSchedule) return;
    const now = new Date();
    const [h, m] = (actualStartTime || '14:00').split(':').map(Number);
    now.setHours(h, m, 0, 0);
    const end = new Date(now.getTime() + 240 * 60000);
    await put(`/schedules/${startingSchedule.id}`, {
      status: 'ongoing', timeStart: actualStartTime || '14:00', timeEnd: '18:00',
      date: format(now, 'yyyy-MM-dd'), startTime: now.toISOString(), endTime: end.toISOString()
    });
    setShowStartModal(false); loadData();
  };

  const handleEndSubmit = async () => {
    if (!endingSchedule) return;
    setEndSubmitting(true);
    if (endType === 'normal') {
      await put(`/schedules/${endingSchedule.id}/complete`, {});
    } else {
      const cancelStatus = endType === 'bomb' ? 'bombed' : endType === 'flow' ? 'cancelled' : 'issue';
      await put(`/schedules/${endingSchedule.id}/cancel`, { status: cancelStatus, note: endNote });
    }
    if (showConflict && conflictDesc.trim()) {
      await post('/conflicts', { scheduleId: endingSchedule.id, conflictType, conflictDescription: conflictDesc, conflictDate: new Date().toISOString() });
    }
    setShowEndModal(false); setEndSubmitting(false); loadData();
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

  const [showEnded, setShowEnded] = useState(false);

  const [histStartDate, setHistStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return format(d, 'yyyy-MM-dd');
  });
  const [histEndDate, setHistEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const exportCSV = () => {
    const toExport = [...schedules]
      .filter(s => { const d = s.start_time.split('T')[0]; return d >= histStartDate && d <= histEndDate; })
      .sort((a, b) => b.start_time.localeCompare(a.start_time));
    const headers = ['日期', '星期', '时间段', '剧本', '房间', '人数', '状态', '客户姓名', '客户手机', '备注'];
    const rows = toExport.map(s => {
      const sc = scripts.find(x => x.id === s.script_id);
      const sd = parseISO(s.start_time);
      const ed = parseISO(s.end_time);
      return [
        format(sd, 'yyyy-MM-dd'),
        format(sd, 'EEEE', { locale: zhCN }),
        `${format(sd, 'HH:mm')}-${format(ed, 'HH:mm')}`,
        sc?.name || '',
        s.room_name || '',
        String(s.player_count || ''),
        stText[s.status] || s.status,
        s.customer_name || '',
        s.customer_phone || '',
        s.note || '',
      ].map(v => `"${v.replace(/"/g, '""')}"`).join(',');
    });
    const csv = '﻿' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `排期数据_${histStartDate}_${histEndDate}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ===== 布局 =====
  // ===== 按日期分组 =====
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaySchedules = schedules.filter(s => s.start_time.startsWith(todayStr) && s.status !== 'cancelled');
  const otherActiveSchedules = schedules.filter(s => !s.start_time.startsWith(todayStr) && s.status !== 'completed' && s.status !== 'cancelled' && s.status !== 'bombed' && s.status !== 'issue')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const endedSchedules = schedules
    .filter(s => { const d = s.start_time.split('T')[0]; return d >= histStartDate && d <= histEndDate; })
    .sort((a, b) => b.start_time.localeCompare(a.start_time));

  const stText: Record<string, string> = {
    scheduled: '待锁车', pending: '待排期', locked: '已锁车', confirmed: '已排班', ongoing: '进行中', completed: '已完成', cancelled: '流车', bombed: '炸车', issue: '其他问题',
  };
  const stColor: Record<string, string> = {
    scheduled: 'text-blue-600 bg-blue-50', pending: 'text-yellow-600 bg-yellow-50',
    locked: 'text-orange-700 bg-orange-50', confirmed: 'text-indigo-600 bg-indigo-50',
    ongoing: 'text-green-600 bg-green-50', completed: 'text-gray-500 bg-gray-100',
    cancelled: 'text-red-500 bg-red-50', bombed: 'text-orange-600 bg-orange-50', issue: 'text-purple-600 bg-purple-50',
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
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); openEditModal(s); }} className="text-xs text-indigo-600 hover:underline">编辑</button>
              {s.status === 'scheduled' && (
                <button onClick={(e) => { e.stopPropagation(); if (confirm('确认已收到定金？点击确定后该车将锁定。')) { put(`/schedules/${s.id}`, { status: 'locked' }).then(() => loadData()); } }} className="text-xs text-orange-600 hover:underline font-medium">锁车</button>
              )}
              {s.status === 'locked' && (
                <button onClick={(e) => openStartModal(s, e)} className="text-xs text-indigo-600 hover:underline font-medium">确认排班</button>
              )}
              {s.status === 'confirmed' && (
                <button onClick={(e) => openStartModal(s, e)} className="text-xs text-blue-600 hover:underline font-medium">确认开始</button>
              )}
              {s.status === 'ongoing' && (
                <button onClick={(e) => openEndModal(s, e)} className="text-xs text-green-600 hover:underline font-medium">结束登记</button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="space-y-6">
      {/* 进行中 / 已结束 切换 */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100">
        <button onClick={() => setShowEnded(false)}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${!showEnded ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          🚗 进行中
        </button>
        <button onClick={() => setShowEnded(true)}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${showEnded ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          📋 历史记录 ({endedSchedules.length})
        </button>
      </div>

      {!showEnded ? (
        <>
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
              {otherActiveSchedules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">
                    <button onClick={() => openCreateModal(format(addDays(currentDate, 1), 'yyyy-MM-dd'))} className="text-indigo-600 hover:underline text-sm">
                      暂无排班，点击添加 →
                    </button>
                  </td>
                </tr>
              ) : otherActiveSchedules.map(s => scheduleRow(s, true))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 弹窗 */}
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-700 px-5 py-3 flex items-center justify-between">
            <h3 className="text-white font-bold">历史记录</h3>
            <button onClick={exportCSV} className="px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors font-medium">
              ↓ 导出 CSV
            </button>
          </div>
          <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input type="date" value={histStartDate} onChange={e => setHistStartDate(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700" />
              <span className="text-gray-400 text-sm">至</span>
              <input type="date" value={histEndDate} onChange={e => setHistEndDate(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700" />
            </div>
            <div className="flex gap-1.5">
              {[{ label: '近7天', days: 7 }, { label: '近30天', days: 30 }, { label: '近90天', days: 90 }].map(q => (
                <button key={q.label} onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - q.days);
                  setHistStartDate(format(d, 'yyyy-MM-dd'));
                  setHistEndDate(format(new Date(), 'yyyy-MM-dd'));
                }} className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                  {q.label}
                </button>
              ))}
              <button onClick={() => { setHistStartDate('2020-01-01'); setHistEndDate(format(new Date(), 'yyyy-MM-dd')); }}
                className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                全部
              </button>
            </div>
            <span className="text-xs text-gray-400 ml-auto">共 {endedSchedules.length} 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">车次</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">日期</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">星期</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">类型</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">时间</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">剧本</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">房间</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">人数</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">状态</th>
              </tr></thead>
              <tbody>
                {endedSchedules.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400">该时间段暂无记录</td></tr>
                ) : endedSchedules.map(s => {
                  const sc = scripts.find(x => x.id === s.script_id);
                  const sd = parseISO(s.start_time);
                  const ed = parseISO(s.end_time);
                  carCounter++;
                  const cn = `#${String(carCounter).padStart(3, '0')}`;
                  return (<tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openEditModal(s)}>
                    <td className="px-4 py-3"><span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{cn}</span></td>
                    <td className="px-4 py-3 text-gray-800">{format(sd, 'M/d')}</td>
                    <td className="px-4 py-3 text-gray-500">{format(sd, 'EEEE', { locale: zhCN })}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600">{sc?.dm_gender || '未分类'}</span></td>
                    <td className="px-4 py-3 text-gray-800">{format(sd, 'HH:mm')}-{format(ed, 'HH:mm')}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{sc?.name || '未知剧本'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.room_name || '-'}</td>
                    <td className="px-4 py-3"><span className="text-sm">{s.player_count || '-'}人</span></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${stColor[s.status] || 'bg-gray-100 text-gray-500'}`}>{stText[s.status] || s.status}</span></td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* 确认开始弹窗 */}
      {showStartModal && startingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">确认开本</h3>
            <div className="space-y-4 mb-5">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">实际开本时间</label>
                <input type="time" value={actualStartTime} onChange={e => setActualStartTime(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">选择卡司/DM</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value="" onChange={e => { if (e.target.value) setStartActors([...startActors, { actorId: e.target.value, roleName: 'DM', startOffset: 0, duration: 240 }]); }}>
                  <option value="">选择卡司...</option>
                  {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {startActors.map((sa, i) => {
                  const actor = actors.find(a => a.id === sa.actorId);
                  return <div key={i} className="flex items-center justify-between mt-2 p-2 bg-gray-50 rounded-lg text-sm"><span>{actor?.name || '未知'}</span><button onClick={() => setStartActors(startActors.filter((_, j) => j !== i))} className="text-red-400 text-xs">移除</button></div>;
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowStartModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm">取消</button>
              <button onClick={handleStartConfirm} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">确认开本</button>
            </div>
          </div>
        </div>
      )}

      {/* 结束登记弹窗 */}
      {showEndModal && endingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">结束登记</h3>
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 mb-3 ${endType === 'normal' ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
              <input type="radio" name="endType" value="normal" checked={endType === 'normal'} onChange={e => setEndType(e.target.value)} className="mt-0.5" />
              <div><span className="text-sm font-medium text-gray-900">✅ 正常结束</span><p className="text-xs text-gray-400">剧本顺利开完</p></div>
            </label>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { value: 'bomb', label: '💥 炸车', desc: '半途取消' },
                { value: 'flow', label: '🚫 流车', desc: '未开取消' },
                { value: 'other', label: '❓ 其他', desc: '设备/客诉等' },
              ].map(opt => (
                <label key={opt.value} className={`flex flex-col items-center gap-1 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 text-center ${endType === opt.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'}`}>
                  <input type="radio" name="endType" value={opt.value} checked={endType === opt.value} onChange={e => setEndType(e.target.value)} className="sr-only" />
                  <span className="text-lg">{opt.label.split(' ')[0]}</span>
                  <span className="text-xs font-medium text-gray-900">{opt.label.split(' ')[1]}</span>
                  <span className="text-[10px] text-gray-400">{opt.desc}</span>
                </label>
              ))}
            </div>
            <div className="bg-blue-50 rounded-lg p-4 mb-5 text-center">
              <p className="text-sm font-medium text-blue-900 mb-2">📋 评价二维码</p>
              <p className="text-xs text-blue-600 mb-3">玩家扫码后可对本次剧本进行评价</p>
              <div className="bg-white inline-block p-3 rounded-lg">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/evaluate/' + endingSchedule.id)}`} alt="评价二维码" className="w-36 h-36" />
              </div>
              <button onClick={() => navigator.clipboard.writeText(window.location.origin + '/evaluate/' + endingSchedule.id)} className="mt-2 text-xs text-blue-600 hover:underline">复制评价链接</button>
            </div>
            <textarea value={endNote} onChange={e => setEndNote(e.target.value)} placeholder="备注说明（可选）" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 h-16 resize-none focus:outline-none focus:border-indigo-400" />
            {!showConflict ? (
              <button onClick={() => setShowConflict(true)} className="w-full py-2 border border-dashed border-red-300 text-red-500 rounded-lg text-sm hover:bg-red-50 transition-colors mb-4">⚡ 出现矛盾</button>
            ) : (
              <div className="bg-red-50 rounded-lg p-4 mb-4 space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-red-800">矛盾登记</span><button onClick={() => setShowConflict(false)} className="text-xs text-gray-400 hover:text-gray-600">收起</button></div>
                <select value={conflictType} onChange={e => setConflictType(e.target.value)} className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm">
                  <option value="service_attitude">服务态度</option>
                  <option value="performance">演绎效果</option>
                  <option value="communication">沟通问题</option>
                  <option value="other_conflict">其他</option>
                </select>
                <textarea value={conflictDesc} onChange={e => setConflictDesc(e.target.value)} placeholder="描述矛盾情况..." className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm h-16 resize-none focus:outline-none" />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowEndModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleEndSubmit} disabled={endSubmitting} className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">{endSubmitting ? '处理中...' : '确认登记'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
