import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RoomManager from './RoomManager';
import ActorManager from './ActorManager';
import ScriptManager from './ScriptManager';
import ScheduleCalendar from './ScheduleCalendar';
import CustomerManager from './CustomerManager';
import ConflictResolutionPage from '../pages/ConflictResolutionPage';

type Tab = 'rooms' | 'actors' | 'scripts' | 'schedule' | 'customers' | 'conflicts';

const tabs = [
  { id: 'schedule' as Tab, label: '📅 排期管理', color: 'bg-blue-500', path: '/schedule' },
  { id: 'rooms' as Tab, label: '🚪 房间管理', color: 'bg-green-500', path: '/rooms' },
  { id: 'actors' as Tab, label: '🎭 卡司管理', color: 'bg-purple-500', path: '/actors' },
  { id: 'scripts' as Tab, label: '📖 剧本管理', color: 'bg-orange-500', path: '/scripts' },
  { id: 'customers' as Tab, label: '⭐ 会员管理', color: 'bg-yellow-500', path: '/customers' },
  { id: 'conflicts' as Tab, label: '⚖️ 矛盾调解', color: 'bg-red-500', path: '/conflicts' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  
  const currentPath = location.pathname;
  const activeTab = tabs.find(t => t.path === currentPath)?.id || 'schedule';

  const handleTabChange = (tabId: Tab) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      navigate(tab.path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">剧本杀排期系统</h1>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              退出登录
            </button>
          </div>
          <nav className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? `${tab.color} text-white shadow-md`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/rooms" element={<RoomManager />} />
          <Route path="/actors" element={<ActorManager />} />
          <Route path="/scripts" element={<ScriptManager />} />
          <Route path="/schedule" element={<ScheduleCalendar />} />
          <Route path="/customers" element={<CustomerManager />} />
          <Route path="/conflicts" element={<ConflictResolutionPage />} />
          <Route path="/" element={<Navigate to="/schedule" replace />} />
        </Routes>
      </main>
    </div>
  );
}
