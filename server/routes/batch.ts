import { Router } from 'express';
import { ScriptDB, RoomDB, ActorDB, CheckInDB } from '../db';

const router = Router();

// 批量删除剧本
router.post('/api/scripts/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 ids 参数' });
    }
    for (const id of ids) {
      await ScriptDB.delete(id);
    }
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 批量删除房间
router.post('/api/rooms/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 ids 参数' });
    }
    for (const id of ids) {
      await RoomDB.delete(id);
    }
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 批量删除卡司
router.post('/api/actors/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 ids 参数' });
    }
    for (const id of ids) {
      await ActorDB.delete(id);
    }
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 删除签到记录
router.delete('/api/checkins/:id', async (req, res) => {
  try {
    await CheckInDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 踢出签到客人
router.post('/api/schedules/:scheduleId/checkins/kick', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { guestName, role } = req.body;
    if (!guestName || typeof guestName !== 'string' || !guestName.trim()) {
      return res.status(400).json({ success: false, error: '请填写要踢出的姓名' });
    }
    if (!role || typeof role !== 'string' || !role.trim()) {
      return res.status(400).json({ success: false, error: '请填写要踢出的角色' });
    }
    await CheckInDB.deleteByGuestAndRole(scheduleId, guestName.trim(), role.trim());
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
