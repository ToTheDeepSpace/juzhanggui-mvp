export interface Role {
  name: string;
  gender?: string; // '男', '女', '其他', '未指定' 或自定义
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
}

export interface Actor {
  id: string;
  name: string;
  phone?: string;
  lc_profile?: { id: string; display_name: string; role_type?: string; identity_roles?: string[]; verified_dm?: boolean } | null;
}

export interface Script {
  id: string;
  name: string;
  duration: number; // 为了向后兼容，实际值为min_duration
  min_duration: number;
  max_duration: number;
  dm_gender?: string;
  player_roles?: string[];
  actor_roles?: string[];
  player_count?: number;
  actor_count?: number;
}

export interface StoreRecord {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  contact?: string | null;
  status: 'active' | 'paused' | 'archived';
  created_at?: string;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  duration_minutes: number;
  min_duration_hours: number;
  max_duration_hours: number;
  player_roles: { role_name: string; gender?: string }[];
  actor_roles: { role_name: string; gender?: string }[];
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
  role_type: 'actor' | 'player';
  duration: number;
  proficiency: number;
}

export interface Schedule {
  id: string;
  room_id: string;
  room_name: string;
  script_id: string;
  script_name: string;
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
  actual_started_at?: string | null;
  actual_ended_at?: string | null;
  settlement_status?: string | null;
}

export interface ScheduleActor {
  id: string;
  schedule_id: string;
  actor_id: string;
  actor_name: string;
  role_name: string;
  start_time: string;
  end_time: string;
}

export interface ScheduleWithActors extends Schedule {
  actors: ScheduleActor[];
}
