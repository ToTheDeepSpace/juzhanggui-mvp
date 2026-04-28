import { Router } from 'express';
import { ConflictRecordDB } from '../db';

const router = Router();
router.get('/api/schedules/:id/conflicts', async (req, res) => {
  try {
    const conflicts = await ConflictRecordDB.getBySchedule(req.params.id);
    res.json({ success: true, data: conflicts });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 获取客户的矛盾记录
router.get('/api/customers/:id/conflicts', async (req, res) => {
  try {
    const conflicts = await ConflictRecordDB.getByCustomer(req.params.id);
    res.json({ success: true, data: conflicts });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 获取未解决的矛盾记录
router.get('/api/conflicts/pending', async (req, res) => {
  try {
    const conflicts = await ConflictRecordDB.getPending();
    res.json({ success: true, data: conflicts });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 创建矛盾记录
router.post('/api/conflicts', async (req, res) => {
  try {
    const { scheduleId, customerId, actorId, conflictType, conflictDescription, conflictDate, resolution, resolvedBy, resolvedAt, status } = req.body;
    if (!scheduleId || !customerId || !actorId || !conflictType || !conflictDescription || !conflictDate) {
      return res.status(400).json({ success: false, error: '缺少必要字段' });
    }
    const id = await ConflictRecordDB.create({
      scheduleId, customerId, actorId, conflictType, conflictDescription, conflictDate,
      resolution, resolvedBy, resolvedAt, status
    });
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 更新矛盾记录
router.put('/api/conflicts/:id', async (req, res) => {
  try {
    const { conflictType, conflictDescription, resolution, resolvedBy, resolvedAt, status } = req.body;
    await ConflictRecordDB.update(req.params.id, {
      conflictType, conflictDescription, resolution, resolvedBy, resolvedAt, status
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 删除矛盾记录
router.delete('/api/conflicts/:id', async (req, res) => {
  try {
    await ConflictRecordDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
