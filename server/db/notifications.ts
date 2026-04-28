import { supabase } from '../lib/supabase';

export const NotificationDB = {
  getAll: async (limit = 50) => {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },
  getUnreadCount: async () => {
    const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_read', 0);
    if (error) throw error;
    return count || 0;
  },
  create: async (type: string, title: string, message: string, scheduleId?: string) => {
    const { data, error } = await supabase.from('notifications').insert({
      type, title, message, schedule_id: scheduleId || null
    }).select().single();
    if (error) throw error;
    return data.id;
  },
  markRead: async (id: string) => {
    const { error } = await supabase.from('notifications').update({ is_read: 1 }).eq('id', id);
    if (error) throw error;
  },
  markAllRead: async () => {
    const { error } = await supabase.from('notifications').update({ is_read: 1 }).eq('is_read', 0);
    if (error) throw error;
  },
};
