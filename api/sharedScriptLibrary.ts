import crypto from 'node:crypto';

export type SharedScriptRoleSource = 'player' | 'actor';

export type SharedScriptRole = {
  role_name: string;
  gender: string;
  role_kind: string;
  tags: string[];
};

const CREDIT_FIELDS = ['authors', 'publisher', 'supervisor'] as const;
const ACTOR_ROLE_KINDS = new Set(['dm', 'field_control', 'npc', 'assistant', 'other']);

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanTextList(value: unknown, limit = 16, maxLength = 80) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(new Set(source.map(item => cleanText(item, maxLength)).filter(Boolean))).slice(0, limit);
}

export function normalizeSharedScriptKey(value: unknown) {
  return cleanText(value, 160)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·•・._—–/\\|,，、()（）【】\[\]-]+/g, '');
}

export function normalizeSharedRoles(input: unknown, source: SharedScriptRoleSource): SharedScriptRole[] {
  const rows = Array.isArray(input) ? input : [];
  const byName = new Map<string, SharedScriptRole>();
  for (const raw of rows) {
    const row: Record<string, unknown> = raw && typeof raw === 'object'
      ? raw as Record<string, unknown>
      : { role_name: raw };
    const roleName = cleanText(row.role_name ?? row.name, 120);
    const key = normalizeSharedScriptKey(roleName);
    if (!key) continue;
    const roleKind = source === 'player'
      ? 'player'
      : (ACTOR_ROLE_KINDS.has(cleanText(row.role_kind ?? row.kind, 40)) ? cleanText(row.role_kind ?? row.kind, 40) : 'dm');
    const next: SharedScriptRole = {
      role_name: roleName,
      gender: cleanText(row.gender, 40),
      role_kind: roleKind,
      tags: cleanTextList(row.tags, 8, 24),
    };
    const existing = byName.get(key);
    byName.set(key, existing ? {
      role_name: existing.role_name || next.role_name,
      gender: next.gender || existing.gender,
      role_kind: source === 'player' ? 'player' : (next.role_kind || existing.role_kind),
      tags: Array.from(new Set([...existing.tags, ...next.tags])).slice(0, 8),
    } : next);
  }
  return Array.from(byName.values()).slice(0, 80);
}

export function mergeSharedRoles(existing: unknown, incoming: unknown, source: SharedScriptRoleSource) {
  return normalizeSharedRoles([
    ...normalizeSharedRoles(existing, source),
    ...normalizeSharedRoles(incoming, source),
  ], source);
}

export function normalizeSharedCredits(input: unknown) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  return CREDIT_FIELDS.reduce<Record<string, string[]>>((result, field) => {
    const values = cleanTextList(source[field], 16, 100);
    if (values.length) result[field] = values;
    return result;
  }, {});
}

export function mergeSharedCredits(existing: unknown, incoming: unknown) {
  const left = normalizeSharedCredits(existing);
  const right = normalizeSharedCredits(incoming);
  return CREDIT_FIELDS.reduce<Record<string, string[]>>((result, field) => {
    const values = Array.from(new Set([...(left[field] || []), ...(right[field] || [])])).slice(0, 16);
    if (values.length) result[field] = values;
    return result;
  }, {});
}

export function sharedRoleTargetId(scriptId: unknown, source: SharedScriptRoleSource, roleName: unknown) {
  const id = cleanText(scriptId, 80);
  const roleKey = normalizeSharedScriptKey(roleName);
  if (!id || !roleKey) return '';
  const roleHash = crypto.createHash('md5').update(roleKey).digest('hex');
  return `shared:${id}:${source}:${roleHash}`;
}

export function publicSharedScriptTemplate(rowInput: unknown) {
  const row = rowInput && typeof rowInput === 'object' ? rowInput as Record<string, unknown> : {};
  const id = cleanText(row.id, 80);
  const playerRoles = normalizeSharedRoles(row.player_roles, 'player').map(role => {
    const targetId = sharedRoleTargetId(id, 'player', role.role_name);
    return { ...role, id: targetId, target_id: targetId, role_source: 'player' as const };
  });
  const actorRoles = normalizeSharedRoles(row.actor_roles, 'actor').map(role => {
    const targetId = sharedRoleTargetId(id, 'actor', role.role_name);
    return { ...role, id: targetId, target_id: targetId, role_source: 'actor' as const };
  });
  return {
    id,
    name: cleanText(row.name, 160),
    canonical_key: normalizeSharedScriptKey(row.canonical_key || row.name),
    duration_minutes: Number(row.duration_minutes || 0) || null,
    min_duration_hours: Number(row.min_duration_hours || 0) || null,
    max_duration_hours: Number(row.max_duration_hours || 0) || null,
    player_count: Number(row.player_count || playerRoles.length || 0) || null,
    player_selection_rule: cleanText(row.player_selection_rule, 300) || null,
    credits: normalizeSharedCredits(row.credits),
    player_roles: playerRoles,
    actor_roles: actorRoles,
    boards: Array.isArray(row.boards) ? row.boards : [],
    updated_at: row.updated_at || null,
  };
}
