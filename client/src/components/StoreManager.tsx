import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import type { StoreRecord } from '../types';
import CityInput from './CityInput';

interface PlatformStoreRecord extends StoreRecord {
  admin_count?: number;
  script_count?: number;
  schedule_count?: number;
  actor_count?: number;
  customer_count?: number;
}

export default function StoreManager() {
  const { get, post, loading } = useApi();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [stores, setStores] = useState<PlatformStoreRecord[]>([]);
  const [form, setForm] = useState({ name: '', city: '', address: '', contact: '' });
  const [message, setMessage] = useState('');

  const loadStores = async () => {
    const result = await get<PlatformStoreRecord[]>(isSuperAdmin ? '/platform/stores' : '/stores');
    if (result.success && result.data) setStores(result.data);
  };

  useEffect(() => { void loadStores(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setMessage('请填写店家名称');
    const result = await post<StoreRecord>('/stores', {
      name: form.name.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      contact: form.contact.trim(),
    });
    if (result.success) {
      setForm({ name: '', city: '', address: '', contact: '' });
      setMessage('店家已创建');
      void loadStores();
    } else {
      setMessage(result.error || '创建失败');
    }
  };

  const enterStore = async (store: PlatformStoreRecord) => {
    const token = localStorage.getItem('admin_auth_token') || localStorage.getItem('auth_token');
    const userJson = localStorage.getItem('admin_user');
    if (!token || !userJson) {
      setMessage('当前登录状态异常，请重新登录');
      return;
    }
    const result = await post<{ token: string; user: unknown } >('/platform/impersonate-store', { storeId: store.id });
    if (!result.success || !result.data?.token) {
      setMessage(result.error || '进入店家视角失败');
      return;
    }
    localStorage.setItem('super_admin_token_backup', token);
    localStorage.setItem('super_admin_user_backup', userJson);
    localStorage.setItem('admin_auth_token', result.data.token);
    localStorage.setItem('auth_token', result.data.token);
    localStorage.setItem('admin_user', JSON.stringify(result.data.user));
    window.location.href = '/store/manage/schedule';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{isSuperAdmin ? '店家管理' : '我的店铺资料'}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {isSuperAdmin ? '超级管理员可以查看和新增平台店家。' : '当前账号只能看到自己绑定的店铺，排期、卡司、会员都会按店铺隔离。'}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">
            {isSuperAdmin ? 'SUPER ADMIN' : 'STORE'}
          </span>
        </div>

        {isSuperAdmin ? (
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="店家名称"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            <CityInput value={form.city} onChange={city => setForm({ ...form, city })} placeholder="搜索城市，如 成都"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="地址"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="联系方式"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            <button disabled={loading} className="md:col-span-4 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50">
              {loading ? '保存中...' : '新增店家'}
            </button>
          </form>
        ) : (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            需要修改店铺名称、城市或联系方式时，后续会在这里开放资料变更审核。
          </div>
        )}
        {message && <p className="text-sm text-gray-500 mt-3">{message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {stores.map(store => (
          <article key={store.id} className="bg-white rounded-lg shadow p-5 border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-800">{store.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{store.city || '未设置城市'}{store.address ? ` · ${store.address}` : ''}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 font-semibold">{store.status}</span>
            </div>
            {store.contact && <p className="text-sm text-gray-500 mt-3">联系：{store.contact}</p>}
            {isSuperAdmin && (
              <>
                <div className="grid grid-cols-5 gap-2 mt-4 text-center text-xs text-gray-500">
                  <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{store.admin_count || 0}</p><p>账号</p></div>
                  <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{store.script_count || 0}</p><p>剧本</p></div>
                  <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{store.schedule_count || 0}</p><p>排期</p></div>
                  <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{store.actor_count || 0}</p><p>卡司</p></div>
                  <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-gray-900">{store.customer_count || 0}</p><p>会员</p></div>
                </div>
                <button
                  type="button"
                  onClick={() => enterStore(store)}
                  disabled={loading}
                  className="mt-4 w-full px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-700 disabled:opacity-50"
                >
                  进入店家视角
                </button>
              </>
            )}
            <p className="text-xs text-gray-400 mt-4">店家ID：{store.id}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
