import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { Room, Actor, Script, StoreRecord } from '../types';
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
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [defaultDepositDraft, setDefaultDepositDraft] = useState('100');
  const [depositSettingMsg, setDepositSettingMsg] = useState('');

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
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeSchedule, setFinanceSchedule] = useState<ScheduleWithDetails | null>(null);
  const [financeRows, setFinanceRows] = useState<any[]>([]);
  const [financeMode, setFinanceMode] = useState<'deposit' | 'settlement'>('deposit');
  const [financeSaving, setFinanceSaving] = useState(false);
  const [showDmModal, setShowDmModal] = useState(false);
  const [dmSchedule, setDmSchedule] = useState<ScheduleWithDetails | null>(null);
  const [dmActorId, setDmActorId] = useState('');
  const [dmRoleName, setDmRoleName] = useState('');
  const [dmCustomerId, setDmCustomerId] = useState('');
  const [dmSaving, setDmSaving] = useState(false);

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
    const [roomsRes, actorsRes, scriptsRes, schedulesRes, storesRes] = await Promise.all([
      get<Room[]>('/rooms'), get<Actor[]>('/actors'),
      get<Script[]>('/scripts'), get<ScheduleWithDetails[]>('/schedules'),
      get<StoreRecord[]>('/stores'),
    ]);
    if (roomsRes.success) setRooms(roomsRes.data || []);
    if (actorsRes.success) setActors(actorsRes.data || []);
    if (scriptsRes.success) setScripts(scriptsRes.data || []);
    if (schedulesRes.success) setSchedules(schedulesRes.data || []);
    if (storesRes.success) {
      const nextStores = storesRes.data || [];
      setStores(nextStores);
      const first = nextStores[0];
      if (first) setDefaultDepositDraft(String(Math.round(Number(first.default_deposit_amount || 10000) / 100)));
    }
  };

  const currentStore = stores[0] || null;
  const defaultDepositAmount = Math.round(Number(currentStore?.default_deposit_amount || 10000) / 100);

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
    if (['completed', 'cancelled', 'bombed', 'issue'].includes(schedule.status)) return;
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
    e.stopPropagation();
    setStartingSchedule(schedule);
    setActualStartTime(schedule.start_time ? schedule.start_time.split('T')[1]?.substring(0, 5) : '');
    const existingByRole = new Map((schedule.actors || []).map(a => [a.role_name, a.actor_id]));
    setStartActors((schedule.actor_roles || []).map(role => ({
      actorId: schedule.requested_dm_role_name === role.name ? (schedule.requested_dm_actor_id || existingByRole.get(role.name) || '') : (existingByRole.get(role.name) || ''),
      roleName: role.name,
      startOffset: 0,
      duration: 240,
    })));
    setShowStartModal(true);
  };

  const openFinanceModal = (schedule: ScheduleWithDetails, e: React.MouseEvent, mode: 'deposit' | 'settlement') => {
    e.stopPropagation();
    setFinanceSchedule(schedule);
    setFinanceMode(mode);
    setFinanceRows((schedule.checkins || []).map((item: any) => ({
      id: item.id,
      guest_name: item.guest_name || '',
      role: item.role || '',
      deposit_status: item.deposit_status || 'unpaid',
      deposit_amount: Math.round(Number(item.deposit_amount || currentStore?.default_deposit_amount || 10000) / 100),
      deposit_payment_method: item.deposit_payment_method || '',
      deposit_payer_name: item.deposit_payer_name || item.guest_name || '',
      deposit_settlement_mode: item.deposit_settlement_mode || 'deduct_final',
      final_amount: Math.round(Number(item.final_amount || 0) / 100),
      final_payment_method: item.final_payment_method || '',
      settlement_status: item.settlement_status || 'unsettled',
      settlement_note: item.settlement_note || '',
    })));
    setShowFinanceModal(true);
  };

  const openDmModal = (schedule: ScheduleWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setDmSchedule(schedule);
    setDmActorId(schedule.requested_dm_actor_id || '');
    setDmRoleName(schedule.requested_dm_role_name || schedule.actor_roles?.[0]?.name || '');
    setDmCustomerId(schedule.dm_lock_customer_id || schedule.checkins?.find(item => item.customer_id)?.customer_id || '');
    setShowDmModal(true);
  };

  const saveDmAssignment = async (mode: 'assign' | 'not_needed' | 'clear' = 'assign') => {
    if (!dmSchedule) return;
    if (mode === 'assign') {
      if (!dmRoleName) {
        alert('请选择要指定的卡司角色');
        return;
      }
      if (!dmActorId) {
        alert('请选择扮演这个角色的卡司/DM');
        return;
      }
      if (!dmCustomerId) {
        alert('请选择扣除哪个玩家的锁卡司次数');
        return;
      }
    }
    setDmSaving(true);
    const res = await put(`/schedules/${dmSchedule.id}/dm-assignment`, { mode, actorId: dmActorId || null, roleName: dmRoleName || null, customerId: dmCustomerId || null });
    setDmSaving(false);
    if (!res.success) {
      alert(res.error || '保存指定 DM 失败');
      return;
    }
    setShowDmModal(false);
    setDmSchedule(null);
    setDmActorId('');
    setDmRoleName('');
    setDmCustomerId('');
    loadData();
  };

  const saveFinanceRows = async (completeAfterSave = false) => {
    if (!financeSchedule) return;
    setFinanceSaving(true);
    for (const row of financeRows) {
      const isRefundAfterFull = financeMode === 'settlement' && row.deposit_settlement_mode === 'refund_after_full' && row.settlement_status === 'settled';
      const result = await put(`/schedules/${financeSchedule.id}/checkins/${row.id}/finance`, {
        depositStatus: isRefundAfterFull ? 'refunded' : row.deposit_status,
        depositAmount: Math.round(Number(row.deposit_amount || 0) * 100),
        depositPaymentMethod: row.deposit_payment_method || null,
        depositPayerName: row.deposit_payer_name || null,
        depositSettlementMode: row.deposit_settlement_mode || 'deduct_final',
        finalAmount: Math.round(Number(row.final_amount || 0) * 100),
        finalPaymentMethod: row.final_payment_method || null,
        settlementStatus: row.settlement_status,
        settlementNote: row.settlement_note || null,
      });
      if (!result.success) {
        setFinanceSaving(false);
        alert(result.error || '保存失败');
        return false;
      }
    }
    if (completeAfterSave) {
      const settled = await put(`/schedules/${financeSchedule.id}/settle`, { note: '后台结算确认' });
      if (!settled.success) {
        setFinanceSaving(false);
        alert(settled.error || '完成结算失败');
        return false;
      }
      setShowFinanceModal(false);
    }
    setFinanceSaving(false);
    loadData();
    return true;
  };

  const lockSchedule = async (schedule: ScheduleWithDetails) => {
    const res = await post(`/schedules/${schedule.id}/lock`, { lockReason: 'deposit_guaranteed' });
    if (!res.success) alert(res.error || '锁车失败');
    else {
      setShowFinanceModal(false);
      loadData();
    }
  };

  const saveDepositAndLock = async () => {
    if (!financeSchedule) return;
    const saved = await saveFinanceRows(false);
    if (saved) await lockSchedule(financeSchedule);
  };

  const saveDepositSetting = async () => {
    if (!currentStore) return;
    setDepositSettingMsg('');
    const amount = Math.max(0, Math.round((Number(defaultDepositDraft || 0) || 0) * 100));
    const result = await put<StoreRecord>(`/stores/${currentStore.id}/settings`, { defaultDepositAmount: amount });
    if (result.success) {
      setDepositSettingMsg('默认定金已保存');
      loadData();
    } else {
      setDepositSettingMsg(result.error || '保存失败');
    }
  };

  const handleStartConfirm = async () => {
    if (!startingSchedule) return;
    const missingActorRole = startActors.find(row => !row.actorId);
    if (missingActorRole) {
      alert(`请确认卡司角色“${missingActorRole.roleName}”由谁扮演`);
      return;
    }
    const scheduleDate = startingSchedule.start_time.split('T')[0];
    const actualStart = new Date(`${scheduleDate}T${actualStartTime || '14:00'}`);
    const result = await post(`/schedules/${startingSchedule.id}/dm-start`, {
      actualStartTime: actualStart.toISOString(),
      actors: startActors.map(row => ({ actorId: row.actorId, roleName: row.roleName })),
    });
    if (!result.success) {
      alert(result.error || '确认开本失败');
      return;
    }
    setShowStartModal(false);
    loadData();
  };

  const handleEndSubmit = async () => {
    if (!endingSchedule) return;
    setEndSubmitting(true);
    if (endType === 'normal') {
      const result = await put(`/schedules/${endingSchedule.id}/complete`, {});
      if (!result.success) {
        alert(result.error || '收尾确认失败');
        setEndSubmitting(false);
        return;
      }
    } else {
      const cancelStatus = endType === 'bomb' ? 'bombed' : endType === 'flow' ? 'cancelled' : 'issue';
      const result = await put(`/schedules/${endingSchedule.id}/cancel`, { status: cancelStatus, note: endNote });
      if (!result.success) {
        alert(result.error || '收尾确认失败');
        setEndSubmitting(false);
        return;
      }
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
  const terminalStatuses = ['completed', 'cancelled', 'bombed', 'issue'];
  const todaySchedules = schedules.filter(s => s.start_time.startsWith(todayStr) && !terminalStatuses.includes(s.status));
  const otherActiveSchedules = schedules.filter(s => !s.start_time.startsWith(todayStr) && !terminalStatuses.includes(s.status))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const endedSchedules = schedules
    .filter(s => { const d = s.start_time.split('T')[0]; return d >= histStartDate && d <= histEndDate && terminalStatuses.includes(s.status); })
    .sort((a, b) => b.start_time.localeCompare(a.start_time));

  const stText: Record<string, string> = {
    scheduled: '待锁车', pending: '待排期', locked: '已锁车', confirmed: '已排班', ongoing: '进行中', settling: '待结算', completed: '已完成', cancelled: '流车', bombed: '炸车', issue: '其他问题',
  };
  const stColor: Record<string, string> = {
    scheduled: 'text-blue-600 bg-blue-50', pending: 'text-yellow-600 bg-yellow-50',
    locked: 'text-orange-700 bg-orange-50', confirmed: 'text-indigo-600 bg-indigo-50',
    ongoing: 'text-green-600 bg-green-50', settling: 'text-amber-700 bg-amber-50', completed: 'text-gray-500 bg-gray-100',
    cancelled: 'text-red-500 bg-red-50', bombed: 'text-orange-600 bg-orange-50', issue: 'text-purple-600 bg-purple-50',
  };
  const actorName = (id?: string | null) => actors.find(a => a.id === id)?.name || '';
  const actorGenderText = (actor?: Actor) => actor?.gender ? ` · ${actor.gender}` : '';
  const lockReasonText: Record<string, string> = {
    full_paid: '人齐定金齐',
    deposit_guaranteed: '定金担保',
    manual: '店家手动',
    other: '其他',
  };
  const paymentMethodText: Record<string, string> = {
    card: '扣卡',
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    coupon: '券',
    free: '免单',
    other: '其他',
    unknown: '未填',
  };
  const formatMoney = (cents?: number) => `¥${((Number(cents || 0)) / 100).toFixed(0)}`;

  function ProgressLine({ schedule }: { schedule: ScheduleWithDetails }) {
    const summary = schedule.progress_summary;
    if (!summary?.steps?.length) return null;
    return (
      <div className="mt-2 max-w-[500px]">
        <div className="flex flex-wrap gap-1.5">
          {summary.steps.map(step => (
            <div
              key={step.key}
              title={step.done ? `${step.label}已完成` : step.optional ? `${step.label}可选，未处理` : `${step.label}未完成`}
              className={`flex h-10 w-[58px] flex-col items-center justify-center rounded-lg border text-center leading-tight ${step.done
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : step.optional
                  ? 'border-slate-100 bg-slate-50 text-slate-400'
                  : 'border-slate-200 bg-white text-slate-500'}`}
            >
              <span className="text-[11px] font-medium">{step.label}</span>
              <span className="text-[10px]">{step.done ? '已完成' : step.optional ? '可选' : '未完成'}</span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-slate-500">
          <span className="rounded bg-slate-50 px-1.5 py-0.5">人数 {summary.boardedCount}/{summary.targetCount || '-'}</span>
          <span className="rounded bg-slate-50 px-1.5 py-0.5">定金 {summary.depositReady}/{summary.depositRequired}</span>
          <span className="rounded bg-slate-50 px-1.5 py-0.5">结算 {formatMoney(summary.finalTotal)}</span>
          {summary.avgRating !== null && <span className="rounded bg-slate-50 px-1.5 py-0.5">评分 {summary.avgRating}</span>}
        </div>
      </div>
    );
  }

  let carCounter = 0;
  function scheduleRow(s: ScheduleWithDetails, showActions: boolean) {
    const script = scripts.find(sc => sc.id === s.script_id);
    const sD = parseISO(s.start_time);
    const eD = parseISO(s.end_time);
    const dateStr = format(sD, 'yyyy-MM-dd');
    carCounter++;
    const carNum = `#${String(carCounter).padStart(3, '0')}`;
    const pendingRequestCount = s.pending_request_count || 0;
    const isOverdueUnfinished = eD.getTime() < Date.now() && !terminalStatuses.includes(s.status);
    const missingSteps = (s.progress_summary?.steps || []).filter(step => !step.done && !step.optional).map(step => step.label);
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
          {pendingRequestCount > 0 && (
            <button
              onClick={(e) => openQRModal(s, e)}
              className="mt-1 block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              拼车申请 {pendingRequestCount}
            </button>
          )}
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
          {s.status === 'locked' && s.lock_reason && (
            <div className="mt-1 text-[11px] text-orange-600">{lockReasonText[s.lock_reason] || s.lock_reason}</div>
          )}
          {isOverdueUnfinished && (
            <div className="mt-1.5 inline-flex max-w-[220px] items-center rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700" title={missingSteps.length > 0 ? `待补：${missingSteps.join('、')}` : '这车按时间已开完，但记录未补齐'}>
              已过时 · 待补记录
            </div>
          )}
          {!['cancelled', 'bombed', 'completed'].includes(s.status) && (
            <button onClick={(e) => openDmModal(s, e)} className="mt-1 block rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
              {s.dm_lock_status === 'confirmed'
                ? `指定卡司：${s.requested_dm_role_name || '角色'} · ${actorName(s.requested_dm_actor_id) || '已指定'}`
                : s.dm_lock_status === 'not_needed'
                  ? '指定卡司：不需要'
                  : '指定卡司'}
            </button>
          )}
          {s.status === 'scheduled' && (
            <button onClick={(e) => { e.stopPropagation(); openFinanceModal(s, e, 'deposit'); }} className="mt-1 block rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100">
              锁车 · 确认定金
            </button>
          )}
          <ProgressLine schedule={s} />
        </td>
        {showActions && (
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={(e) => { e.stopPropagation(); openEditModal(s); }} className="text-xs text-indigo-600 hover:underline">编辑</button>
              {pendingRequestCount > 0 && (
                <button onClick={(e) => openQRModal(s, e)} className="text-xs text-amber-600 hover:underline font-medium">处理申请</button>
              )}
              {s.status === 'scheduled' && (
                <button onClick={(e) => openFinanceModal(s, e, 'deposit')} className="text-xs text-orange-600 hover:underline font-medium">锁车</button>
              )}
              {s.status === 'locked' && (
                <button onClick={(e) => openFinanceModal(s, e, 'deposit')} className="text-xs text-amber-700 hover:underline">定金记录</button>
              )}
              {s.status === 'locked' && (
                <button onClick={(e) => openStartModal(s, e)} className="text-xs text-indigo-600 hover:underline font-medium">确认排班</button>
              )}
              {s.status === 'confirmed' && (
                <button onClick={(e) => openStartModal(s, e)} className="text-xs text-blue-600 hover:underline font-medium">确认开始</button>
              )}
              {s.status === 'ongoing' && (
                <button onClick={(e) => openEndModal(s, e)} className="text-xs text-green-600 hover:underline font-medium">收尾确认</button>
              )}
              {s.status === 'settling' && (
                <button onClick={(e) => openFinanceModal(s, e, 'settlement')} className="text-xs text-emerald-700 hover:underline font-medium">结算</button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  }

  const depositRequiredCount = financeRows.filter(r => !['waived', 'refunded'].includes(r.deposit_status || '')).length;
  const depositReadyCount = financeRows.filter(r => ['paid', 'waived'].includes(r.deposit_status || '')).length;
  const canLockFinanceSchedule = financeRows.length > 0 && depositReadyCount >= Math.max(1, depositRequiredCount);
  const financeSlots = financeSchedule
    ? [
      ...financeRows.map(row => ({ kind: 'player' as const, row })),
      ...Array.from({ length: Math.max(0, Number(financeSchedule.progress_summary?.targetCount || financeRows.length || 0) - financeRows.length) }, (_, index) => ({ kind: 'empty' as const, id: `empty-${index}` })),
    ]
    : [];
  const avatarText = (name?: string) => (name || '空').trim().slice(0, 1).toUpperCase();

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

      {!showEnded && currentStore && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">锁车规则</p>
              <p className="mt-1 text-xs text-amber-700">定金在锁车前确认。默认定金用于快速填入每个玩家的定金金额，特殊玩家可在弹窗内单独修改。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-amber-700">默认定金</span>
              <input
                type="number"
                min="0"
                value={defaultDepositDraft}
                onChange={e => setDefaultDepositDraft(e.target.value)}
                className="w-24 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
              <span className="text-xs text-amber-700">元/人</span>
              <button
                type="button"
                onClick={saveDepositSetting}
                disabled={loading}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
          {depositSettingMsg && <p className="mt-2 text-xs text-amber-700">{depositSettingMsg}</p>}
        </div>
      )}

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
                <th className="text-left px-4 py-3 text-gray-500 font-medium">车次</th>
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
                  <td colSpan={10} className="text-center py-10 text-gray-400">
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
                  const pendingRequestCount = s.pending_request_count || 0;
                  carCounter++;
                  const cn = `#${String(carCounter).padStart(3, '0')}`;
                  return (<tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{cn}</span></td>
                    <td className="px-4 py-3 text-gray-800">{format(sd, 'M/d')}</td>
                    <td className="px-4 py-3 text-gray-500">{format(sd, 'EEEE', { locale: zhCN })}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600">{sc?.dm_gender || '未分类'}</span></td>
                    <td className="px-4 py-3 text-gray-800">{format(sd, 'HH:mm')}-{format(ed, 'HH:mm')}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{sc?.name || '未知剧本'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.room_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{s.player_count || '-'}人</span>
                      {pendingRequestCount > 0 && (
                        <button
                          onClick={(e) => openQRModal(s, e)}
                          className="mt-1 block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        >
                          拼车申请 {pendingRequestCount}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${stColor[s.status] || 'bg-gray-100 text-gray-500'}`}>{stText[s.status] || s.status}</span>
                      <ProgressLine schedule={s} />
                    </td>
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
        onChanged={loadData}
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

      {showDmModal && dmSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">指定 DM</h3>
                <p className="mt-1 text-sm text-gray-500">{dmSchedule.script_name || scripts.find(s => s.id === dmSchedule.script_id)?.name || '未知剧本'} · {format(parseISO(dmSchedule.start_time), 'M/d HH:mm')}</p>
              </div>
              <button onClick={() => setShowDmModal(false)} className="text-sm text-gray-400 hover:text-gray-600">关闭</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">指定哪个卡司角色</label>
                <select value={dmRoleName} onChange={e => setDmRoleName(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="">请选择卡司角色</option>
                  {(dmSchedule.actor_roles || []).map(role => <option key={role.name} value={role.name}>{role.name}{role.gender ? ` · ${role.gender}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">由哪个 DM/卡司扮演</label>
                <select value={dmActorId} onChange={e => setDmActorId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="">请选择 DM/卡司</option>
                  {actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}{actorGenderText(actor)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">扣哪个玩家的锁卡司次数</label>
                <select value={dmCustomerId} onChange={e => setDmCustomerId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="">请选择本车玩家</option>
                  {(dmSchedule.checkins || []).filter(item => item.customer_id).map(item => (
                    <option key={item.customer_id || item.id} value={item.customer_id || ''}>{item.guest_name || item.customer?.name || '未命名玩家'} · {item.role || '未选角色'} · 剩余{item.lock_dm_credits ?? item.customer?.lock_dm_credits ?? 0}次</option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                保存后会扣除所选玩家 1 次锁卡司次数，并记录“哪个卡司扮演哪个角色”；清除或标记不需要会退回本次已扣次数。
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={() => saveDmAssignment('clear')} disabled={dmSaving} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">清除并退回次数</button>
                <button onClick={() => saveDmAssignment('not_needed')} disabled={dmSaving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">不需要指定卡司</button>
                <button onClick={() => saveDmAssignment('assign')} disabled={dmSaving || !dmActorId || !dmRoleName || !dmCustomerId} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">保存并扣次数</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFinanceModal && financeSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-2xl w-full mx-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{financeMode === 'deposit' ? '定金锁车' : '完车结算'}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {financeSchedule.script_name || scripts.find(s => s.id === financeSchedule.script_id)?.name || '未知剧本'} · {format(parseISO(financeSchedule.start_time), 'M/d HH:mm')}
                </p>
              </div>
              <button onClick={() => setShowFinanceModal(false)} className="text-sm text-gray-400 hover:text-gray-600">关闭</button>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                <p className="text-[11px] text-slate-500">人数</p>
                <p className="text-sm font-semibold text-slate-900">{financeSchedule.progress_summary?.boardedCount || 0}/{financeSchedule.progress_summary?.targetCount || '-'}</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5">
                <p className="text-[11px] text-amber-700">定金</p>
                <p className="text-sm font-semibold text-amber-900">{financeSchedule.progress_summary?.depositReady || 0}/{financeSchedule.progress_summary?.depositRequired || 0}</p>
              </div>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1.5">
                <p className="text-[11px] text-indigo-700">收款</p>
                <p className="text-sm font-semibold text-indigo-900">¥{financeRows.reduce((sum, r) => sum + Number(r.final_amount || 0), 0)}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5">
                <p className="text-[11px] text-emerald-700">结算</p>
                <p className="text-sm font-semibold text-emerald-900">{financeRows.filter(r => r.settlement_status === 'settled').length}/{financeRows.length}</p>
              </div>
            </div>

            {financeRows.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">这车还没有上车玩家，先通过拼车加入或客服代填上车。</div>
            ) : (
              <div className="space-y-2">
                {financeRows.map((row, index) => (
                  <div key={row.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${row.deposit_status === 'paid' ? 'bg-amber-500 text-white' : row.deposit_status === 'refunded' ? 'bg-slate-200 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
                          {avatarText(row.guest_name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{row.guest_name || '未命名'} <span className="text-xs font-normal text-slate-400">{row.role || '-'}</span></p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            定金 {row.deposit_status === 'paid' ? `已收 ¥${row.deposit_amount || 0}` : row.deposit_status === 'waived' ? '免定金' : row.deposit_status === 'refunded' ? '已退' : '未收'} · 结算 {row.settlement_status === 'settled' ? '已结' : '待结'}
                          </p>
                        </div>
                      </div>
                      {financeMode === 'settlement' && (
                        <button
                          type="button"
                          onClick={() => setFinanceRows(rows => rows.map((r, i) => i === index ? { ...r, settlement_status: r.settlement_status === 'settled' ? 'unsettled' : 'settled' } : r))}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${row.settlement_status === 'settled' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {row.settlement_status === 'settled' ? '已结清' : '标记结清'}
                        </button>
                      )}
                    </div>

                    {financeMode === 'deposit' ? (
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[192px_92px_132px_96px] md:items-center">
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            ['unpaid', '未收'],
                            ['paid', '已收'],
                            ['waived', '免定金'],
                            ['refunded', '已退'],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setFinanceRows(rows => rows.map((r, i) => i === index ? { ...r, deposit_status: value } : r))}
                              className={`rounded-lg px-1.5 py-1.5 text-xs font-medium ${row.deposit_status === value ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={row.deposit_amount}
                          onChange={e => setFinanceRows(rows => rows.map((r, i) => i === index ? { ...r, deposit_amount: e.target.value } : r))}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                          placeholder="金额"
                        />
                        <input
                          type="text"
                          value={row.deposit_payer_name || ''}
                          onChange={e => setFinanceRows(rows => rows.map((r, i) => i === index ? { ...r, deposit_payer_name: e.target.value } : r))}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                          placeholder="付款人"
                        />
                        <button
                          type="button"
                          onClick={() => setFinanceRows(rows => rows.map(r => ({
                            ...r,
                            deposit_status: 'paid',
                            deposit_amount: Number(r.deposit_amount || defaultDepositAmount),
                            deposit_payer_name: row.guest_name || row.deposit_payer_name || '车头',
                          })))}
                          className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                        >
                          代付全车
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            ['deduct_final', '定金抵尾款'],
                            ['refund_after_full', '全款后退定金'],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setFinanceRows(rows => rows.map((r, i) => i === index ? { ...r, deposit_settlement_mode: value } : r))}
                              className={`rounded-lg px-3 py-2 text-xs font-medium ${row.deposit_settlement_mode === value ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_1fr]">
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">{row.deposit_settlement_mode === 'refund_after_full' ? '全款实收' : '补齐尾款'}</label>
                            <input
                              type="number"
                              min="0"
                              value={row.final_amount}
                              onChange={e => setFinanceRows(rows => rows.map((r, i) => i === index ? { ...r, final_amount: e.target.value } : r))}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              placeholder={row.deposit_settlement_mode === 'refund_after_full' ? '全款' : '尾款'}
                            />
                          </div>
                          <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
                          {[
                            ['card', '扣卡'],
                            ['cash', '现金'],
                            ['wechat', '微信'],
                            ['alipay', '支付宝'],
                            ['coupon', '券'],
                            ['free', '免单'],
                            ['other', '其他'],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setFinanceRows(rows => rows.map((r, i) => i === index ? { ...r, final_payment_method: value, settlement_status: value === 'free' ? 'settled' : r.settlement_status } : r))}
                              className={`rounded-lg px-2 py-2 text-xs font-medium ${row.final_payment_method === value ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                            >
                              {label}
                            </button>
                          ))}
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">
                          {row.deposit_settlement_mode === 'refund_after_full'
                            ? '先按全款完成结算，标记结清后这笔定金会记录为已退。'
                            : '默认用已收定金抵扣总价，这里只填补齐的尾款。'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                {financeMode === 'deposit' && financeSlots.filter(slot => slot.kind === 'empty').map(slot => (
                  <div key={(slot as any).id} className="rounded-lg border border-dashed border-slate-200 p-4">
                    <div className="flex items-center gap-3 text-slate-400">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-sm font-bold">空</div>
                      <div>
                        <p className="font-medium">待上车玩家</p>
                        <p className="mt-1 text-xs">玩家上车后会在这里确认定金。</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={() => setShowFinanceModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={() => saveFinanceRows(false)} disabled={financeSaving} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">{financeMode === 'deposit' ? '保存定金' : '保存结算'}</button>
              {financeMode === 'deposit' && financeSchedule.status === 'scheduled' && (
                <button onClick={saveDepositAndLock} disabled={financeSaving || !canLockFinanceSchedule} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">定金交齐，确认锁车</button>
              )}
              {financeMode === 'settlement' && (
                <button onClick={() => saveFinanceRows(true)} disabled={financeSaving || financeRows.length === 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">完成整车结算</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 确认开始弹窗 */}
      {showStartModal && startingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">开本前确认</h3>
            <p className="mt-1 text-sm text-gray-500">确认玩家角色、卡司角色分配和实际开本时间后，再进入进行中。</p>
            <div className="mt-5 space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">1. 核对玩家选择的角色</label>
                <div className="grid gap-2 md:grid-cols-2">
                  {(startingSchedule.checkins || []).length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">这车还没有玩家上车记录，请先处理上车角色。</div>
                  ) : (startingSchedule.checkins || []).map(item => (
                    <div key={item.id || `${item.guest_name}-${item.role}`} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                      <span className="font-medium text-gray-900">{item.guest_name || item.customer?.name || '未命名玩家'}</span>
                      <span className="ml-2 text-gray-500">选择角色：{item.role || '未填写'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">2. 确认 DM/卡司扮演的卡司角色</label>
                <div className="space-y-2">
                  {startActors.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">这个剧本还没有配置卡司角色。</div>
                  ) : startActors.map((row, index) => (
                    <div key={row.roleName || index} className="grid gap-2 rounded-lg border border-gray-100 bg-white p-3 md:grid-cols-[1fr,2fr] md:items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{row.roleName}</div>
                        {startingSchedule.requested_dm_role_name === row.roleName && <div className="mt-1 text-xs text-indigo-600">已指定卡司角色</div>}
                      </div>
                      <select value={row.actorId} onChange={e => setStartActors(startActors.map((item, i) => i === index ? { ...item, actorId: e.target.value } : item))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <option value="">请选择扮演卡司/DM</option>
                        {actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}{actorGenderText(actor)}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">3. 实际开本时间</label>
                <input type="time" value={actualStartTime} onChange={e => setActualStartTime(e.target.value)} className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button onClick={() => setShowStartModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleStartConfirm} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">确认开本</button>
            </div>
          </div>
        </div>
      )}

      {/* 收尾确认弹窗 */}
      {showEndModal && endingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">本车收尾确认</h3>
            <p className="mt-1 text-sm text-gray-500">记录本车开本结果、玩家评价和补充说明。结算收款仍在下一步单独处理。</p>
            <section className="mt-5 rounded-xl border border-gray-100 p-4">
              <h4 className="text-sm font-semibold text-gray-900">1. 选择本车结果</h4>
              <label className={`mt-3 flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${endType === 'normal' ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                <input type="radio" name="endType" value="normal" checked={endType === 'normal'} onChange={e => setEndType(e.target.value)} className="mt-0.5" />
                <div><span className="text-sm font-medium text-gray-900">✅ 正常开完</span><p className="text-xs text-gray-400">剧本顺利开完，准备收评价和结算</p></div>
              </label>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { value: 'bomb', label: '💥 炸车', desc: '开本中途终止' },
                  { value: 'flow', label: '🚫 流车', desc: '未成功开本' },
                  { value: 'other', label: '❓ 其他问题', desc: '设备/客诉等' },
                ].map(opt => (
                  <label key={opt.value} className={`flex flex-col items-center gap-1 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 text-center ${endType === opt.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'}`}>
                    <input type="radio" name="endType" value={opt.value} checked={endType === opt.value} onChange={e => setEndType(e.target.value)} className="sr-only" />
                    <span className="text-lg">{opt.label.split(' ')[0]}</span>
                    <span className="text-xs font-medium text-gray-900">{opt.label.replace(/^\S+\s*/, '')}</span>
                    <span className="text-[10px] text-gray-400">{opt.desc}</span>
                  </label>
                ))}
              </div>
              {endType === 'flow' && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  流车前必须先确认所有已收定金都已退款。若还有玩家定金状态为“已收”，系统会拒绝确认流车。
                </div>
              )}
            </section>
            <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-center">
              <h4 className="text-sm font-semibold text-blue-900">2. 玩家评价</h4>
              <p className="mt-1 text-xs text-blue-600">让玩家扫码评价本次体验，也可以复制链接发到群里。</p>
              <div className="mt-3 inline-block rounded-lg bg-white p-3">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/evaluate/' + endingSchedule.id)}`} alt="评价二维码" className="w-36 h-36" />
              </div>
              <button onClick={() => navigator.clipboard.writeText(window.location.origin + '/evaluate/' + endingSchedule.id)} className="mt-2 block w-full text-xs text-blue-600 hover:underline">复制评价链接</button>
            </section>
            <section className="mt-4 rounded-xl border border-gray-100 p-4">
              <h4 className="text-sm font-semibold text-gray-900">3. 补充记录</h4>
              <textarea value={endNote} onChange={e => setEndNote(e.target.value)} placeholder="备注说明（可选）" className="mt-3 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm h-16 resize-none focus:outline-none focus:border-indigo-400" />
              {!showConflict ? (
                <button onClick={() => setShowConflict(true)} className="mt-3 w-full py-2 border border-dashed border-red-300 text-red-500 rounded-lg text-sm hover:bg-red-50 transition-colors">有异常或矛盾需要记录</button>
              ) : (
                <div className="mt-3 bg-red-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between"><span className="text-sm font-medium text-red-800">异常 / 矛盾记录</span><button onClick={() => setShowConflict(false)} className="text-xs text-gray-400 hover:text-gray-600">收起</button></div>
                  <select value={conflictType} onChange={e => setConflictType(e.target.value)} className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm">
                    <option value="service_attitude">服务态度</option>
                    <option value="performance">演绎效果</option>
                    <option value="communication">沟通问题</option>
                    <option value="other_conflict">其他</option>
                  </select>
                  <textarea value={conflictDesc} onChange={e => setConflictDesc(e.target.value)} placeholder="描述异常或矛盾情况..." className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm h-16 resize-none focus:outline-none" />
                </div>
              )}
            </section>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowEndModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleEndSubmit} disabled={endSubmitting} className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">{endSubmitting ? '处理中...' : '确认收尾'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
