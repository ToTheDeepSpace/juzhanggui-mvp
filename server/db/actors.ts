import { supabase } from '../lib/supabase';

export const ActorDB = {
  getAll: async () => {
    const { data, error } = await supabase.from('actors').select('*').order('name');
    if (error) throw error;
    return data;
  },
  getById: async (id: string) => {
    const { data, error } = await supabase.from('actors').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  create: async (name: string, phone?: string) => {
    const { data, error } = await supabase.from('actors').insert({ name, phone: phone || null }).select().single();
    if (error) throw error;
    return data.id;
  },
  update: async (id: string, name: string, phone?: string) => {
    const { error } = await supabase.from('actors').update({ name, phone: phone || null }).eq('id', id);
    if (error) throw error;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('actors').delete().eq('id', id);
    if (error) throw error;
  },
  getSchedules: async (actorId: string, startDate?: string, endDate?: string) => {
    let q = supabase.from('schedule_actors').select('*, schedules(*)').eq('actor_id', actorId);
    if (startDate) q = q.gte('schedules.start_time', startDate);
    if (endDate) q = q.lte('schedules.end_time', endDate);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  getAvailability: async (actorId: string, date: string) => {
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    const { data, error } = await supabase
      .from('schedule_actors')
      .select('start_time, end_time')
      .eq('actor_id', actorId)
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .order('start_time');
    if (error) throw error;
    const occupied = (data || []).map((r: any) => ({ start: r.start_time, end: r.end_time }));
    const slots: { start: string; end: string }[] = [];
    let cursor = `${date}T09:00:00`;
    const dayEnd = `${date}T23:00:00`;
    for (const o of occupied) {
      if (cursor < o.start) slots.push({ start: cursor, end: o.start });
      if (o.end > cursor) cursor = o.end;
    }
    if (cursor < dayEnd) slots.push({ start: cursor, end: dayEnd });
    return slots;
  },
};

export const ActorSkillDB = {
  getByActor: async (actorId: string) => {
    const { data, error } = await supabase.from('actor_skills').select('*, scripts(name)').eq('actor_id', actorId);
    if (error) throw error;
    return data;
  },
  getByScript: async (scriptId: string) => {
    const { data, error } = await supabase.from('actor_skills').select('*, actors(name)').eq('script_id', scriptId);
    if (error) throw error;
    return data;
  },
  create: async (actorId: string, scriptId: string, roleName: string, roleType: string, proficiency: number) => {
    const { error } = await supabase.from('actor_skills').insert({
      actor_id: actorId, script_id: scriptId, role_name: roleName, role_type: roleType, proficiency
    });
    if (error) throw error;
    return true;
  },
  delete: async (actorId: string, scriptId: string, roleName: string) => {
    const { error } = await supabase.from('actor_skills').delete()
      .eq('actor_id', actorId).eq('script_id', scriptId).eq('role_name', roleName);
    if (error) throw error;
  },
};
