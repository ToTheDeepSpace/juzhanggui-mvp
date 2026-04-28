import type { Schedule, ScheduleActor } from '../types';

/** 带签到详情的排期 */
export interface ScheduleWithDetails extends Schedule {
  actors?: ScheduleActor[];
  player_roles?: string;
  checkin_count?: number;
}

/** 排期表单数据 */
export interface ScheduleFormData {
  roomId: string;
  scriptId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  playerCount: string;
  note: string;
}

/** 已选卡司行 */
export interface SelectedActor {
  actorId: string;
  roleName: string;
  startOffset: number;
  duration: number;
}

/** 签到角色 */
export interface CheckInRole {
  id?: string;
  guest_name: string;
  role?: string;
  guest_avatar?: string;
}
