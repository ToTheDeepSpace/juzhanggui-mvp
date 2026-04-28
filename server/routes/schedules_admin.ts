import { Router } from 'express';
import { ScheduleDB, ConflictChecker } from '../db';
import { getDb } from '../db/database';

const router = Router();
router.put('/api/schedules/:id/confirm', async (req, res) => {
  try {
    const { roomId } = req.body;
    
    if (!roomId) {
      return res.status(400).json({ success: false, error: '请选择房间' });
    }
    
    // 获取排期信息检查时间冲突
    const schedule = await ScheduleDB.getById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: '排期不存在' });
    }
    if (schedule.status === 'cancelled') {
      return res.status(400).json({ success: false, error: '已取消的排期不能确认' });
    }
    if (schedule.status === 'scheduled') {
      return res.status(400).json({ success: false, error: '该排期已确认' });
    }
    
    // 检查房间时间冲突
    if (await ConflictChecker.checkRoomConflict(roomId, schedule.start_time, schedule.end_time, req.params.id)) {
      return res.status(409).json({ success: false, error: '该时间段房间已被占用' });
    }
    
    await ScheduleDB.confirm(req.params.id, roomId);
    console.log(`[confirm] 排期 ${req.params.id} 确认，房间 ${roomId}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 取消排期
router.put('/api/schedules/:id/cancel', async (req, res) => {
  try {
    const schedule = await ScheduleDB.getById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: '排期不存在' });
    }
    if (schedule.status === 'cancelled') {
      return res.status(400).json({ success: false, error: '该排期已是取消状态' });
    }
    await ScheduleDB.update(req.params.id, { status: 'cancelled' });
    console.log(`[cancel] 排期 ${req.params.id} 已取消`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
