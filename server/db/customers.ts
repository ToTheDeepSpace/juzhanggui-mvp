import { supabase } from '../lib/supabase';

export const CustomerDB = {
  getAll: async () => {
    const { data, error } = await supabase.from('customers').select('*').order('name');
    if (error) throw error;
    return data;
  },
  search: async (q: string) => {
    const { data, error } = await supabase.from('customers').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).order('name').limit(20);
    if (error) throw error;
    return data;
  },
  getById: async (id: string) => {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  getByPhone: async (phone: string) => {
    const { data, error } = await supabase.from('customers').select('*').eq('phone', phone).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  create: async (name: string, phone?: string, membershipLevel?: string, balance?: number) => {
    const { data, error } = await supabase.from('customers').insert({
      name, phone: phone || null, membership_level: membershipLevel || 'none', balance: balance || 0
    }).select().single();
    if (error) throw error;
    return data.id;
  },
  update: async (id: string, updates: any) => {
    const fields: any = {};
    if (updates.name !== undefined) fields.name = updates.name;
    if (updates.phone !== undefined) fields.phone = updates.phone;
    if (updates.membershipLevel !== undefined) fields.membership_level = updates.membershipLevel;
    if (updates.avatar !== undefined) fields.avatar = updates.avatar;
    const { error } = await supabase.from('customers').update(fields).eq('id', id);
    if (error) throw error;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
  },
  updateBalance: async (id: string, amount: number, type: string, note?: string, scheduleId?: string) => {
    const { data: customer } = await supabase.from('customers').select('balance, total_recharged, total_consumed').eq('id', id).single();
    if (!customer) throw new Error('客户不存在');
    const newBalance = type === 'recharge' ? customer.balance + amount : customer.balance - amount;
    const fields: any = { balance: newBalance };
    if (type === 'recharge') fields.total_recharged = (customer.total_recharged || 0) + amount;
    if (type === 'consume') fields.total_consumed = (customer.total_consumed || 0) + amount;
    const { error } = await supabase.from('customers').update(fields).eq('id', id);
    if (error) throw error;
    const { error: txError } = await supabase.from('membership_transactions').insert({
      customer_id: id, schedule_id: scheduleId || null, amount: type === 'recharge' ? amount : -amount,
      transaction_type: type, note: note || null
    });
    if (txError) throw txError;
  },
  getTransactions: async (customerId: string) => {
    const { data, error } = await supabase.from('membership_transactions')
      .select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
};

export const CustomerPreferenceDB = {
  getByCustomer: async (customerId: string) => {
    const { data, error } = await supabase.from('customer_preferences')
      .select('*, actors(name)').eq('customer_id', customerId);
    if (error) throw error;
    return data;
  },
  add: async (customerId: string, actorId: string, preferenceLevel?: number, notes?: string) => {
    const { data, error } = await supabase.from('customer_preferences').insert({
      customer_id: customerId, actor_id: actorId, preference_level: preferenceLevel || 1, notes: notes || null
    }).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id: string, updates: any) => {
    const { error } = await supabase.from('customer_preferences').update(updates).eq('id', id);
    if (error) throw error;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('customer_preferences').delete().eq('id', id);
    if (error) throw error;
  },
};

export const ConflictRecordDB = {
  getAll: async () => {
    const { data, error } = await supabase.from('conflict_records').select('*, customers(name), actors(name), schedules(id)').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  getByCustomer: async (customerId: string) => {
    const { data, error } = await supabase.from('conflict_records').select('*, actors(name)').eq('customer_id', customerId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  getPending: async () => {
    const { data, error } = await supabase.from('conflict_records').select('*, customers(name), actors(name)').eq('status', 'pending').order('conflict_date', { ascending: false });
    if (error) throw error;
    return data;
  },
  create: async (record: any) => {
    const { data, error } = await supabase.from('conflict_records').insert({
      schedule_id: record.scheduleId, customer_id: record.customerId, actor_id: record.actorId,
      conflict_type: record.conflictType, conflict_description: record.conflictDescription,
      conflict_date: record.conflictDate, status: 'pending'
    }).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id: string, updates: any) => {
    const { error } = await supabase.from('conflict_records').update(updates).eq('id', id);
    if (error) throw error;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('conflict_records').delete().eq('id', id);
    if (error) throw error;
  },
};

export const ReminderDB = {
  getPending: async () => {
    const { data, error } = await supabase.from('reminders').select('*, schedules(id, customer_name)').eq('status', 'pending');
    if (error) throw error;
    return data;
  },
  getBySchedule: async (scheduleId: string) => {
    const { data, error } = await supabase.from('reminders').select('*').eq('schedule_id', scheduleId);
    if (error) throw error;
    return data;
  },
  create: async (scheduleId: string, reminderType: string, triggerTime: string) => {
    const { data, error } = await supabase.from('reminders').insert({
      schedule_id: scheduleId, reminder_type: reminderType, trigger_time: triggerTime
    }).select().single();
    if (error) throw error;
    return data;
  },
  markSent: async (id: string) => {
    const { error } = await supabase.from('reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};
