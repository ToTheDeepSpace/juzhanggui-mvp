import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  membership_level: string;
  balance: number;
  total_recharged: number;
  total_consumed: number;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
}



const MEMBERSHIP_LEVELS = [
  { value: 'none', label: '非会员', color: 'bg-gray-100 text-gray-700' },
  { value: 'bronze', label: '铜牌会员', color: 'bg-amber-100 text-amber-700' },
  { value: 'silver', label: '银牌会员', color: 'bg-gray-100 text-gray-700' },
  { value: 'gold', label: '金牌会员', color: 'bg-yellow-100 text-yellow-700' },
];

export default function CustomerManager() {
  const { get, post, put, del, loading } = useApi();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    membershipLevel: 'none',
    balance: 0,
  });
  
  const [transactionData, setTransactionData] = useState({
    amount: '',
    transactionType: 'recharge',
    note: '',
  });

  // 加载客户列表
  const loadCustomers = async () => {
    const res = await get<Customer[]>('/customers');
    if (res.success && res.data) {
      setCustomers(res.data);
    } else {
      setError(res.error || '加载客户列表失败');
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // 搜索客户
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadCustomers();
      return;
    }
    
    const res = await get<Customer[]>(`/customers/search?q=${encodeURIComponent(searchQuery)}`);
    if (res.success && res.data) {
      setCustomers(res.data);
    } else {
      setError(res.error || '搜索失败');
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      membershipLevel: 'none',
      balance: 0,
    });
  };

  // 添加客户
  const handleAddCustomer = async () => {
    if (!formData.name.trim()) {
      setError('请输入客户姓名');
      return;
    }

    const res = await post<{ id: string }>('/customers', {
      name: formData.name,
      phone: formData.phone || null,
      membershipLevel: formData.membershipLevel,
      balance: formData.balance * 100, // 转换为分
    });

    if (res.success) {
      setSuccess('客户添加成功');
      resetForm();
      setShowAddModal(false);
      loadCustomers();
    } else {
      setError(res.error || '添加失败');
    }
  };

  // 更新客户
  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return;
    
    const res = await put(`/customers/${selectedCustomer.id}`, {
      name: formData.name,
      phone: formData.phone || null,
      membershipLevel: formData.membershipLevel,
      balance: formData.balance * 100,
    });

    if (res.success) {
      setSuccess('客户信息已更新');
      setShowEditModal(false);
      loadCustomers();
    } else {
      setError(res.error || '更新失败');
    }
  };

  // 删除客户
  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('确定要删除这个客户吗？此操作不可撤销。')) return;
    
    const res = await del(`/customers/${id}`);
    if (res.success) {
      setSuccess('客户已删除');
      loadCustomers();
    } else {
      setError(res.error || '删除失败');
    }
  };

  // 添加交易记录
  const handleAddTransaction = async () => {
    if (!selectedCustomer) return;
    
    const amount = parseFloat(transactionData.amount);
    if (isNaN(amount) || amount === 0) {
      setError('请输入有效的金额');
      return;
    }

    // 转换为分
    const amountInCents = Math.round(amount * 100);

    const res = await post<{ id: string }>(`/customers/${selectedCustomer.id}/transactions`, {
      amount: amountInCents,
      transactionType: transactionData.transactionType,
      note: transactionData.note || null,
    });

    if (res.success) {
      setSuccess('交易记录已添加');
      setTransactionData({ amount: '', transactionType: 'recharge', note: '' });
      setShowTransactionModal(false);
      loadCustomers(); // 刷新列表以更新余额
    } else {
      setError(res.error || '添加交易失败');
    }
  };

  // 打开编辑模态框
  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      membershipLevel: customer.membership_level,
      balance: customer.balance / 100,
    });
    setShowEditModal(true);
  };

  // 打开交易模态框
  const openTransactionModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setTransactionData({ amount: '', transactionType: 'recharge', note: '' });
    setShowTransactionModal(true);
  };

  // 获取会员等级标签
  const getMembershipLevelInfo = (level: string) => {
    const info = MEMBERSHIP_LEVELS.find(l => l.value === level) || MEMBERSHIP_LEVELS[0];
    return info;
  };

  // 格式化金额（分转元）
  const formatCurrency = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '从未访问';
    return format(new Date(dateStr), 'yyyy-MM-dd HH:mm', { locale: zhCN });
  };

  // 清空消息
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // 效果：自动清除成功/错误消息
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(clearMessages, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">会员管理</h1>
          <p className="text-gray-600 mt-1">管理客户信息和会员等级</p>
        </div>
        
        <div className="flex space-x-3">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索客户姓名或手机号..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
            <button
              onClick={handleSearch}
              className="absolute right-0 top-0 h-full px-3 text-gray-500 hover:text-gray-700"
            >
              🔍
            </button>
          </div>
          
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
          >
            + 添加客户
          </button>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
          <p className="text-green-600">{success}</p>
        </div>
      )}

      {/* 客户列表 */}
      {loading && !customers.length ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-500">加载中...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-4">👥</div>
          <p className="text-gray-500">暂无客户信息</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            添加第一个客户
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    客户信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    会员等级
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    账户余额
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    累计消费
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最近访问
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((customer) => {
                  const levelInfo = getMembershipLevelInfo(customer.membership_level);
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            {customer.avatar ? (
                              <img src={customer.avatar} alt={customer.name} className="h-10 w-10 rounded-full" />
                            ) : (
                              <span className="text-gray-500 font-medium">
                                {customer.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500">
                              {customer.phone || '未绑定手机'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${levelInfo.color}`}>
                          {levelInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          ¥{formatCurrency(customer.balance)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          ¥{formatCurrency(customer.total_consumed)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(customer.last_visit_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditModal(customer)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => openTransactionModal(customer)}
                            className="text-green-600 hover:text-green-900"
                          >
                            交易
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 添加客户模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">添加新客户</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  姓名 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入客户姓名"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  手机号
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入手机号"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会员等级
                </label>
                <select
                  value={formData.membershipLevel}
                  onChange={(e) => setFormData({ ...formData, membershipLevel: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {MEMBERSHIP_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  初始余额（元）
                </label>
                <input
                  type="number"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddCustomer}
                disabled={loading}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '处理中...' : '确认添加'}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                disabled={loading}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑客户模态框 */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">编辑客户信息</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  姓名 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入客户姓名"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  手机号
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入手机号"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会员等级
                </label>
                <select
                  value={formData.membershipLevel}
                  onChange={(e) => setFormData({ ...formData, membershipLevel: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {MEMBERSHIP_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  余额（元）
                </label>
                <input
                  type="number"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleUpdateCustomer}
                disabled={loading}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存更改'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={loading}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 交易记录模态框 */}
      {showTransactionModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              为 {selectedCustomer.name} 添加交易记录
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  交易类型
                </label>
                <select
                  value={transactionData.transactionType}
                  onChange={(e) => setTransactionData({ ...transactionData, transactionType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="recharge">充值</option>
                  <option value="consume">消费</option>
                  <option value="refund">退款</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  金额（元）*
                </label>
                <input
                  type="number"
                  value={transactionData.amount}
                  onChange={(e) => setTransactionData({ ...transactionData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  备注（选填）
                </label>
                <textarea
                  value={transactionData.note}
                  onChange={(e) => setTransactionData({ ...transactionData, note: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例如：微信充值、剧本消费等"
                  rows={3}
                />
              </div>
              
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  当前余额：¥{formatCurrency(selectedCustomer.balance)}
                </p>
                {transactionData.amount && !isNaN(parseFloat(transactionData.amount)) && (
                  <p className="text-sm text-gray-600 mt-1">
                    交易后余额：¥{formatCurrency(
                      selectedCustomer.balance + 
                      (transactionData.transactionType === 'recharge' ? parseFloat(transactionData.amount) * 100 : 0) -
                      (transactionData.transactionType === 'consume' ? parseFloat(transactionData.amount) * 100 : 0) +
                      (transactionData.transactionType === 'refund' ? parseFloat(transactionData.amount) * 100 : 0)
                    )}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddTransaction}
                disabled={loading || !transactionData.amount}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? '处理中...' : '确认交易'}
              </button>
              <button
                onClick={() => setShowTransactionModal(false)}
                disabled={loading}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {customers.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm text-gray-500">客户总数</div>
            <div className="text-2xl font-bold text-gray-800">{customers.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm text-gray-500">总余额</div>
            <div className="text-2xl font-bold text-green-600">
              ¥{formatCurrency(customers.reduce((sum, c) => sum + c.balance, 0))}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm text-gray-500">累计充值</div>
            <div className="text-2xl font-bold text-blue-600">
              ¥{formatCurrency(customers.reduce((sum, c) => sum + c.total_recharged, 0))}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="text-sm text-gray-500">累计消费</div>
            <div className="text-2xl font-bold text-orange-600">
              ¥{formatCurrency(customers.reduce((sum, c) => sum + c.total_consumed, 0))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}