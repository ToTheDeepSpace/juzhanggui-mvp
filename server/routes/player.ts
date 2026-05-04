import { Router } from 'express';
import { supabase, DEFAULT_TENANT_ID } from '../lib/supabase';
import { generateToken } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'script-scheduler-secret-change-me';

// POST /api/player/login — 玩家手机号登录/注册
router.post('/api/player/login', async (req, res) => {
  try {
    const { phone, displayName } = req.body;
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ success: false, error: '请填写手机号' });
    }
    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return res.status(400).json({ success: false, error: '请填写昵称' });
    }

    // 查找是否已有该手机号的玩家
    let { data: existing } = await supabase
      .from('players')
      .select('*')
      .eq('phone_hash', phone.trim())
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .single();

    if (existing) {
      // 更新显示名
      await supabase.from('players').update({ display_name: displayName.trim() }).eq('id', existing.id);
    } else {
      // 创建新玩家
      const { data: newPlayer, error } = await supabase.from('players').insert({
        phone_hash: phone.trim(),
        display_name: displayName.trim(),
        name_encrypted: displayName.trim(),
        tenant_id: DEFAULT_TENANT_ID,
      }).select().single();
      if (error) throw error;
      existing = newPlayer;
    }

    // 生成 JWT
    const token = jwt.sign(
      { role: 'player', playerId: existing.id, tenantId: DEFAULT_TENANT_ID },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        player: {
          id: existing.id,
          displayName: existing.display_name,
          phone: phone.trim(),
          totalGames: existing.total_games || 0,
        }
      }
    });
  } catch (error) {
    console.error('[player/login]', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/player/schedules — 获取玩家所有排班（需 player 或 admin token）
router.get('/api/player/schedules', async (req, res) => {
  try {
    const user = (req as any).user;
    let playerId: string;
    let playerPhone: string | null = null;

    if (user.role === 'player') {
      playerId = user.playerId;
      // 查询玩家手机号
      const { data: player } = await supabase.from('players').select('phone_hash').eq('id', playerId).maybeSingle();
      if (player) playerPhone = player.phone_hash;
    } else if (user.role === 'admin') {
      // 管理员可以查看指定玩家，或查所有
      const { playerId: queryPlayerId } = req.query as any;
      if (queryPlayerId) {
        playerId = queryPlayerId;
        const { data: player } = await supabase.from('players').select('phone_hash').eq('id', playerId).single();
        if (player) playerPhone = player.phone_hash;
      } else {
        return res.status(400).json({ success: false, error: '请指定玩家ID' });
      }
    } else {
      return res.status(403).json({ success: false, error: '无权限' });
    }

    if (!playerPhone) {
      return res.json({ success: true, data: [] });
    }

    // 通过 checkins 表查询玩家的所有排班
    const { data, error } = await supabase
      .from('checkins')
      .select('*, schedules!inner(*, scripts(name), rooms(name))')
      .eq('guest_phone', playerPhone)
      .order('checked_at', { ascending: false });

    if (error) throw error;

    // 展平数据
    const schedules = (data || []).map((c: any) => ({
      checkinId: c.id,
      role: c.role,
      checkedAt: c.checked_at,
      schedule: c.schedules ? {
        id: c.schedules.id,
        scriptName: c.schedules.scripts?.name,
        roomName: c.schedules.rooms?.name,
        startTime: c.schedules.start_time,
        endTime: c.schedules.end_time,
        status: c.schedules.status,
        customerName: c.schedules.customer_name,
        playerCount: c.schedules.player_count,
      } : null,
    }));

    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('[player/schedules]', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
