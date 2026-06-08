import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

interface EvaluationRow {
  id: string;
  guest_name: string;
  rating: number;
  comment?: string | null;
  created_at: string;
  schedule?: {
    scriptName: string;
    roomName?: string | null;
    startTime: string;
    status: string;
  } | null;
}

interface EvaluationData {
  evaluations: EvaluationRow[];
  stats: { total: number; avgRating: number | null };
  scriptStats: { scriptName: string; count: number; avgRating: number | null }[];
}

export default function EvaluationManager() {
  const { get, loading } = useApi();
  const [data, setData] = useState<EvaluationData>({ evaluations: [], stats: { total: 0, avgRating: null }, scriptStats: [] });
  const [message, setMessage] = useState('');

  const loadData = async () => {
    const result = await get<EvaluationData>('/evaluations');
    if (result.success && result.data) {
      setData(result.data);
      setMessage('');
    } else {
      setMessage(result.error || '评价加载失败');
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const renderStars = (rating: number) => {
    return '★★★★★'.split('').map((star, index) => (
      <span key={index} className={index < rating ? 'text-amber-400' : 'text-gray-200'}>{star}</span>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">评价反馈</h2>
            <p className="text-sm text-gray-500 mt-1">玩家扫码评价后会写入这里。评价按当前店家排期隔离。</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50"
          >
            {loading ? '刷新中' : '刷新'}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article className="bg-white rounded-lg shadow p-5 border border-gray-100">
          <p className="text-sm text-gray-500">评价总数</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{data.stats.total}</p>
        </article>
        <article className="bg-white rounded-lg shadow p-5 border border-gray-100">
          <p className="text-sm text-gray-500">平均评分</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{data.stats.avgRating ?? '暂无'}</p>
        </article>
        <article className="bg-white rounded-lg shadow p-5 border border-gray-100">
          <p className="text-sm text-gray-500">有评价剧本</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{data.scriptStats.length}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <section className="bg-white rounded-lg shadow p-5">
          <h3 className="font-bold text-gray-900 mb-4">剧本评分</h3>
          <div className="space-y-3">
            {data.scriptStats.map(item => (
              <div key={item.scriptName} className="rounded-lg border border-gray-100 p-3">
                <p className="font-semibold text-gray-800">{item.scriptName}</p>
                <p className="text-sm text-gray-500 mt-1">{item.count} 条 · 均分 {item.avgRating ?? '暂无'}</p>
              </div>
            ))}
            {data.scriptStats.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">暂无剧本评分</p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">最近评价</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {data.evaluations.map(item => (
              <article key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{item.guest_name || '匿名玩家'}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {item.schedule?.scriptName || '未知剧本'}
                      {item.schedule?.roomName ? ` · ${item.schedule.roomName}` : ''}
                      {item.schedule?.startTime ? ` · ${new Date(item.schedule.startTime).toLocaleString('zh-CN')}` : ''}
                    </p>
                  </div>
                  <div className="text-lg whitespace-nowrap">{renderStars(Number(item.rating || 0))}</div>
                </div>
                {item.comment && <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{item.comment}</p>}
                <p className="mt-3 text-xs text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}</p>
              </article>
            ))}
            {data.evaluations.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-400">暂无玩家评价</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
