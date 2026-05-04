import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = '/api';

export default function PlayerLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!phone.trim() || phone.trim().length < 5) {
      setErrorMsg('请填写正确的手机号');
      return;
    }
    if (!displayName.trim()) {
      setErrorMsg('请填写您的昵称');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/player/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), displayName: displayName.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('auth_token', data.data.token);
        localStorage.setItem('player_info', JSON.stringify(data.data.player));
        navigate('/player/dashboard');
      } else {
        setErrorMsg(data.error || '登录失败');
      }
    } catch (err: unknown) {
      setErrorMsg('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎮</div>
          <h1 className="text-2xl font-bold text-gray-800">玩家中心</h1>
          <p className="text-gray-500 mt-1">登录查看您的所有排班记录</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="请输入手机号"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">您的昵称</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="如：小明"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '登录中...' : '进入玩家中心'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            首次登录将自动创建账号
          </p>
        </div>
      </div>
    </div>
  );
}
