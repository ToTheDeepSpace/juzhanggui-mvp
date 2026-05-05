import type { Schedule, ScheduleActor } from '../types';

/** 角色信息 */
export interface RoleInfo {
  name: string;
  gender?: string;
}

/** 签到信息 */
export interface CheckinInfo {
  role: string;
  gender?: string;
}

/** 带签到详情的排期 */
export interface ScheduleWithDetails extends Schedule {
  actors?: ScheduleActor[];
  player_roles?: RoleInfo[];
  checkin_count?: number;
  checkins?: CheckinInfo[];
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
