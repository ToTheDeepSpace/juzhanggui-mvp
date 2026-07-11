import { useState, useEffect } from 'react';
import type { LingqiCommissionMaster, ScheduleExternalNpc, ScheduleLingqiCommission, ScheduleWithDetails, ScheduleFormData, SelectedActor } from '../types/schedule';
import type { Script, Actor, Room, ScriptBoardRole } from '../types';
import CheckInRoles from './CheckInRoles';
import { uploadImageFile } from '../utils/imageUpload';

interface ScheduleCalendarModalProps {
  visible: boolean;
  editingSchedule: ScheduleWithDetails | null;
  isPendingMode: boolean;
  scripts: Script[];
  rooms: Room[];
  actors: Actor[];
  lingqiMasters: LingqiCommissionMaster[];
  formData: ScheduleFormData;
  selectedActors: SelectedActor[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
  onFormDataChange: (data: ScheduleFormData) => void;
  onSelectedActorsChange: (actors: SelectedActor[]) => void;
  onKickGuest: (guestName: string, role: string) => void;
  onOpenQRModal: (e: React.MouseEvent) => void;
}

export default function ScheduleCalendarModal({
  visible,
  editingSchedule,
  scripts,
  rooms,
  actors,
  lingqiMasters,
  formData,
  selectedActors,
  loading,
  onClose,
  onSubmit,
  onDelete,
  onFormDataChange,
  onSelectedActorsChange,
  onKickGuest,
  onOpenQRModal,
}: ScheduleCalendarModalProps) {
  const selectedScript = scripts.find(s => s.id === formData.scriptId);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [npcUploadingIndex, setNpcUploadingIndex] = useState<number | null>(null);
  const selectedActorIds = selectedActors.map(a => a.actorId).filter(Boolean).join(',');
  const allActorRoleDetails = selectedScript?.actor_role_details?.length
    ? selectedScript.actor_role_details
    : (selectedScript?.actor_roles || []).map(name => ({ name, role_kind: 'dm' }));
  const parseDisplayRole = (roleText: string): ScriptBoardRole => {
    const match = String(roleText || '').match(/^(.+?)\s*\((.*?)\)$/);
    return {
      role_name: match ? match[1].trim() : String(roleText || '').trim(),
      gender: match?.[2]?.trim() || '',
    };
  };
  const normalizeRoleVersion = (role: any): ScriptBoardRole => ({
    role_name: String(typeof role === 'string' ? role : role?.role_name || role?.name || '').trim(),
    gender: typeof role === 'string' ? '' : role?.gender || '',
    role_kind: typeof role === 'string' ? undefined : role?.role_kind || role?.kind,
  });
  const roleVersionLabel = (role: ScriptBoardRole) => `${role.role_name}${role.gender && role.gender !== '未指定' ? `(${role.gender})` : ''}`;
  const roleSetKey = (roles: any[]) => roles
    .map(normalizeRoleVersion)
    .filter(role => role.role_name)
    .map(role => `${role.role_name.trim().toLowerCase()}@${role.gender || ''}`)
    .sort()
    .join('|');
  const boardRoles = (board: any) => (board?.roles || []).map(normalizeRoleVersion).filter(role => role.role_name);
  const boardPlayerRoles = (board: any) => (board?.player_roles || []).map(normalizeRoleVersion).filter(role => role.role_name);
  const defaultBoard = selectedScript?.boards?.find(board => board.is_default) || selectedScript?.boards?.[0] || null;
  const allPlayerRoleDetails = (selectedScript?.player_roles || []).map(parseDisplayRole).filter(role => role.role_name);
  const fallbackActorRoleSelection = defaultBoard
    ? boardRoles(defaultBoard)
    : allActorRoleDetails.map(role => ({ role_name: role.name, gender: role.gender || '', role_kind: role.role_kind || 'dm' }));
  const fallbackPlayerRoleSelection = defaultBoard ? boardPlayerRoles(defaultBoard) : allPlayerRoleDetails;
  const selectedActorRoleVersions = (formData.actorRoleSelection || []).length
    ? formData.actorRoleSelection.map(normalizeRoleVersion).filter(role => role.role_name)
    : fallbackActorRoleSelection;
  const selectedPlayerRoleVersions = (formData.playerRoleSelection || []).length
    ? formData.playerRoleSelection.map(normalizeRoleVersion).filter(role => role.role_name)
    : fallbackPlayerRoleSelection;
  const selectedRoleKey = roleSetKey(selectedActorRoleVersions);
  const selectedPlayerRoleKey = roleSetKey(selectedPlayerRoleVersions);
  const matchedBoard = selectedScript?.boards?.find(board => roleSetKey(boardRoles(board)) === selectedRoleKey && roleSetKey(boardPlayerRoles(board)) === selectedPlayerRoleKey) || null;
  const actorRoles = selectedActorRoleVersions.map(role => role.role_name).filter(roleName => allActorRoleDetails.some(role => role.name === roleName));
  const actorVersionByName = new Map(selectedActorRoleVersions.map(role => [role.role_name, role]));

  const rowsForRoles = (roleVersions: ScriptBoardRole[]) => {
    const existingByRole = new Map(selectedActors.map(row => [row.roleName, row]));
    return roleVersions.map(role => ({
      actorId: existingByRole.get(role.role_name)?.actorId || '',
      roleName: role.role_name,
      startOffset: existingByRole.get(role.role_name)?.startOffset || 0,
      duration: existingByRole.get(role.role_name)?.duration || selectedScript?.duration || 240,
    }));
  };

  const selectRoleVersions = (roleVersions: ScriptBoardRole[], playerRoleVersions = selectedPlayerRoleVersions) => {
    const normalizedActorRoles = roleVersions.map(normalizeRoleVersion).filter(role => role.role_name);
    const normalizedPlayerRoles = playerRoleVersions.map(normalizeRoleVersion).filter(role => role.role_name);
    const nextKey = roleSetKey(normalizedActorRoles);
    const nextPlayerKey = roleSetKey(normalizedPlayerRoles);
    const board = selectedScript?.boards?.find(item => roleSetKey(boardRoles(item)) === nextKey && roleSetKey(boardPlayerRoles(item)) === nextPlayerKey) || null;
    onFormDataChange({
      ...formData,
      actorRoleSelection: normalizedActorRoles,
      playerRoleSelection: normalizedPlayerRoles,
      scriptBoardId: board?.id || '',
    });
    onSelectedActorsChange(rowsForRoles(normalizedActorRoles));
  };

  const handleScriptChange = (scriptId: string) => {
    const script = scripts.find(item => item.id === scriptId);
    const board = script?.boards?.find(item => item.is_default) || script?.boards?.[0] || null;
    const roleVersions = board
      ? boardRoles(board)
      : (script?.actor_role_details?.length
        ? script.actor_role_details.map(role => ({ role_name: role.name, gender: role.gender || '', role_kind: role.role_kind || 'dm' }))
        : (script?.actor_roles || []).map(parseDisplayRole));
    const playerRoleVersions = board ? boardPlayerRoles(board) : (script?.player_roles || []).map(parseDisplayRole);
    onFormDataChange({
      ...formData,
      scriptId,
      scriptBoardId: board?.id || '',
      actorRoleSelection: roleVersions,
      playerRoleSelection: playerRoleVersions,
    });
    onSelectedActorsChange(roleVersions.map(role => ({ actorId: '', roleName: role.role_name, startOffset: 0, duration: script?.duration || 240 })));
  };

  // 冲突检测
  useEffect(() => {
    if (!formData.roomId && !selectedActorIds) {
      setConflicts([]);
      return;
    }
    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      if (formData.roomId) params.set('roomId', formData.roomId);
      if (selectedActorIds) params.set('actorIds', selectedActorIds);
      if (editingSchedule?.id) params.set('excludeId', editingSchedule.id);
      if (formData.date) params.set('date', formData.date);
      params.set('startTime', formData.startTime);
      const dur = selectedScript?.duration || 240;
      const [startHour, startMinute] = formData.startTime.split(':').map(Number);
      const endTotal = startHour * 60 + startMinute + dur;
      const endHour = Math.floor((endTotal % 1440) / 60);
      const endMinute = endTotal % 60;
      params.set('endTime', `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`);
      try {
        const token = localStorage.getItem('admin_auth_token') || localStorage.getItem('auth_token');
        const r = await fetch(`/api/schedules/conflicts/check?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await r.json();
        setConflicts(d.success ? (d.data || []) : []);
      } catch { setConflicts([]); }
    }, 500);
    return () => clearTimeout(timer);
  }, [editingSchedule?.id, formData.roomId, formData.date, formData.startTime, selectedActorIds, selectedScript?.duration]);

  // 检查指定演员是否有冲突
  const hasConflict = (actorId: string) => conflicts.some((c: any) => c.type === 'actor' && c.id === actorId);

  const addActor = () => {
    onSelectedActorsChange([...selectedActors, { actorId: '', roleName: '', startOffset: 0, duration: 240 }]);
  };

  const updateActor = (index: number, field: keyof SelectedActor, value: string | number) => {
    const updated = [...selectedActors];
    updated[index] = { ...updated[index], [field]: value };
    onSelectedActorsChange(updated);
  };

  const removeActor = (index: number) => {
    onSelectedActorsChange(selectedActors.filter((_, i) => i !== index));
  };

  const playerRoles = selectedScript?.player_roles || [];

  const updateExternalNpc = (index: number, patch: Partial<ScheduleExternalNpc>) => {
    onFormDataChange({
      ...formData,
      externalNpcs: (formData.externalNpcs || []).map((row, i) => i === index ? { ...row, ...patch } : row),
    });
  };

  const addExternalNpc = () => {
    onFormDataChange({
      ...formData,
      externalNpcs: [...(formData.externalNpcs || []), { role_name: '', provided_by: '', note: '', photo_url: '', count_as_player: false, count_in_settlement: false }],
    });
  };

  const removeExternalNpc = (index: number) => {
    onFormDataChange({ ...formData, externalNpcs: (formData.externalNpcs || []).filter((_, i) => i !== index) });
  };

  const uploadExternalNpcPhoto = async (index: number, file?: File | null) => {
    if (!file) return;
    setNpcUploadingIndex(index);
    try {
      const url = await uploadImageFile(file, 'external_npc');
      updateExternalNpc(index, { photo_url: url });
    } catch (error) {
      alert(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setNpcUploadingIndex(null);
    }
  };

  const addLingqiCommission = (profileId: string) => {
    const master = lingqiMasters.find(item => item.id === profileId);
    if (!master) return;
    const exists = (formData.lingqiCommissions || []).some(row => row.lc_profile_id === profileId);
    if (exists) return;
    onFormDataChange({
      ...formData,
      lingqiCommissions: [
        ...(formData.lingqiCommissions || []),
        {
          lc_profile_id: master.id,
          display_name: master.display_name,
          avatar_url: master.avatar || null,
          role_name: '',
          service_type: 'experience_support',
          status: 'pending',
          note: '',
        },
      ],
    });
  };

  const updateLingqiCommission = (index: number, patch: Partial<ScheduleLingqiCommission>) => {
    onFormDataChange({
      ...formData,
      lingqiCommissions: (formData.lingqiCommissions || []).map((row, i) => i === index ? { ...row, ...patch } : row),
    });
  };

  const removeLingqiCommission = (index: number) => {
    onFormDataChange({ ...formData, lingqiCommissions: (formData.lingqiCommissions || []).filter((_, i) => i !== index) });
  };

  const serviceTypeText: Record<string, string> = {
    experience_support: '体验协助',
    npc_support: 'NPC 协助',
    review_support: '复盘协助',
    host_support: '主持辅助',
  };
  const commissionStatusText: Record<string, string> = {
    pending: '待发起',
    invited: '已邀请',
    accepted: '已接受',
    confirmed: '已确认上车',
    cancelled: '已取消',
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[92vh] overflow-y-auto my-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">
            {editingSchedule ? '编辑排期' : '新建排期'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 剧本 + 房间 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                剧本 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.scriptId}
                onChange={(e) => handleScriptChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">选择剧本</option>
                {scripts.map((script) => (
                  <option key={script.id} value={script.id}>
                    {script.name} ({Math.round(script.duration / 60 * 10) / 10}h)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                房间 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.roomId}
                onChange={(e) => onFormDataChange({ ...formData, roomId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">选择房间</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
              {formData.roomId && conflicts.filter((c: any) => c.type === 'room').length > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  🔴 该房间此时段已有排期
                </p>
              )}
            </div>
          </div>

          {/* 日期 + 时间 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => onFormDataChange({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                开始时间 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => onFormDataChange({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-[160px_1fr] gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">本店同本第几车</label>
              <input
                type="number"
                min="1"
                value={formData.storeCarSequence}
                onChange={(e) => onFormDataChange({ ...formData, storeCarSequence: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="自动"
              />
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              不填时按本店同一剧本的历史排期自动计算；如果店家有自己的车次口径，可以在这里手动指定。
            </div>
          </div>


          {/* 客户自助上车 */}
          {editingSchedule && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-blue-900">客户自助上车</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    生成二维码让客户扫码填写信息、选择角色
                  </p>
                  <CheckInRoles
                    scheduleId={editingSchedule.id}
                    playerRoles={playerRoles}
                    onKickGuest={(guestName, role) => onKickGuest(guestName, role)}
                  />
                </div>
                <button
                  type="button"
                  onClick={onOpenQRModal}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 ml-4"
                >
                  生成二维码
                </button>
              </div>
            </div>
          )}

          {selectedScript && allActorRoleDetails.length > 0 && (
            <div className="border-t pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700">本场演绎角色</label>
                <span className={`rounded-full px-2 py-1 text-xs ${matchedBoard ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                  {matchedBoard ? `已匹配：${matchedBoard.name}` : '自定义组合'}
                </span>
              </div>
              {selectedScript.boards?.length ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedScript.boards.map((board, index) => (
                    <button
                      key={board.id || index}
                      type="button"
                      onClick={() => selectRoleVersions(boardRoles(board), boardPlayerRoles(board))}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${matchedBoard?.id === board.id ? 'border-purple-300 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {board.name || (index === 0 ? '标准版' : `板子${index + 1}`)} · 开本{board.player_count || selectedScript.player_count || '-'}人
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedPlayerRoleVersions.length > 0 && (
                <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                  <p className="mb-1 text-xs font-medium text-blue-700">本板子玩家角色条件</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPlayerRoleVersions.map(role => (
                      <span key={`${role.role_name}-${role.gender || ''}`} className="rounded-full bg-white px-2 py-0.5 text-xs text-blue-700">
                        {roleVersionLabel(role)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {allActorRoleDetails.map(role => {
                  const checked = selectedActorRoleVersions.some(selectedRole => selectedRole.role_name === role.name);
                  return (
                    <button
                      key={role.name}
                      type="button"
                      onClick={() => {
                        const next = checked
                          ? selectedActorRoleVersions.filter(selectedRole => selectedRole.role_name !== role.name)
                          : [...selectedActorRoleVersions, { role_name: role.name, gender: role.gender || '', role_kind: role.role_kind || 'dm' }];
                        selectRoleVersions(next);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm ${checked ? 'border-purple-300 bg-purple-100 text-purple-700' : 'border-gray-200 bg-white text-gray-500 hover:border-purple-200'}`}
                    >
                      {role.name}{role.gender && role.gender !== '未指定' ? `(${role.gender})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 卡司分配 */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">演绎分配</label>
              <button
                type="button"
                onClick={addActor}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                + 添加演绎
              </button>
            </div>

            {selectedActors.map((sa, index) => {
              const usedRoles = selectedActors
                .filter((_, i) => i !== index)
                .map(a => a.roleName)
                .filter(Boolean);
              const availableRoles = actorRoles.filter(role =>
                !usedRoles.includes(role) || role === sa.roleName
              );

              return (
                <div key={index} className="flex items-center gap-3 mb-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <select
                      value={sa.actorId}
                      onChange={(e) => updateActor(index, 'actorId', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg ${sa.actorId && hasConflict(sa.actorId) ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    >
                      <option value="">选择卡司</option>
                      {actors.map((actor) => (
                        <option key={actor.id} value={actor.id}>{actor.name}</option>
                      ))}
                    </select>
                    {sa.actorId && hasConflict(sa.actorId) && (
                      <p className="text-xs text-red-500 mt-1">🔴 该卡司此时段有冲突</p>
                    )}
                  </div>
                  <select
                    value={sa.roleName}
                    onChange={(e) => updateActor(index, 'roleName', e.target.value)}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={!formData.scriptId}
                  >
                    <option value="">
                      {formData.scriptId
                        ? (actorRoles.length > 0 ? '选择角色' : '无角色配置')
                        : '请先选择剧本'}
                    </option>
                    {availableRoles.map((role) => (
                      <option key={role} value={role}>{roleVersionLabel(actorVersionByName.get(role) || { role_name: role })}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeActor(index)}
                    className="px-3 py-2 text-red-500 border border-red-300 rounded-lg hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              );
            })}
          </div>

          {/* 玩家角色展示 */}
          {selectedScript && playerRoles.length > 0 && (
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                候选玩家角色 ({playerRoles.length}个)
              </label>
              <div className="flex flex-wrap gap-2">
                {playerRoles.map((role, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-gray-700">外带 NPC</label>
              <button type="button" onClick={addExternalNpc} className="text-sm text-blue-500 hover:text-blue-700">+ 添加 NPC</button>
            </div>
            <div className="space-y-2">
              {(formData.externalNpcs || []).map((npc, index) => (
                <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      value={npc.role_name}
                      onChange={(e) => updateExternalNpc(index, { role_name: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="角色名，如 伯纳德"
                    />
                    <input
                      value={npc.provided_by || ''}
                      onChange={(e) => updateExternalNpc(index, { provided_by: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="由谁自带"
                    />
                    <button type="button" onClick={() => removeExternalNpc(index)} className="px-3 py-2 text-sm text-red-500 hover:text-red-700">删除</button>
                  </div>
                  <div className="mt-2 grid grid-cols-[auto_1fr] gap-3">
                    <div className="flex items-center gap-2">
                      {npc.photo_url ? (
                        <img src={npc.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover border border-gray-200" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg border border-dashed border-gray-300 bg-white" />
                      )}
                      <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-white">
                        {npcUploadingIndex === index ? '上传中' : '可选照片'}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadExternalNpcPhoto(index, e.target.files?.[0])} disabled={npcUploadingIndex === index} />
                      </label>
                    </div>
                    <input
                      value={npc.note || ''}
                      onChange={(e) => updateExternalNpc(index, { note: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="备注，如 只参与某一幕、由玩家自带服装"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                    <label className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={!!npc.count_as_player} onChange={(e) => updateExternalNpc(index, { count_as_player: e.target.checked })} />
                      计入上车人数
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={!!npc.count_in_settlement} onChange={(e) => updateExternalNpc(index, { count_in_settlement: e.target.checked })} />
                      参与结算
                    </label>
                  </div>
                </div>
              ))}
              {(formData.externalNpcs || []).length === 0 && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">没有玩家自带 NPC 时可以不填。</p>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-gray-700">委托灵契师上车</label>
              <select
                value=""
                onChange={(e) => addLingqiCommission(e.target.value)}
                className="max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">选择灵契师</option>
                {lingqiMasters.map(master => (
                  <option key={master.id} value={master.id}>
                    {master.display_name}{master.city ? ` · ${master.city}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {(formData.lingqiCommissions || []).map((commission, index) => (
                <div key={`${commission.lc_profile_id || commission.display_name}-${index}`} className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                  <div className="flex items-center gap-3">
                    {commission.avatar_url ? (
                      <img src={commission.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border border-white" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-indigo-600">
                        {commission.display_name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{commission.display_name}</p>
                      <p className="text-xs text-indigo-600">{serviceTypeText[commission.service_type || 'experience_support'] || '体验协助'} · {commissionStatusText[commission.status || 'pending'] || commission.status}</p>
                    </div>
                    <button type="button" onClick={() => removeLingqiCommission(index)} className="text-sm text-red-500 hover:text-red-700">删除</button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input
                      value={commission.role_name || ''}
                      onChange={(e) => updateLingqiCommission(index, { role_name: e.target.value })}
                      className="px-3 py-2 border border-indigo-100 rounded-lg text-sm"
                      placeholder="上车职责/角色"
                    />
                    <select
                      value={commission.service_type || 'experience_support'}
                      onChange={(e) => updateLingqiCommission(index, { service_type: e.target.value })}
                      className="px-3 py-2 border border-indigo-100 rounded-lg text-sm"
                    >
                      <option value="experience_support">体验协助</option>
                      <option value="npc_support">NPC 协助</option>
                      <option value="review_support">复盘协助</option>
                      <option value="host_support">主持辅助</option>
                    </select>
                    <select
                      value={commission.status || 'pending'}
                      onChange={(e) => updateLingqiCommission(index, { status: e.target.value })}
                      className="px-3 py-2 border border-indigo-100 rounded-lg text-sm"
                    >
                      <option value="pending">待发起</option>
                      <option value="invited">已邀请</option>
                      <option value="accepted">已接受</option>
                      <option value="confirmed">已确认上车</option>
                      <option value="cancelled">已取消</option>
                    </select>
                  </div>
                  <input
                    value={commission.note || ''}
                    onChange={(e) => updateLingqiCommission(index, { note: e.target.value })}
                    className="mt-2 w-full px-3 py-2 border border-indigo-100 rounded-lg text-sm"
                    placeholder="委托备注，如出场幕次、互动边界、复盘要求"
                  />
                </div>
              ))}
              {(formData.lingqiCommissions || []).length === 0 && (
                <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-500">
                  可从剧幕录已开启服务的灵契师中选择，记录本车是否邀请、接受或确认上车。
                </p>
              )}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-between pt-4">
            {editingSchedule ? (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                删除
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
