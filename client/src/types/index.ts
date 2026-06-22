export interface Role {
  name: string;
  gender?: string; // '男', '女', '其他', '未指定' 或自定义
  role_kind?: 'dm' | 'field_control' | 'npc' | 'assistant' | 'other' | string;
}

export interface ScriptBoardRole {
  role_name: string;
  gender?: string;
  role_kind?: string;
}

export interface ScriptBoard {
  id?: string;
  name: string;
  player_count?: number | null;
  notes?: string | null;
  is_default?: boolean;
  sort_order?: number;
  roles: ScriptBoardRole[];
  player_roles?: ScriptBoardRole[];
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  photo_url?: string | null;
}

export interface Actor {
  id: string;
  name: string;
  phone?: string;
  gender?: '男' | '女' | '可男可女' | string | null;
  photo_url?: string | null;
  lc_profile?: { id: string; display_name: string; role_type?: string; identity_roles?: string[]; verified_dm?: boolean; avatar?: string | null } | null;
}

export interface Script {
  id: string;
  name: string;
  script_type?: 'emotional' | 'comedy' | 'horror' | 'mechanism' | 'faction' | string | null;
  distribution_type?: 'city_limited' | 'boxed' | 'exclusive' | string | null;
  duration: number; // 为了向后兼容，实际值为min_duration
  min_duration: number;
  max_duration: number;
  dm_gender?: string;
  player_roles?: string[];
  actor_roles?: string[];
  actor_role_details?: { name: string; gender?: string; role_kind?: string }[];
  player_count?: number;
  role_count?: number;
  actor_count?: number;
  candidate_player_count?: number;
  player_selection_rule?: string | null;
  selection_summary?: string;
  boards?: ScriptBoard[];
}

export interface StoreRecord {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  contact?: string | null;
  default_deposit_amount?: number;
  early_fee_enabled?: boolean;
  early_fee_start_time?: string;
  early_fee_end_time?: string;
  early_fee_amount_per_hour?: number;
  night_fee_enabled?: boolean;
  night_fee_start_time?: string;
  night_fee_end_time?: string;
  night_fee_amount_per_hour?: number;
  status: 'active' | 'paused' | 'archived';
  created_at?: string;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  duration_minutes: number;
  min_duration_hours: number;
  max_duration_hours: number;
  player_count?: number;
  player_selection_rule?: string | null;
  player_roles: { role_name: string; gender?: string }[];
  actor_roles: { role_name: string; gender?: string; role_kind?: string }[];
  boards?: ScriptBoard[];
  usage_count: number;
  created_by?: string | null;
  review_status?: 'pending' | 'approved' | 'rejected';
  reject_reason?: string | null;
  created_at: string;
}

export interface ScriptRole {
  id: string;
  script_id: string;
  role_name: string;
  required_duration?: number;
  start_offset: number;
}

export interface ActorSkill {
  id: string;
  actor_id: string;
  actor_name?: string;
  script_id: string;
  script_name: string;
  role_name: string;
  role_type: 'actor' | 'player' | 'dm' | 'field_control' | 'npc' | 'assistant' | 'other' | string;
  duration: number;
  proficiency: number;
}

export interface Schedule {
  id: string;
  room_id: string;
  room_name: string;
  room_photo_url?: string | null;
  script_id: string;
  script_name: string;
  script_board_id?: string | null;
  script_board_name?: string | null;
  actor_role_selection?: ScriptBoardRole[];
  player_role_selection?: ScriptBoardRole[];
  store_car_sequence?: number | null;
  computed_car_sequence?: number | null;
  script_duration: number;
  start_time: string;
  end_time: string;
  status: 'pending' | 'scheduled' | 'locked' | 'confirmed' | 'ongoing' | 'settling' | 'completed' | 'cancelled' | 'bombed' | 'issue';
  customer_name?: string;
  customer_phone?: string;
  player_count?: number;
  note?: string;
  lock_reason?: string | null;
  dm_lock_status?: string | null;
  requested_dm_actor_id?: string | null;
  requested_dm_role_name?: string | null;
  dm_lock_customer_id?: string | null;
  actual_started_at?: string | null;
  actual_ended_at?: string | null;
  actual_left_at?: string | null;
  props_checked?: boolean;
  costumes_checked?: boolean;
  script_cards_checked?: boolean;
  review_requested?: boolean;
  debrief_done?: boolean;
  settlement_status?: string | null;
}

export interface ScheduleActor {
  id: string;
  schedule_id: string;
  actor_id: string;
  actor_name: string;
  actor_photo_url?: string | null;
  role_name: string;
  start_time: string;
  end_time: string;
}

export interface ScheduleWithActors extends Schedule {
  actors: ScheduleActor[];
}
