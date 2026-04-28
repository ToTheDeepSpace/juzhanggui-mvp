import { Router } from 'express';
import { ScriptDB, RoomDB, ActorDB, CheckInDB } from '../db';
import { getDb } from '../db/database';

const router = Router();

// 批量删除剧本（原子事务，任一失败全部回滚）
router.post('/api/scripts/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 ids 参数' });
    }
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    try {
      for (const id of ids) {
        await ScriptDB.delete(id);
      }
      await db.exec('COMMIT');
      console.log(`[batch-delete] 剧本 ids=${ids.join(',')}`);
      res.json({ success: true, deleted: ids.length });
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 批量删除房间（原子事务）
router.post('/api/rooms/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 ids 参数' });
    }
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    try {
      for (const id of ids) {
        await RoomDB.delete(id);
      }
      await db.exec('COMMIT');
      console.log(`[batch-delete] 房间 ids=${ids.join(',')}`);
      res.json({ success: true, deleted: ids.length });
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 批量删除卡司（原子事务）
router.post('/api/actors/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 ids 参数' });
    }
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    try {
      for (const id of ids) {
        await ActorDB.delete(id);
      }
      await db.exec('COMMIT');
      console.log(`[batch-delete] 卡司 ids=${ids.join(',')}`);
      res.json({ success: true, deleted: ids.length });
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 删除签到记录（通过ID）
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
    console.log(`[kick] 排期 ${scheduleId} 踢出 ${guestName}（${role}）`);
    await CheckInDB.deleteByGuestAndRole(scheduleId, guestName.trim(), role.trim());
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
