import { Router } from 'express';
import { RoomDB, ScriptDB, ScheduleDB, ScheduleActorDB, ConflictChecker } from '../db';
import { getDb } from '../db/database';

const router = Router();
router.get('/api/schedules', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const schedules = await ScheduleDB.getAll(startDate as string, endDate as string);
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.get('/api/schedules/:id', async (req, res) => {
  try {
    const schedule = await ScheduleDB.getById(req.params.id);
    if (schedule) {
      const actors = await ScheduleActorDB.getBySchedule(req.params.id);
      res.json({ success: true, data: { ...schedule, actors } });
    } else {
      res.status(404).json({ success: false, error: '排期不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.post('/api/schedules', async (req, res) => {
  try {
    const {
      roomId, scriptId, startTime, endTime,
      customerName, customerPhone, playerCount, note,
      actors, status
    } = req.body;
    // 必填字段校验
    if (!scriptId) return res.status(400).json({ success: false, error: '请选择剧本' });
    if (!startTime || !endTime) return res.status(400).json({ success: false, error: '请填写开始/结束时间' });
    if (new Date(endTime) <= new Date(startTime)) return res.status(400).json({ success: false, error: '结束时间必须晚于开始时间' });
    // 只有确定排期（有房间）才检查房间冲突
    if (roomId && await ConflictChecker.checkRoomConflict(roomId, startTime, endTime)) {
      return res.status(409).json({ success: false, error: '该时间段房间已被占用' });
    }
    if (actors && actors.length > 0) {
      for (const actor of actors) {
        if (await ConflictChecker.checkActorConflict(actor.actorId, actor.startTime, actor.endTime)) {
          return res.status(409).json({ 
            success: false, 
            error: `卡司在 ${actor.startTime} - ${actor.endTime} 时间段已被占用` 
          });
        }
      }
    }
    const scheduleId = await ScheduleDB.create({
      roomId, scriptId, startTime, endTime,
      customerName, customerPhone, playerCount, note,
      status
    });
    if (actors && actors.length > 0) {
      for (const actor of actors) {
        await ScheduleActorDB.create(scheduleId, actor.actorId, actor.roleName, actor.startTime, actor.endTime);
      }
    }
    res.json({ success: true, data: { id: scheduleId } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.put('/api/schedules/:id', async (req, res) => {
  try {
    const {
      roomId, scriptId, startTime, endTime, status,
      customerName, customerPhone, playerCount, note,
      actors
    } = req.body;
    if (roomId && startTime && endTime) {
      if (await ConflictChecker.checkRoomConflict(roomId, startTime, endTime, req.params.id)) {
        return res.status(409).json({ success: false, error: '该时间段房间已被占用' });
      }
    }
    await ScheduleDB.update(req.params.id, {
      roomId, scriptId, startTime, endTime, status,
      customerName, customerPhone, playerCount, note
    });
    if (actors) {
      // 先检查所有 actor 冲突，再执行删除+重建（避免删了旧数据后冲突导致数据丢失）
      for (const actor of actors) {
        if (await ConflictChecker.checkActorConflict(actor.actorId, actor.startTime, actor.endTime, req.params.id)) {
          return res.status(409).json({ 
            success: false, 
            error: `卡司在 ${actor.startTime} - ${actor.endTime} 时间段已被占用` 
          });
        }
      }
      await ScheduleActorDB.deleteBySchedule(req.params.id);
      for (const actor of actors) {
        await ScheduleActorDB.create(req.params.id, actor.actorId, actor.roleName, actor.startTime, actor.endTime);
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.delete('/api/schedules/:id', async (req, res) => {
  try {
    console.log(`[delete] 排期 ${req.params.id}`);
    await ScheduleActorDB.deleteBySchedule(req.params.id);
    await ScheduleDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.get('/api/rooms/:id/schedules', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: '缺少startDate或endDate参数' });
    }
    const schedules = await ScheduleDB.getByRoom(req.params.id, startDate as string, endDate as string);
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
router.get('/api/actors/:id/schedules', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: '缺少startDate或endDate参数' });
    }
    const schedules = await ScheduleDB.getByActor(req.params.id, startDate as string, endDate as string);
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
