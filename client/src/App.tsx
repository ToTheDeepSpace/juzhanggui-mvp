import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import CheckInPage from './pages/CheckInPage';
import EvaluationPage from './pages/EvaluationPage';
import PlayerLogin from './pages/PlayerLogin';
import PlayerDashboard from './pages/PlayerDashboard';
import LandingPage from './pages/LandingPage';
import DemoPage from './pages/DemoPage';
import StorePortal from './pages/StorePortal';
import DmDashboard from './pages/DmDashboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/store/manage" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 品牌首页 */}
          <Route path="/" element={<LandingPage />} />

          {/* 公开页面：签到、评价 */}
          <Route path="/checkin/:scheduleId" element={<CheckInPage />} />
          <Route path="/evaluate/:scheduleId" element={<EvaluationPage />} />

          {/* 系统演示 */}
          <Route path="/demo" element={<DemoPage />} />

          {/* 玩家端 */}
          <Route path="/player/login" element={<PlayerLogin />} />
          <Route path="/player/dashboard" element={<PlayerDashboard />} />

          {/* 店家端入口 */}
          <Route path="/store" element={<StorePortal />} />

          {/* DM/卡司工作台 */}
          <Route path="/store/dm" element={<DmDashboard />} />

          {/* 店长登录 */}
          <Route path="/login" element={
            <PublicOnlyRoute><LoginPage /></PublicOnlyRoute>
          } />

          {/* 店长管理后台 */}
          <Route path="/store/manage/*" element={
            <ProtectedRoute><MainLayout /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
