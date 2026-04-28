import { Router } from 'express';
import { CustomerPreferenceDB } from '../db';
import { getDb } from '../db/database';

const router = Router();
router.get('/api/customers/:id/preferences', async (req, res) => {
  try {
    const preferences = await CustomerPreferenceDB.getByCustomer(req.params.id);
    res.json({ success: true, data: preferences });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 添加客户偏好
router.post('/api/customers/:id/preferences', async (req, res) => {
  try {
    const { actorId, preferenceLevel, notes } = req.body;
    if (!actorId) {
      return res.status(400).json({ success: false, error: '请选择卡司' });
    }
    const id = await CustomerPreferenceDB.create(req.params.id, actorId, preferenceLevel || 1, notes);
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 更新客户偏好
router.put('/api/customers/preferences/:preferenceId', async (req, res) => {
  try {
    const { preferenceLevel, notes } = req.body;
    await CustomerPreferenceDB.update(req.params.preferenceId, preferenceLevel, notes);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 删除客户偏好
router.delete('/api/customers/preferences/:preferenceId', async (req, res) => {
  try {
    await CustomerPreferenceDB.delete(req.params.preferenceId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
