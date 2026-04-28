import { Router } from 'express';
import { RoomDB } from '../db';

const router = Router();

router.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await RoomDB.getAll();
    res.json({ success: true, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/api/rooms', async (req, res) => {
  try {
    const { name, capacity } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: '请填写房间名称' });
    }
    const id = await RoomDB.create(name.trim(), capacity || 0);
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.put('/api/rooms/:id', async (req, res) => {
  try {
    const { name, capacity } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: '请填写房间名称' });
    }
    await RoomDB.update(req.params.id, name.trim(), capacity ?? 0);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.delete('/api/rooms/:id', async (req, res) => {
  try {
    console.log(`[delete] 房间 ${req.params.id}`);
    await RoomDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
