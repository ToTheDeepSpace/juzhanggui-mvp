import { format, parseISO } from 'date-fns';
import type { ScheduleWithDetails } from '../types/schedule';
import type { Script } from '../types';

interface PendingScheduleCardProps {
  schedule: ScheduleWithDetails;
  script?: Script;
  onEdit: (schedule: ScheduleWithDetails) => void;
  onConfirm: (schedule: ScheduleWithDetails) => void;
}

export default function PendingScheduleCard({
  schedule,
  script,
  onEdit,
  onConfirm,
}: PendingScheduleCardProps) {
  const playerRolesStr = schedule.player_roles || script?.player_roles || '';
  const playerRoles = Array.isArray(playerRolesStr) 
    ? playerRolesStr 
    : (playerRolesStr.trim() ? playerRolesStr.split(',').map(r => r.trim()).filter(r => r.length > 0) : []);
  const checkinCount = schedule.checkin_count || 0;
  const isFull = checkinCount >= playerRoles.length && playerRoles.length > 0;

  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isFull
          ? 'bg-red-50 border-2 border-red-400 hover:bg-red-100'
          : 'bg-orange-50 border border-orange-200 hover:bg-orange-100'
      }`}
      onClick={() => onEdit(schedule)}
    >
      <div className={`font-medium ${isFull ? 'text-red-900' : 'text-orange-900'}`}>
        {schedule.script_name}
      </div>
      <div className={`text-sm mt-1 ${isFull ? 'text-red-700' : 'text-orange-700'}`}>
        {format(parseISO(schedule.start_time), 'MM/dd HH:mm')}
      </div>
      {isFull ? (
        <>
          <div className="mt-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded text-center">
            已满 {checkinCount}/{playerRoles.length} 人，请排期
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(schedule);
            }}
            className="mt-2 w-full px-2 py-1 bg-green-500 text-white text-xs font-bold rounded hover:bg-green-600"
          >
            确认排期
          </button>
        </>
      ) : (
        <div className="text-xs text-orange-600 mt-1">
          待排期（{checkinCount}/{playerRoles.length} 人）
        </div>
      )}
    </div>
  );
}
