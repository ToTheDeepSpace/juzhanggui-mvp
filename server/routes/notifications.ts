import { Router, Request, Response } from 'express';
import { NotificationDB } from '../db/notifications';

const router = Router();

// GET /api/notifications — 获取通知列表
router.get('/api/notifications', async (_req: Request, res: Response) => {
  try {
    const notifications = await NotificationDB.getAll();
    const unreadCount = await NotificationDB.getUnreadCount();
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/notifications/unread-count — 未读数
router.get('/api/notifications/unread-count', async (_req: Request, res: Response) => {
  try {
    const unreadCount = await NotificationDB.getUnreadCount();
    res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// PUT /api/notifications/:id/read — 标记已读
router.put('/api/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    await NotificationDB.markRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// PUT /api/notifications/read-all — 全部已读
router.put('/api/notifications/read-all', async (_req: Request, res: Response) => {
  try {
    await NotificationDB.markAllRead();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
