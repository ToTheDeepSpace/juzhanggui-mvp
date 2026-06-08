import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import CheckInPage from './pages/CheckInPage';
import EvaluationPage from './pages/EvaluationPage';
import LandingPage from './pages/LandingPage';
import DemoPage from './pages/DemoPage';
import StorePortal from './pages/StorePortal';
import DmDashboard from './pages/DmDashboard';
import PlayerJoinSchedulePage from './pages/PlayerJoinSchedulePage';
import { AiReadablePage, BusinessLicensePage, ContactPage, PrivacyPage, TermsPage } from './pages/LegalPages';

const LINGQI_SITE_URL = (import.meta.env.VITE_LINGQI_SITE_URL || 'https://lingqi.jusichen.com').replace(/\/$/, '');

function ExternalRedirect({ to, label }: { to: string; label: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-300">正在前往{label}</p>
        <a href={to} className="inline-block mt-3 text-sm text-indigo-300 hover:text-indigo-200">
          没有自动跳转就点这里
        </a>
      </div>
    </div>
  );
}

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
          <Route path="/join/:scheduleId" element={<PlayerJoinSchedulePage />} />

          {/* 系统演示 */}
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/business-license" element={<BusinessLicensePage />} />
          <Route path="/ai-readable" element={<AiReadablePage />} />

          {/* 用户身份统一放到灵契 */}
          <Route path="/player/login" element={<ExternalRedirect to={`${LINGQI_SITE_URL}/login?from=jusichen&role=player`} label="灵契玩家页" />} />
          <Route path="/player/dashboard" element={<ExternalRedirect to={`${LINGQI_SITE_URL}/dashboard?from=jusichen`} label="灵契玩家页" />} />

          {/* 店家端入口 */}
          <Route path="/store" element={<StorePortal />} />

          {/* DM 公开身份在灵契，店内工作流保留在剧司辰 */}
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
