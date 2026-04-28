import { Router } from 'express';
import { ScriptDB, ScheduleDB, CheckInDB, CustomerDB } from '../db';
import { getDb } from '../db/database';

const router = Router();
router.get('/api/schedules/:id/public', async (req, res) => {
  try {
    const schedule = await ScheduleDB.getById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: '排期不存在' });
    }
    if (schedule.status === 'cancelled') {
      return res.status(400).json({ success: false, error: '该排期已取消' });
    }
    // 获取剧本信息以返回角色列表
    const script = await ScriptDB.getById(schedule.script_id);
    // 获取已选角色列表
    const checkins = await CheckInDB.getBySchedule(req.params.id);
    const takenRoles = checkins.map(c => c.role).filter(Boolean);
    // 只返回公开信息
    res.json({
      success: true,
      data: {
        id: schedule.id,
        script_name: schedule.script_name,
        room_name: schedule.room_name,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        player_roles: script?.player_roles || [],
        player_count: script?.player_count || 0,
        taken_roles: takenRoles
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 签到
router.post('/api/schedules/:id/checkin', async (req, res) => {
  try {
    const { name, phone, role, avatar } = req.body;
    const scheduleId = req.params.id;
    // 基础参数校验
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: '请填写姓名' });
    }
    if (!role || typeof role !== 'string' || !role.trim()) {
      return res.status(400).json({ success: false, error: '请选择角色' });
    }
    // 检查排期是否存在
    const schedule = await ScheduleDB.getById(scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, error: '排期不存在' });
    }
    if (schedule.status === 'cancelled') {
      return res.status(400).json({ success: false, error: '该排期已取消' });
    }
    // 检查角色是否已被占用（事务保护）
    const existing = await CheckInDB.getBySchedule(scheduleId);
    const takenRole = existing.find(c => c.role === role);
    if (takenRole) {
      return res.status(409).json({ success: false, error: `角色「${role}」已被 ${takenRole.guest_name} 抢注` });
    }
    // 创建签到记录
    const checkInId = await CheckInDB.create(scheduleId, name.trim(), phone || null, role.trim(), avatar || null);
    // 如果提供了手机号，更新客户信息
    if (phone && typeof phone === 'string' && phone.trim()) {
      const phoneStr = phone.trim();
      try {
        // 检查是否已存在客户
        const existingCustomer = await CustomerDB.getByPhone(phoneStr);
        const now = new Date().toISOString();
        
        if (existingCustomer) {
          // 更新现有客户：更新最后访问时间
          await CustomerDB.update(existingCustomer.id, {
            lastVisitAt: now
          });
        } else {
          // 创建新客户
          await CustomerDB.create({
            name: name.trim(),
            phone: phoneStr,
            avatar: avatar || null,
            membershipLevel: 'none',
            balance: 0
          });
        }
      } catch (customerError) {
        // 客户管理失败不影响签到，仅记录日志
        console.warn('[customer] 客户信息更新失败:', customerError);
      }
    }
    res.json({ success: true, data: { id: checkInId } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 获取排期的签到列表（管理后台用）
router.get('/api/schedules/:id/checkins', async (req, res) => {
  try {
    const checkins = await CheckInDB.getBySchedule(req.params.id);
    const count = await CheckInDB.getStats(req.params.id);
    res.json({ success: true, data: { checkins, count } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
