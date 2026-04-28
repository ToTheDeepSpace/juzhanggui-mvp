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
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  customer_name?: string;
  customer_phone?: string;
  player_count?: number;
  note?: string;
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
