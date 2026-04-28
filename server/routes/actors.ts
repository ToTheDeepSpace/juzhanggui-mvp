import { Router } from 'express';
import { ActorDB, ActorSkillDB, ConflictChecker } from '../db';
import { getDb } from '../db/database';

const router = Router();
router.get('/api/actors', async (req, res) => {
  try {
    const actors = await ActorDB.getAll();
    res.json({ success: true, data: actors });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.post('/api/actors', async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: '请填写卡司姓名' });
    }
    const id = await ActorDB.create(name.trim(), phone || null);
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.put('/api/actors/:id', async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: '请填写卡司姓名' });
    }
    await ActorDB.update(req.params.id, name.trim(), phone ?? null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.delete('/api/actors/:id', async (req, res) => {
  try {
    console.log(`[delete] 卡司 ${req.params.id}`);
    await ActorDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.get('/api/actors/:id/skills', async (req, res) => {
  try {
    const skills = await ActorSkillDB.getByActor(req.params.id);
    res.json({ success: true, data: skills });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.post('/api/actors/:id/skills', async (req, res) => {
  try {
    const { scriptId, roleName, roleType, proficiency } = req.body;
    if (!scriptId) return res.status(400).json({ success: false, error: '请选择剧本' });
    if (!roleName || typeof roleName !== 'string' || !roleName.trim()) {
      return res.status(400).json({ success: false, error: '请填写角色名称' });
    }
    const result = await ActorSkillDB.create(req.params.id, scriptId, roleName.trim(), roleType || 'actor', proficiency || 1);
    if (result) {
      res.json({ success: true, data: { id: result } });
    } else {
      res.status(400).json({ success: false, error: '该技能已存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.delete('/api/actors/:actorId/skills/:scriptId/:roleName', async (req, res) => {
  try {
    await ActorSkillDB.delete(req.params.actorId, req.params.scriptId, decodeURIComponent(req.params.roleName));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.get('/api/actors/:id/availability', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: '缺少date参数' });
    }
    const availability = await ConflictChecker.getActorAvailability(req.params.id, date as string);
    res.json({ success: true, data: availability });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
