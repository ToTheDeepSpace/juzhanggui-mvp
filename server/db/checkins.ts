import { supabase } from '../lib/supabase';

export const CheckInDB = {
  getBySchedule: async (scheduleId: string) => {
    const { data, error } = await supabase.from('checkins').select('*').eq('schedule_id', scheduleId).order('checked_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  create: async (scheduleId: string, guestName: string, guestPhone?: string, role?: string, guestAvatar?: string) => {
    const { data, error } = await supabase.from('checkins').insert({
      schedule_id: scheduleId, guest_name: guestName, guest_phone: guestPhone || null, role: role || null, guest_avatar: guestAvatar || null
    }).select().single();
    if (error) throw error;
    return data.id;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('checkins').delete().eq('id', id);
    if (error) throw error;
  },
  deleteByGuestAndRole: async (scheduleId: string, guestName: string, role: string) => {
    const { error } = await supabase.from('checkins').delete().eq('schedule_id', scheduleId).eq('guest_name', guestName).eq('role', role);
    if (error) throw error;
  },
  getStats: async (scheduleId: string) => {
    const { count, error } = await supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('schedule_id', scheduleId);
    if (error) throw error;
    return count || 0;
  },
};

export const EvaluationDB = {
  getBySchedule: async (scheduleId: string) => {
    const { data, error } = await supabase.from('evaluations').select('*').eq('schedule_id', scheduleId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  upsert: async (scheduleId: string, guestName: string, rating: number, comment?: string) => {
    const { error } = await supabase.from('evaluations').upsert({
      schedule_id: scheduleId, guest_name: guestName, rating, comment: comment || null
    }, { onConflict: 'schedule_id,guest_name' });
    if (error) throw error;
  },
  getByScript: async (scriptId: string) => {
    const { data, error } = await supabase.from('evaluations')
      .select('*, schedules!inner(script_id, start_time), scripts!inner(name)')
      .eq('schedules.script_id', scriptId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  getScriptStats: async (scriptId: string) => {
    const { data, error } = await supabase.from('evaluations')
      .select('rating, schedules!inner(script_id)')
      .eq('schedules.script_id', scriptId);
    if (error) throw error;
    if (!data || data.length === 0) return { total: 0, avgRating: null, minRating: null, maxRating: null };
    const ratings = data.map((r: any) => r.rating);
    return {
      total: ratings.length,
      avgRating: Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10,
      minRating: Math.min(...ratings),
      maxRating: Math.max(...ratings),
    };
  },
};
