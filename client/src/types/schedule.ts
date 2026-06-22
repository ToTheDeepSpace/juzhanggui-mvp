import type { Schedule, ScheduleActor, ScriptBoardRole } from '../types';

/** 角色信息 */
export interface RoleInfo {
  name: string;
  gender?: string;
  role_kind?: string;
}

/** 签到信息 */
export interface CheckinInfo {
  id?: string;
  guest_name?: string;
  guest_phone?: string | null;
  role: string;
  gender?: string;
  customer_id?: string | null;
  customer?: { id?: string; name?: string; phone?: string; lock_dm_credits?: number } | null;
  lock_dm_credits?: number;
  deposit_status?: 'unpaid' | 'paid' | 'waived' | 'refunded';
  deposit_amount?: number;
  deposit_payment_method?: string | null;
  deposit_settlement_mode?: 'deduct_final' | 'refund_after_full' | 'custom';
  final_amount?: number;
  final_payment_method?: string | null;
  settlement_status?: 'unsettled' | 'settled' | 'waived';
  settlement_note?: string | null;
}

export interface ScheduleProgressSummary {
  targetCount: number;
  boardedCount: number;
  isFull: boolean;
  depositRequired: number;
  depositReady: number;
  unsettledCount: number;
  settledCount: number;
  depositTotal: number;
  finalTotal: number;
  paymentBreakdown: Record<string, number>;
  evaluationCount: number;
  avgRating: number | null;
  steps: { key: string; label: string; done: boolean; optional?: boolean }[];
}

/** 带签到详情的排期 */
export interface ScheduleWithDetails extends Schedule {
  actors?: ScheduleActor[];
  player_roles?: RoleInfo[];
  actor_roles?: RoleInfo[];
  external_npcs?: ScheduleExternalNpc[];
  lingqi_commissions?: ScheduleLingqiCommission[];
  checkin_count?: number;
  checkins?: CheckinInfo[];
  pending_request_count?: number;
  positive_feedback_count?: number;
  progress_summary?: ScheduleProgressSummary;
}

/** 排期表单数据 */
export interface ScheduleFormData {
  roomId: string;
  scriptId: string;
  scriptBoardId: string;
  storeCarSequence: string;
  actorRoleSelection: ScriptBoardRole[];
  playerRoleSelection: ScriptBoardRole[];
  date: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  playerCount: string;
  note: string;
  externalNpcs: ScheduleExternalNpc[];
  lingqiCommissions: ScheduleLingqiCommission[];
}

/** 已选卡司行 */
export interface SelectedActor {
  actorId: string;
  roleName: string;
  startOffset: number;
  duration: number;
}

export interface ScheduleExternalNpc {
  id?: string;
  role_name: string;
  provided_by?: string | null;
  note?: string | null;
  photo_url?: string | null;
  count_as_player?: boolean;
  count_in_settlement?: boolean;
}

export interface ScheduleLingqiCommission {
  id?: string;
  lc_profile_id?: string | null;
  display_name: string;
  avatar_url?: string | null;
  role_name?: string | null;
  service_type?: string;
  status?: 'pending' | 'invited' | 'accepted' | 'confirmed' | 'cancelled' | string;
  note?: string | null;
}

export interface LingqiCommissionMaster {
  id: string;
  display_name: string;
  avatar?: string | null;
  city?: string | null;
  available_cities?: string[];
  role_type?: string | null;
  identity_roles?: string[];
  verified_dm?: boolean;
}

/** 签到角色 */
export interface CheckInRole {
  id?: string;
  guest_name: string;
  role?: string;
  guest_avatar?: string;
}
