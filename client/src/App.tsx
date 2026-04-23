import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TourProvider } from './context/TourContext';
import AppTour from './components/Tour/AppTour';
import ProjectsDashboard from './components/Projects/ProjectsDashboard';
import ProjectEditor from './pages/ProjectEditor';
import SignInDemo from './pages/SignInDemo';
import PricingPage from './pages/PricingPage';
import LandingPage from './pages/LandingPage';
import { useEffect, useState, type ReactNode } from 'react';
import { PLAN_LABELS, type Plan } from './lib/plan';
import { loadSavedTheme } from './utils/appThemes';

// Apply persisted theme before first render
loadSavedTheme();

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function UpgradeBanner() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [planLabel, setPlanLabel] = useState('');

  useEffect(() => {
    const upgraded = params.get('upgraded') as Plan | null;
    if (upgraded && PLAN_LABELS[upgraded]) {
      setPlanLabel(PLAN_LABELS[upgraded]);
      setVisible(true);
      // Clean the URL
      navigate('/dashboard', { replace: true });
      const t = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
      color: '#fff', padding: '12px 24px', borderRadius: 12,
      fontSize: 14, fontWeight: 600, zIndex: 9999,
      boxShadow: '0 8px 32px rgba(139,92,246,0.4)',
      display: 'flex', alignItems: 'center', gap: 10,
      whiteSpace: 'nowrap',
    }}>
      <span>🎉</span>
      <span>Welcome to {planLabel}! Your account has been upgraded.</span>
      <button onClick={() => setVisible(false)} style={{ marginLeft: 8, opacity: 0.7, fontSize: 16, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>×</button>
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <AppTour />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<SignInDemo />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ProjectsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute>
              <ProjectEditor />
            </ProtectedRoute>
          }
        />
        {/* Any unknown path falls back to the landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpgradeBanner />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <TourProvider>
        <AppRoutes />
      </TourProvider>
    </AuthProvider>
  );
}

export default App;
