import { useState } from 'react';

interface GuestRegistrationProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function GuestRegistration({ onClose, onSuccess }: GuestRegistrationProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    note: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.name.trim()) {
      setError('请输入姓名');
      setLoading(false);
      return;
    }

    if (!formData.phone.trim()) {
      setError('请输入手机号');
      setLoading(false);
      return;
    }

    if (!acceptedTerms) {
      setError('请先阅读并同意用户协议和隐私政策');
      setLoading(false);
      return;
    }

    try {
      // 创建客户记录（复用卡司表，加个标记）
      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          note: formData.note
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose?.();
        }, 1500);
      } else {
        setError(result.error || '注册失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-green-600 mb-2">注册成功！</h3>
        <p className="text-gray-600">欢迎加入，我们会尽快联系您</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          姓名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="请输入您的姓名"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          手机号 <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="请输入您的手机号"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          邮箱（选填）
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="请输入您的邮箱"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          备注（选填）
        </label>
        <textarea
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="有什么想告诉我们的？"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-xs leading-6 text-gray-600">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
        />
        <span>
          我已阅读并同意
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="mx-1 font-semibold text-blue-600 hover:text-blue-500">《用户协议》</a>
          和
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="mx-1 font-semibold text-blue-600 hover:text-blue-500">《隐私政策》</a>
          ，知悉平台会按规则处理登记信息。
        </span>
      </label>

      <div className="flex gap-3 pt-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !acceptedTerms}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {loading ? '提交中...' : '立即注册'}
        </button>
      </div>
    </form>
  );
}
