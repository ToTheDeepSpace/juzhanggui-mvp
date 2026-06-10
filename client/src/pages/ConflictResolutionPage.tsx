import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

interface ConflictRecord {
  id: string;
  schedule_id: string;
  customer_id: string;
  actor_id: string;
  conflict_type: string;
  conflict_description: string;
  conflict_date: string;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  status: 'pending' | 'resolved' | 'escalated';
  customer_name?: string;
  actor_name?: string;
  script_name?: string;
  start_time?: string;
  customers?: { name?: string } | null;
  actors?: { name?: string } | null;
  schedules?: { scheduled_date?: string; start_time?: string; scripts?: { name?: string } | null } | null;
}

const conflictTypeLabels: Record<string, string> = {
  'service_attitude': '服务态度',
  'performance': '表演水平',
  'communication': '沟通问题',
  'other': '其他',
};

const statusLabels: Record<string, string> = {
  'pending': '待处理',
  'resolved': '已解决',
  'escalated': '已升级',
};

const statusColors: Record<string, string> = {
  'pending': 'bg-yellow-100 text-yellow-800',
  'resolved': 'bg-green-100 text-green-800',
  'escalated': 'bg-red-100 text-red-800',
};

const ConflictResolutionPage: React.FC = () => {
  const { get, post } = useApi();
  const [pendingConflicts, setPendingConflicts] = useState<ConflictRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolvedBy, setResolvedBy] = useState('');
  const [status, setStatus] = useState<'pending' | 'resolved' | 'escalated'>('pending');

  // 加载矛盾记录
  useEffect(() => {
    fetchConflicts();
  }, []);

  const fetchConflicts = async () => {
    try {
      const result = await get<ConflictRecord[]>('/conflicts/pending');
      setPendingConflicts(result.success && result.data ? result.data : []);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (conflict: ConflictRecord) => {
    setSelectedConflict(conflict);
    setResolution(conflict.resolution || '');
    setStatus(conflict.status);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedConflict(null);
    setResolution('');
    setResolvedBy('');
    setStatus('pending');
  };

  const handleSaveResolution = async () => {
    if (!selectedConflict) return;
    try {
      const res = await post(`/conflicts/${selectedConflict.id}/resolve`, { resolution, resolved_by: resolvedBy, status });
      if (res.success) {
        await fetchConflicts();
        handleCloseDialog();
      } else {
        alert('保存失败');
      }
    } catch (error) {
      console.error('保存解决结果失败:', error);
      alert('保存失败');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const customerName = (conflict: ConflictRecord) => conflict.customer_name || conflict.customers?.name || '未关联客户';
  const actorName = (conflict: ConflictRecord) => conflict.actor_name || conflict.actors?.name || '未关联卡司';
  const scriptName = (conflict: ConflictRecord) => conflict.script_name || conflict.schedules?.scripts?.name || '未关联剧本';
  const scheduleTime = (conflict: ConflictRecord) => conflict.start_time || conflict.schedules?.scheduled_date || conflict.conflict_date;

  if (loading) {
    return <div className="p-6">加载中...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">矛盾调解页面</h1>
      
      {pendingConflicts.length === 0 ? (
        <div className="text-gray-500">暂无待处理的矛盾记录</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">客户</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">卡司</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">剧本</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">矛盾类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingConflicts.map(conflict => (
                <tr key={conflict.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{customerName(conflict)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{actorName(conflict)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{scriptName(conflict)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(scheduleTime(conflict))}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{conflictTypeLabels[conflict.conflict_type] || conflict.conflict_type}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[conflict.status]}`}>
                      {statusLabels[conflict.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleOpenDialog(conflict)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      处理
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openDialog && selectedConflict && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">处理矛盾</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">客户</label>
                <div className="mt-1 text-sm">{customerName(selectedConflict)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">卡司</label>
                <div className="mt-1 text-sm">{actorName(selectedConflict)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">剧本</label>
                <div className="mt-1 text-sm">{scriptName(selectedConflict)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">矛盾描述</label>
                <div className="mt-1 text-sm">{selectedConflict.conflict_description}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">解决结果</label>
                <textarea
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                  rows={3}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="输入解决结果..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">解决人</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                  value={resolvedBy}
                  onChange={(e) => setResolvedBy(e.target.value)}
                  placeholder="输入解决人姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">状态</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="pending">待处理</option>
                  <option value="resolved">已解决</option>
                  <option value="escalated">已升级</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={handleCloseDialog}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                取消
              </button>
              <button
                onClick={handleSaveResolution}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConflictResolutionPage;