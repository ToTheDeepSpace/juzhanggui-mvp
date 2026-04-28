import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from './useApi';

export interface CheckInRecord {
  id?: string;
  guest_name: string;
  role?: string;
  guest_avatar?: string;
}

export interface ScheduleCheckInData {
  checkins: CheckInRecord[];
  count: number;
}

/**
 * 签到数据轮询 hook
 * 统一管理 schedule 的签到数据获取，避免重复轮询
 *
 * 使用方式：
 * const { checkins, count, refresh } = useScheduleCheckins(scheduleId);
 */
export function useScheduleCheckins(scheduleId: string | undefined) {
  const { get } = useApi();
  const [checkins, setCheckins] = useState<CheckInRecord[]>([]);
  const [count, setCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCheckins = useCallback(async () => {
    if (!scheduleId) return;
    const res = await get<ScheduleCheckInData>(`/schedules/${scheduleId}/checkins`);
    if (res.success) {
      const list = res.data?.checkins || [];
      setCheckins(list);
      setCount(res.data?.count ?? list.length);
    }
  }, [scheduleId, get]);

  useEffect(() => {
    if (!scheduleId) return;
    // 立即请求一次
    fetchCheckins();
    // 之后每 3 秒轮询
    intervalRef.current = setInterval(fetchCheckins, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [scheduleId, fetchCheckins]);

  const refresh = useCallback(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  return { checkins, count, refresh };
}
