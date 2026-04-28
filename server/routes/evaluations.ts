import { Router } from 'express';
import { EvaluationDB, ScheduleDB } from '../db';
import { getDb } from '../db/database';

const router = Router();
router.get('/api/schedules/:id/evaluation', async (req, res) => {
  try {
    const evaluation = await EvaluationDB.getBySchedule(req.params.id);
    res.json({ success: true, data: evaluation || null });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 提交评价
router.post('/api/schedules/:id/evaluate', async (req, res) => {
  try {
    const { guestName, rating, comment } = req.body;
    if (!guestName || typeof guestName !== 'string' || !guestName.trim()) {
      return res.status(400).json({ success: false, error: '请填写评价人姓名' });
    }
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: '评分需在1-5之间' });
    }
    // 检查排期是否存在
    const schedule = await ScheduleDB.getById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: '排期不存在' });
    }
    await EvaluationDB.upsert(req.params.id, guestName.trim(), rating, comment || null);
    console.log(`[evaluate] 排期 ${req.params.id} 收到 ${guestName.trim()} 的评价（${rating}分）`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 查询某剧本的所有评价
router.get('/api/scripts/:id/evaluations', async (req, res) => {
  try {
    const evaluations = await EvaluationDB.getByScript(req.params.id);
    res.json({ success: true, data: evaluations });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 查询某剧本的评分统计
router.get('/api/scripts/:id/evaluation-stats', async (req, res) => {
  try {
    const stats = await EvaluationDB.getScriptStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
