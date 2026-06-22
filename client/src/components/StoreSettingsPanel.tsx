import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import type { StoreRecord } from '../types';
import { selectStoreForSettings } from '../utils/storeSettings';

type StoreSettingsForm = {
  name: string;
  city: string;
  address: string;
  contact: string;
  defaultDepositAmount: string;
  earlyFeeEnabled: boolean;
  earlyFeeStartTime: string;
  earlyFeeEndTime: string;
  earlyFeeAmountPerHour: string;
  nightFeeEnabled: boolean;
  nightFeeStartTime: string;
  nightFeeEndTime: string;
  nightFeeAmountPerHour: string;
};

const emptyForm: StoreSettingsForm = {
  name: '',
  city: '',
  address: '',
  contact: '',
  defaultDepositAmount: '100',
  earlyFeeEnabled: true,
  earlyFeeStartTime: '00:00',
  earlyFeeEndTime: '12:00',
  earlyFeeAmountPerHour: '10',
  nightFeeEnabled: true,
  nightFeeStartTime: '00:30',
  nightFeeEndTime: '06:00',
  nightFeeAmountPerHour: '10',
};

function centsToYuan(value?: number, fallback = 0) {
  return String(Math.round(Number(value ?? fallback) / 100));
}

function yuanToCents(value: string) {
  return Math.max(0, Math.round((Number(value || 0) || 0) * 100));
}

function formFromStore(store: StoreRecord): StoreSettingsForm {
  return {
    name: store.name || '',
    city: store.city || '',
    address: store.address || '',
    contact: store.contact || '',
    defaultDepositAmount: centsToYuan(store.default_deposit_amount, 10000),
    earlyFeeEnabled: store.early_fee_enabled !== false,
    earlyFeeStartTime: store.early_fee_start_time || '00:00',
    earlyFeeEndTime: store.early_fee_end_time || '12:00',
    earlyFeeAmountPerHour: centsToYuan(store.early_fee_amount_per_hour, 1000),
    nightFeeEnabled: store.night_fee_enabled !== false,
    nightFeeStartTime: store.night_fee_start_time || '00:30',
    nightFeeEndTime: store.night_fee_end_time || '06:00',
    nightFeeAmountPerHour: centsToYuan(store.night_fee_amount_per_hour, 1000),
  };
}

export default function StoreSettingsPanel() {
  const { get, put, loading } = useApi();
  const { user } = useAuth();
  const [store, setStore] = useState<StoreRecord | null>(null);
  const [form, setForm] = useState<StoreSettingsForm>(emptyForm);
  const [message, setMessage] = useState('');
  const [loadMessage, setLoadMessage] = useState('');
  const [extrasReturned, setExtrasReturned] = useState(false);

  const loadStore = async () => {
    setMessage('');
    setLoadMessage('');
    const result = await get<StoreRecord[]>('/stores');
    if (!result.success || !result.data) {
      setStore(null);
      setLoadMessage(result.error || '店铺资料加载失败');
      return;
    }
    const selected = selectStoreForSettings(result.data, user);
    setExtrasReturned(selected.extrasReturned);
    setStore(selected.store);
    if (selected.store) {
      setForm(formFromStore(selected.store));
    } else {
      setLoadMessage('没有找到当前账号绑定的店铺，请联系超管检查账号绑定。');
    }
  };

  useEffect(() => {
    void loadStore();
  }, [user?.storeId, user?.tenantId]);

  const updateForm = <K extends keyof StoreSettingsForm>(key: K, value: StoreSettingsForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!store) return;
    if (!form.name.trim()) {
      setMessage('请填写店铺名称');
      return;
    }
    setMessage('');
    const result = await put<StoreRecord>(`/stores/${store.id}/settings`, {
      name: form.name.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      contact: form.contact.trim(),
      defaultDepositAmount: yuanToCents(form.defaultDepositAmount),
      earlyFeeEnabled: form.earlyFeeEnabled,
      earlyFeeStartTime: form.earlyFeeStartTime,
      earlyFeeEndTime: form.earlyFeeEndTime,
      earlyFeeAmountPerHour: yuanToCents(form.earlyFeeAmountPerHour),
      nightFeeEnabled: form.nightFeeEnabled,
      nightFeeStartTime: form.nightFeeStartTime,
      nightFeeEndTime: form.nightFeeEndTime,
      nightFeeAmountPerHour: yuanToCents(form.nightFeeAmountPerHour),
    });
    if (result.success && result.data) {
      setStore(result.data);
      setForm(formFromStore(result.data));
      setMessage('店铺设置已保存');
    } else {
      setMessage(result.error || '保存失败');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-5 shadow">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">店铺设置</h2>
            <p className="mt-1 text-sm text-gray-500">这里只能修改当前账号绑定店铺的主页资料和结算规则。</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            {store?.name || '当前店铺'}
          </span>
        </div>

        {extrasReturned && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            接口返回了多条店铺记录，页面已只保留当前账号绑定店铺；请联系超管检查账号绑定。
          </div>
        )}

        {loadMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadMessage}
          </div>
        )}

        {store && (
          <form onSubmit={submit} className="space-y-5">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">主页资料</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">店铺名称</span>
                  <input
                    value={form.name}
                    onChange={event => updateForm('name', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    placeholder="店铺名称"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">城市</span>
                  <input
                    value={form.city}
                    onChange={event => updateForm('city', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    placeholder="城市"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">地址</span>
                  <input
                    value={form.address}
                    onChange={event => updateForm('address', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    placeholder="店铺地址"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">联系方式</span>
                  <input
                    value={form.contact}
                    onChange={event => updateForm('contact', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    placeholder="电话 / 微信 / 其他联系方式"
                  />
                </label>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">结算规则</h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">默认定金（元）</span>
                  <input
                    type="number"
                    min="0"
                    value={form.defaultDepositAmount}
                    onChange={event => updateForm('defaultDepositAmount', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </label>
                <div className="rounded-lg border border-gray-200 p-3">
                  <label className="mb-3 flex items-center justify-between gap-3 text-sm font-medium text-gray-700">
                    早起费
                    <input
                      type="checkbox"
                      checked={form.earlyFeeEnabled}
                      onChange={event => updateForm('earlyFeeEnabled', event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="time" value={form.earlyFeeStartTime} onChange={event => updateForm('earlyFeeStartTime', event.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    <input type="time" value={form.earlyFeeEndTime} onChange={event => updateForm('earlyFeeEndTime', event.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    <input type="number" min="0" value={form.earlyFeeAmountPerHour} onChange={event => updateForm('earlyFeeAmountPerHour', event.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" placeholder="元/时" />
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <label className="mb-3 flex items-center justify-between gap-3 text-sm font-medium text-gray-700">
                    修仙费
                    <input
                      type="checkbox"
                      checked={form.nightFeeEnabled}
                      onChange={event => updateForm('nightFeeEnabled', event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="time" value={form.nightFeeStartTime} onChange={event => updateForm('nightFeeStartTime', event.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    <input type="time" value={form.nightFeeEndTime} onChange={event => updateForm('nightFeeEndTime', event.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    <input type="number" min="0" value={form.nightFeeAmountPerHour} onChange={event => updateForm('nightFeeAmountPerHour', event.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" placeholder="元/时" />
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存设置'}
              </button>
              <button
                type="button"
                onClick={() => void loadStore()}
                disabled={loading}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
              >
                重新加载
              </button>
              {message && <span className="text-sm text-gray-500">{message}</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
