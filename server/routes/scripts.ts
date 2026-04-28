import { Router } from 'express';
import { ScriptDB, ScriptRoleDB, ActorSkillDB } from '../db';

const router = Router();
router.get('/api/scripts', async (req, res) => {
  try {
    const scripts = await ScriptDB.getAll();
    res.json({ success: true, data: scripts });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.get('/api/scripts/:id', async (req, res) => {
  try {
    const script = await ScriptDB.getById(req.params.id);
    if (script) {
      const roles = await ScriptRoleDB.getByScript(req.params.id);
      const skilledActors = await ActorSkillDB.getByScript(req.params.id);
      res.json({ success: true, data: { ...script, roles, skilledActors } });
    } else {
      res.status(404).json({ success: false, error: '剧本不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.post('/api/scripts', async (req, res) => {
  try {
    const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: '请填写剧本名称' });
    }
    if (!minDuration || typeof minDuration !== 'number' || minDuration <= 0) {
      return res.status(400).json({ success: false, error: '请填写剧本最短时长（分钟）' });
    }
    if (!maxDuration || typeof maxDuration !== 'number' || maxDuration <= 0) {
      return res.status(400).json({ success: false, error: '请填写剧本最长时长（分钟）' });
    }
    if (minDuration > maxDuration) {
      return res.status(400).json({ success: false, error: '最短时长不能大于最长时长' });
    }
    // 暂时使用最短时长作为 duration，后续可修改数据库支持两个字段
    const duration = minDuration;
    const id = await ScriptDB.create(name.trim(), minDuration, maxDuration, playerRoles || [], actorRoles || []);
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error creating script:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.put('/api/scripts/:id', async (req, res) => {
  try {
    const { name, minDuration, maxDuration, playerRoles, actorRoles } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: '请填写剧本名称' });
    }
    if (!minDuration || typeof minDuration !== 'number' || minDuration <= 0) {
      return res.status(400).json({ success: false, error: '请填写剧本最短时长（分钟）' });
    }
    if (!maxDuration || typeof maxDuration !== 'number' || maxDuration <= 0) {
      return res.status(400).json({ success: false, error: '请填写剧本最长时长（分钟）' });
    }
    if (minDuration > maxDuration) {
      return res.status(400).json({ success: false, error: '最短时长不能大于最长时长' });
    }
    // 暂时使用最短时长作为 duration，后续可修改数据库支持两个字段
    const duration = minDuration;
    await ScriptDB.update(req.params.id, name.trim(), minDuration, maxDuration, playerRoles || [], actorRoles || []);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.delete('/api/scripts/:id', async (req, res) => {
  try {
    console.log(`[delete] 剧本 ${req.params.id}`);
    await ScriptDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.post('/api/scripts/:id/roles', async (req, res) => {
  try {
    const { roleName, requiredDuration, startOffset } = req.body;
    if (!roleName || typeof roleName !== 'string' || !roleName.trim()) {
      return res.status(400).json({ success: false, error: '请填写角色名称' });
    }
    const id = await ScriptRoleDB.create(req.params.id, roleName.trim(), requiredDuration, startOffset);
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.delete('/api/scripts/:scriptId/roles/:roleId', async (req, res) => {
  try {
    await ScriptRoleDB.delete(req.params.roleId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
