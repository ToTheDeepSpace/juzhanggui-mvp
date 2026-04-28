import { Router } from 'express';
import { ReminderDB } from '../db';

const router = Router();
router.get('/api/schedules/:id/reminders', async (req, res) => {
  try {
    const reminders = await ReminderDB.getBySchedule(req.params.id);
    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 创建提醒
router.post('/api/reminders', async (req, res) => {
  try {
    const { scheduleId, reminderType, triggerTime } = req.body;
    if (!scheduleId || !reminderType || !triggerTime) {
      return res.status(400).json({ success: false, error: '缺少必要字段' });
    }
    const id = await ReminderDB.create(scheduleId, reminderType, triggerTime);
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 标记提醒为已发送
router.put('/api/reminders/:id/sent', async (req, res) => {
  try {
    await ReminderDB.markSent(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 获取待处理的提醒
router.get('/api/reminders/pending', async (req, res) => {
  try {
    const reminders = await ReminderDB.getPending();
    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
