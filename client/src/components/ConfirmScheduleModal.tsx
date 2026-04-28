import type { ScheduleWithDetails } from '../types/schedule';
import type { Room } from '../types';

interface ConfirmScheduleModalProps {
  schedule: ScheduleWithDetails | null;
  roomId: string;
  rooms: Room[];
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRoomChange: (roomId: string) => void;
}

export default function ConfirmScheduleModal({
  schedule,
  roomId,
  rooms,
  visible,
  onClose,
  onConfirm,
  onRoomChange,
}: ConfirmScheduleModalProps) {
  if (!visible || !schedule) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">确认排期</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            将 <span className="font-medium text-gray-900">{schedule.script_name}</span> 分配到房间：
          </p>
          <select
            value={roomId}
            onChange={(e) => onRoomChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">选择房间</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!roomId}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
