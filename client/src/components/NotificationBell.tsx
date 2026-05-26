import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  schedule_id: string | null;
  is_read: number;
  created_at: string;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { get, put } = useApi();

  const fetchNotifications = useCallback(async () => {
    const result = await get<{ notifications: Notification[]; unreadCount: number }>('/notifications');
    if (result.success && result.data) {
      setNotifications(result.data.notifications);
      setUnreadCount(result.data.unreadCount);
    }
  }, [get]);

  // 初始加载
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 定时轮询（每 30 秒）
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    await put(`/notifications/${id}/read`, {});
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await put('/notifications/read-all', {});
    fetchNotifications();
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'schedule_start': return '▶️';
      case 'schedule_end': return '🏁';
      case 'payment_due': return '💰';
      default: return '🔔';
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full 
                           w-4.5 h-4.5 flex items-center justify-center min-w-[18px]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <span className="font-medium text-gray-800">通知</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-sky-600 hover:text-sky-700"
              >
                全部已读
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">暂无通知</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                  className={`flex items-start gap-3 p-3 border-b border-gray-50 cursor-pointer transition-colors
                    ${n.is_read ? 'bg-white' : 'bg-sky-50 hover:bg-sky-100'}`}
                >
                  <span className="text-lg mt-0.5">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</div>
                    <div className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 bg-sky-500 rounded-full mt-2 flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
