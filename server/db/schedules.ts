import { supabase } from '../lib/supabase';

export const ScheduleDB = {
  getAll: async (startDate?: string, endDate?: string) => {
    let q = supabase.from('schedules').select('*, scripts(name), rooms(name)').order('start_time');
    if (startDate) q = q.gte('start_time', startDate);
    if (endDate) q = q.lte('start_time', endDate);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((s: any) => ({
      ...s,
      script_name: s.scripts?.name,
      room_name: s.rooms?.name,
    }));
  },
  getById: async (id: string) => {
    const { data, error } = await supabase.from('schedules').select('*, scripts(name), rooms(name)').eq('id', id).single();
    if (error) throw error;
    if (!data) return null;
    return { ...data, script_name: data.scripts?.name, room_name: data.rooms?.name };
  },
  getByRoom: async (roomId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase.from('schedules')
      .select('*, scripts(name)').eq('room_id', roomId)
      .gte('start_time', startDate).lt('start_time', endDate)
      .order('start_time');
    if (error) throw error;
    return data;
  },
  create: async (data: any) => {
    const { data: result, error } = await supabase.from('schedules').insert({
      script_id: data.scriptId,
      room_id: data.roomId || null,
      start_time: data.startTime,
      end_time: data.endTime,
      status: data.status || 'pending',
      customer_name: data.customerName || null,
      customer_phone: data.customerPhone || null,
      player_count: data.playerCount || null,
      note: data.note || null,
    }).select().single();
    if (error) throw error;
    return result;
  },
  update: async (id: string, updates: any) => {
    const fields: any = {};
    if (updates.scriptId !== undefined) fields.script_id = updates.scriptId;
    if (updates.roomId !== undefined) fields.room_id = updates.roomId;
    if (updates.startTime !== undefined) fields.start_time = updates.startTime;
    if (updates.endTime !== undefined) fields.end_time = updates.endTime;
    if (updates.status !== undefined) fields.status = updates.status;
    if (updates.customerName !== undefined) fields.customer_name = updates.customerName;
    if (updates.customerPhone !== undefined) fields.customer_phone = updates.customerPhone;
    if (updates.playerCount !== undefined) fields.player_count = updates.playerCount;
    if (updates.note !== undefined) fields.note = updates.note;
    const { error } = await supabase.from('schedules').update(fields).eq('id', id);
    if (error) throw error;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) throw error;
  },
  confirm: async (id: string, roomId: string) => {
    const { error } = await supabase.from('schedules').update({ room_id: roomId, status: 'scheduled' }).eq('id', id);
    if (error) throw error;
  },
  cancel: async (id: string) => {
    const { error } = await supabase.from('schedules').update({ status: 'cancelled' }).eq('id', id);
    if (error) throw error;
  },
  cleanupExpiredPending: async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { data, error } = await supabase.from('schedules').delete()
      .eq('status', 'pending').lt('start_time', yesterday).select('id');
    if (error) throw error;
    return (data || []).length;
  },
  getStartedSchedules: async (nowISO: string) => {
    const { data, error } = await supabase.from('schedules')
      .select('*, scripts(name)').eq('status', 'scheduled').lte('start_time', nowISO).order('start_time');
    if (error) throw error;
    return (data || []).map((s: any) => ({ ...s, script_name: s.scripts?.name }));
  },
  getEndedSchedules: async (nowISO: string) => {
    const { data, error } = await supabase.from('schedules')
      .select('*, scripts(name)').eq('status', 'ongoing').lte('end_time', nowISO).order('end_time');
    if (error) throw error;
    return (data || []).map((s: any) => ({ ...s, script_name: s.scripts?.name }));
  },
};

export const ScheduleActorDB = {
  getBySchedule: async (scheduleId: string) => {
    const { data, error } = await supabase.from('schedule_actors')
      .select('*, actors(name)').eq('schedule_id', scheduleId);
    if (error) throw error;
    return (data || []).map((r: any) => ({ ...r, actor_name: r.actors?.name }));
  },
  create: async (scheduleId: string, actorId: string, roleName: string, startTime: string, endTime: string) => {
    const { data, error } = await supabase.from('schedule_actors').insert({
      schedule_id: scheduleId, actor_id: actorId, role_name: roleName, start_time: startTime, end_time: endTime
    }).select().single();
    if (error) throw error;
    return data;
  },
  deleteBySchedule: async (scheduleId: string) => {
    const { error } = await supabase.from('schedule_actors').delete().eq('schedule_id', scheduleId);
    if (error) throw error;
  },
};

export const ConflictChecker = {
  checkRoomConflict: async (roomId: string, startTime: string, endTime: string, excludeScheduleId?: string) => {
    let q = supabase.from('schedules').select('id').eq('room_id', roomId)
      .neq('status', 'cancelled')
      .lt('start_time', endTime).gt('end_time', startTime);
    if (excludeScheduleId) q = q.neq('id', excludeScheduleId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).length > 0;
  },
  checkActorConflict: async (actorId: string, startTime: string, endTime: string, excludeScheduleId?: string) => {
    let q = supabase.from('schedule_actors').select('id')
      .eq('actor_id', actorId)
      .lt('start_time', endTime).gt('end_time', startTime);
    if (excludeScheduleId) q = q.neq('schedule_id', excludeScheduleId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).length > 0;
  },
};
