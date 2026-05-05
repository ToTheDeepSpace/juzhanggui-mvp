import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { CheckInRecord } from '../hooks/useScheduleCheckins';

/**
 * 签到角色展示组件
 *
 * 使用方式 A（推荐）：数据由父组件轮询后传入，不自己轮询
 * <CheckInRoles checkins={checkins} playerRoles={roles} onKickGuest={...} />
 *
 * 使用方式 B（独立模式）：自己轮询（向后兼容）
 * <CheckInRoles scheduleId={id} playerRoles={roles} onKickGuest={...} />
 */
interface CheckInRolesProps {
  // 方式 A：由父组件注入数据（推荐）
  checkins?: CheckInRecord[];
  // 方式 B：独立轮询模式
  scheduleId?: string;
  playerRoles: string[];
  onKickGuest?: (guestName: string, role: string) => void;
}

export default function CheckInRoles({ checkins: injectedCheckins, scheduleId, playerRoles, onKickGuest }: CheckInRolesProps) {
  const { get } = useApi();
  const [localCheckins, setLocalCheckins] = useState<CheckInRecord[]>([]);

  // 只有在未注入数据时才自己轮询（向后兼容独立使用场景）
  useEffect(() => {
    if (injectedCheckins !== undefined) return;
    if (!scheduleId) return;

    const fetchCheckins = async () => {
      const res = await get<CheckInRecord[]>(`/schedules/${scheduleId}/checkins`);
      if (res.success) setLocalCheckins(res.data || []);
    };
    fetchCheckins();
    const interval = setInterval(fetchCheckins, 3000);
    return () => clearInterval(interval);
  }, [scheduleId, get, injectedCheckins]);

  const checkins = injectedCheckins !== undefined ? injectedCheckins : localCheckins;

  const roleMap = new Map<string, { id?: string; name: string; avatar?: string }>();
  checkins.forEach(c => {
    if (c.role) {
      roleMap.set(c.role, { id: c.id, name: c.guest_name, avatar: c.guest_avatar });
    }
  });

  return (
    <div className="mt-3">
      <p className="text-sm text-blue-700 mb-2">
        已上车 {checkins.length}/{playerRoles.length} 人
      </p>
      <div className="flex flex-wrap gap-3">
        {playerRoles.map((role) => {
          const occupant = roleMap.get(role);
          return (
            <div key={role} className="flex flex-col items-center group relative">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-lg relative ${
                  occupant
                    ? 'bg-blue-500 text-white cursor-pointer hover:bg-red-500 transition-colors'
                    : 'bg-gray-200 text-gray-400 border-2 border-dashed border-gray-300'
                }`}
                onClick={() => occupant && onKickGuest?.(occupant.name, role)}
                title={occupant ? `点击踢出 ${occupant.name}` : '空位'}
              >
                {occupant?.avatar ? (
                  <img src={occupant.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  occupant?.name?.[0] || '?'
                )}
                {occupant && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                  </div>
                )}
              </div>
              <span className="text-xs text-blue-600 mt-1">{role}</span>
              {occupant && <span className="text-xs text-gray-500">{occupant.name}</span>}
            </div>
          );
        })}
      </div>
      {onKickGuest && checkins.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">点击头像可踢出客人</p>
      )}
    </div>
  );
}
