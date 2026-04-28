import { supabase } from '../lib/supabase';

export const RoomDB = {
  getAll: async () => {
    const { data, error } = await supabase.from('rooms').select('*').order('name');
    if (error) throw error;
    return data;
  },
  getById: async (id: string) => {
    const { data, error } = await supabase.from('rooms').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  create: async (name: string, capacity?: number) => {
    const { data, error } = await supabase.from('rooms').insert({ name, capacity: capacity || 0 }).select().single();
    if (error) throw error;
    return data.id;
  },
  update: async (id: string, name: string, capacity?: number) => {
    const { error } = await supabase.from('rooms').update({ name, capacity: capacity || 0 }).eq('id', id);
    if (error) throw error;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) throw error;
  },
};
