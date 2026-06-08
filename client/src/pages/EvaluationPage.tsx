import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useApi } from '../hooks/useApi';

interface ScheduleInfo {
  id: string;
  script_name: string;
  start_time: string;
  room_name?: string;
  customer_name?: string;
  status: string;
}

export default function EvaluationPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const { get, post, loading } = useApi();
  const [schedule, setSchedule] = useState<ScheduleInfo | null>(null);
  const [guestName, setGuestName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!scheduleId) return;
    get<ScheduleInfo>(`/schedules/${scheduleId}/public`).then(res => {
      if (res.success && res.data) setSchedule(res.data);
    });
  }, [scheduleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) { setError('请输入您的称呼'); return; }
    if (rating === 0) { setError('请选择评分'); return; }
    setError('');

    const result = await post(`/schedules/${scheduleId}/evaluate`, {
      guestName: guestName.trim(),
      rating,
      comment: comment.trim(),
    });
    if (result.success) setSubmitted(true);
    else setError(result.error || '提交失败，请重试');
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">感谢您的评价！</h2>
          <p className="text-gray-500">您的反馈是我们进步的动力</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⭐</div>
          <h1 className="text-xl font-bold text-gray-800">为本次体验打分</h1>
          {schedule && (
            <div className="mt-2 text-sm text-gray-500">
              {schedule.script_name}
              <br />
              {format(parseISO(schedule.start_time), 'MM月dd日 HH:mm', { locale: zhCN })}
              {schedule.room_name && ` · ${schedule.room_name}`}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">您的称呼</label>
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="请输入您的称呼"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">总体评分</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-4xl transition-transform hover:scale-110 ${
                    star <= rating ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="text-center text-sm text-gray-500 mt-1">
              {rating === 0 && '请点击星星评分'}
              {rating === 1 && '还需努力'}
              {rating === 2 && '可以更好'}
              {rating === 3 && '还不错'}
              {rating === 4 && '很棒！'}
              {rating === 5 && '完美体验！'}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              评价（选填）
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="说说您的体验感受、建议..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {loading ? '提交中...' : '提交评价'}
          </button>
        </form>
      </div>
    </div>
  );
}
