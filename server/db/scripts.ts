import { supabase } from '../lib/supabase';

export const ScriptDB = {
  getAll: async () => {
    const { data: scripts, error } = await supabase.from('scripts').select('*').order('name');
    if (error) throw error;
    for (const s of scripts || []) {
      const { data: pr } = await supabase.from('script_player_roles').select('role_name, gender').eq('script_id', s.id);
      const { data: ar } = await supabase.from('script_actor_roles').select('role_name, gender').eq('script_id', s.id);
      s.player_roles = (pr || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      s.actor_roles = (ar || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
      s.player_count = (pr || []).length;
      s.actor_count = (ar || []).length;
      s.duration = s.min_duration;
    }
    return scripts || [];
  },
  getById: async (id: string) => {
    const { data: script, error } = await supabase.from('scripts').select('*').eq('id', id).single();
    if (error) throw error;
    if (!script) return null;
    const { data: pr } = await supabase.from('script_player_roles').select('role_name, gender').eq('script_id', id);
    const { data: ar } = await supabase.from('script_actor_roles').select('role_name, gender').eq('script_id', id);
    script.player_roles = (pr || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
    script.actor_roles = (ar || []).map((r: any) => r.gender ? `${r.role_name}(${r.gender})` : r.role_name);
    script.player_count = (pr || []).length;
    script.actor_count = (ar || []).length;
    script.duration = script.min_duration;
    return script;
  },
  create: async (name: string, minDuration: number, maxDuration: number, playerRoles: string[] = [], actorRoles: string[] = []) => {
    const { data, error } = await supabase.from('scripts').insert({
      name, min_duration: minDuration, max_duration: maxDuration, duration: minDuration
    }).select().single();
    if (error) throw error;
    const scriptId = data.id;
    for (const roleStr of playerRoles) {
      const m = roleStr.match(/^(.+?)\s*\((.*?)\)$/);
      await supabase.from('script_player_roles').insert({
        script_id: scriptId, role_name: m ? m[1].trim() : roleStr.trim(), gender: m ? m[2].trim() : ''
      });
    }
    for (const roleStr of actorRoles) {
      const m = roleStr.match(/^(.+?)\s*\((.*?)\)$/);
      await supabase.from('script_actor_roles').insert({
        script_id: scriptId, role_name: m ? m[1].trim() : roleStr.trim(), gender: m ? m[2].trim() : ''
      });
    }
    return scriptId;
  },
  update: async (id: string, name: string, minDuration: number, maxDuration: number, playerRoles: string[] = [], actorRoles: string[] = []) => {
    const { error } = await supabase.from('scripts').update({
      name, min_duration: minDuration, max_duration: maxDuration, duration: minDuration
    }).eq('id', id);
    if (error) throw error;
    await supabase.from('script_player_roles').delete().eq('script_id', id);
    await supabase.from('script_actor_roles').delete().eq('script_id', id);
    for (const roleStr of playerRoles) {
      const m = roleStr.match(/^(.+?)\s*\((.*?)\)$/);
      await supabase.from('script_player_roles').insert({
        script_id: id, role_name: m ? m[1].trim() : roleStr.trim(), gender: m ? m[2].trim() : ''
      });
    }
    for (const roleStr of actorRoles) {
      const m = roleStr.match(/^(.+?)\s*\((.*?)\)$/);
      await supabase.from('script_actor_roles').insert({
        script_id: id, role_name: m ? m[1].trim() : roleStr.trim(), gender: m ? m[2].trim() : ''
      });
    }
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('scripts').delete().eq('id', id);
    if (error) throw error;
  },
};

export const ScriptRoleDB = {
  getByScript: async (scriptId: string) => {
    const { data, error } = await supabase.from('script_roles').select('*').eq('script_id', scriptId).order('start_offset');
    if (error) throw error;
    return data;
  },
  create: async (scriptId: string, roleName: string, requiredDuration?: number, startOffset?: number) => {
    const { data, error } = await supabase.from('script_roles').insert({
      script_id: scriptId, role_name: roleName, required_duration: requiredDuration || null, start_offset: startOffset || 0
    }).select().single();
    if (error) throw error;
    return data.id;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('script_roles').delete().eq('id', id);
    if (error) throw error;
  },
};
