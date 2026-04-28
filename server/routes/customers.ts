import { Router } from 'express';
import { CustomerDB } from '../db';
import { getDb } from '../db/database';

const router = Router();
router.get('/api/customers', async (req, res) => {
  try {
    const customers = await CustomerDB.getAll();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 搜索客户
router.get('/api/customers/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, error: '请输入搜索关键词' });
    }
    const customers = await CustomerDB.search(query);
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 获取单个客户
router.get('/api/customers/:id', async (req, res) => {
  try {
    const customer = await CustomerDB.getById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }
    // 获取交易记录
    const transactions = await CustomerDB.getTransactions(req.params.id);
    res.json({ success: true, data: { ...customer, transactions } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 创建客户
router.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, avatar, membershipLevel, balance } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: '请输入客户姓名' });
    }
    const id = await CustomerDB.create({
      name: name.trim(),
      phone: phone?.trim(),
      avatar,
      membershipLevel,
      balance
    });
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 更新客户
router.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone, avatar, membershipLevel, balance, lastVisitAt } = req.body;
    await CustomerDB.update(req.params.id, {
      name: name?.trim(),
      phone: phone?.trim(),
      avatar,
      membershipLevel,
      balance,
      lastVisitAt
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 删除客户
router.delete('/api/customers/:id', async (req, res) => {
  try {
    await CustomerDB.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
// 添加交易记录
router.post('/api/customers/:id/transactions', async (req, res) => {
  try {
    const { amount, transactionType, note, scheduleId } = req.body;
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ success: false, error: '请输入金额' });
    }
    if (!transactionType || !['recharge', 'consume', 'refund'].includes(transactionType)) {
      return res.status(400).json({ success: false, error: '交易类型无效' });
    }
    const id = await CustomerDB.addTransaction(req.params.id, amount, transactionType, note, scheduleId);
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});
export default router;
