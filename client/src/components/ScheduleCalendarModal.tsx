import type { ScheduleWithDetails, ScheduleFormData, SelectedActor } from '../types/schedule';
import type { Script, Actor, Room } from '../types';
import CheckInRoles from './CheckInRoles';

interface ScheduleCalendarModalProps {
  visible: boolean;
  editingSchedule: ScheduleWithDetails | null;
  isPendingMode: boolean;
  scripts: Script[];
  rooms: Room[];
  actors: Actor[];
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
  isPendingMode,
  scripts,
  rooms,
  actors,
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
  const actorRoles = selectedScript?.actor_roles || [];

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">
            {editingSchedule ? '编辑排期' : (isPendingMode ? '新建待排期' : '新建确定排期')}
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
                onChange={(e) => onFormDataChange({ ...formData, scriptId: e.target.value })}
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
                房间 {isPendingMode && <span className="text-gray-400 font-normal">（车满后分配）</span>}
              </label>
              <select
                value={formData.roomId}
                onChange={(e) => onFormDataChange({ ...formData, roomId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={isPendingMode}
                required={!isPendingMode}
              >
                <option value="">{isPendingMode ? '待分配' : '选择房间'}</option>
                {!isPendingMode && rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
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

          {/* 待排期提示 */}
          {isPendingMode && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-700">
                <span className="font-medium">待排期模式：</span>只需确定剧本和时间，房间将在车满后分配。
              </p>
            </div>
          )}

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

          {/* 卡司分配 */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">卡司分配</label>
              <button
                type="button"
                onClick={addActor}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                + 添加卡司
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
                  <select
                    value={sa.actorId}
                    onChange={(e) => updateActor(index, 'actorId', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">选择卡司</option>
                    {actors.map((actor) => (
                      <option key={actor.id} value={actor.id}>{actor.name}</option>
                    ))}
                  </select>
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
                      <option key={role} value={role}>{role}</option>
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
