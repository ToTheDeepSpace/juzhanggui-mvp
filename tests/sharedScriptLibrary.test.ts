import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeSharedCredits,
  mergeSharedRoles,
  normalizeSharedScriptKey,
  publicSharedScriptTemplate,
  sharedRoleTargetId,
} from '../api/sharedScriptLibrary.js';

test('normalizes punctuation variants to one script key', () => {
  assert.equal(normalizeSharedScriptKey(' O·G 剧场 '), 'og剧场');
  assert.equal(normalizeSharedScriptKey('O G剧场'), 'og剧场');
});

test('merges role metadata without duplicating the role', () => {
  assert.deepEqual(mergeSharedRoles(
    [{ role_name: '容葵', gender: '女', tags: [] }],
    [{ role_name: '容葵', tags: ['顶级亡妻'] }],
    'player',
  ), [{ role_name: '容葵', gender: '女', role_kind: 'player', tags: ['顶级亡妻'] }]);
});

test('merges credits and exposes stable role target ids', () => {
  assert.deepEqual(mergeSharedCredits(
    { authors: ['甲'] },
    { authors: ['甲', '乙'], publisher: ['发行'] },
  ), { authors: ['甲', '乙'], publisher: ['发行'] });

  const targetId = sharedRoleTargetId('8dce5b84-35e2-46f4-9a2e-ba7913725f0f', 'player', '容葵');
  assert.equal(targetId, sharedRoleTargetId('8dce5b84-35e2-46f4-9a2e-ba7913725f0f', 'player', ' 容葵 '));
  const template = publicSharedScriptTemplate({
    id: '8dce5b84-35e2-46f4-9a2e-ba7913725f0f',
    name: '归途七万里',
    player_roles: [{ role_name: '容葵', gender: '女' }],
  });
  assert.equal(template.player_roles[0].target_id, targetId);
});
