import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { t } from '../lib/i18n';
import { Layout } from './providers';
import { HideTabBarProvider } from '../contexts/HideTabBarContext';
import { SplashPage } from '../pages/auth/SplashPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { useMe } from '../hooks/useProfile';

const SignupPage = lazy(() => import('../pages/auth/SignupPage').then(m => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const SocialOnboardingPage = lazy(() => import('../pages/auth/SocialOnboardingPage').then(m => ({ default: m.SocialOnboardingPage })));
const MobileLoginCompletePage = lazy(() => import('../pages/auth/MobileLoginCompletePage').then(m => ({ default: m.MobileLoginCompletePage })));
const LoginRedirectPage = lazy(() => import('../pages/auth/LoginRedirectPage').then(m => ({ default: m.LoginRedirectPage })));
const HomePage = lazy(() => import('../pages/home/HomePage').then(m => ({ default: m.HomePage })));
const CalendarPage = lazy(() => import('../pages/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })));
const DiaryListPage = lazy(() => import('../pages/diaries/DiaryListPage').then(m => ({ default: m.DiaryListPage })));
const DiaryDetailPage = lazy(() => import('../pages/diaries/DiaryDetailPage').then(m => ({ default: m.DiaryDetailPage })));
const DiaryWritePage = lazy(() => import('../pages/diaries/DiaryWritePage').then(m => ({ default: m.DiaryWritePage })));
const CreateFolderPage = lazy(() => import('../pages/diaries/CreateFolderPage').then(m => ({ default: m.CreateFolderPage })));
const MusicHomePage = lazy(() => import('../pages/music/MusicHomePage').then(m => ({ default: m.MusicHomePage })));
const MusicCreatePage = lazy(() => import('../pages/music/MusicCreatePage').then(m => ({ default: m.MusicCreatePage })));
const MusicJobPage = lazy(() => import('../pages/music/MusicJobPage').then(m => ({ default: m.MusicJobPage })));
const MusicListPage = lazy(() => import('../pages/music/MusicListPage').then(m => ({ default: m.MusicListPage })));
const MyPage = lazy(() => import('../pages/my/MyPage').then(m => ({ default: m.MyPage })));
const ProfileEditPage = lazy(() => import('../pages/my/ProfileEditPage').then(m => ({ default: m.ProfileEditPage })));
const PaymentIntroPage = lazy(() => import('../pages/payment/PaymentIntroPage').then(m => ({ default: m.PaymentIntroPage })));
const PaymentPage = lazy(() => import('../pages/payment/PaymentPage').then(m => ({ default: m.PaymentPage })));
const PaymentSuccessPage = lazy(() => import('../pages/payment/PaymentSuccessPage').then(m => ({ default: m.PaymentSuccessPage })));
const PaymentHistoryPage = lazy(() => import('../pages/my/PaymentHistoryPage').then(m => ({ default: m.PaymentHistoryPage })));
const PaymentFailPage = lazy(() => import('../pages/payment/PaymentFailPage').then(m => ({ default: m.PaymentFailPage })));
const SupportPage = lazy(() => import('../pages/my/SupportPage').then(m => ({ default: m.SupportPage })));
const SupportInquiryPage = lazy(() => import('../pages/my/SupportInquiryPage').then(m => ({ default: m.SupportInquiryPage })));
const AdminPage = lazy(() => import('../pages/admin/AdminPage').then(m => ({ default: m.AdminPage })));
const AdMobTestPage = lazy(() => import('../pages/admin/AdMobTestPage').then(m => ({ default: m.AdMobTestPage })));
const PrivacyPolicyPage = lazy(() => import('../pages/legal/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));

function RootRedirect() {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-muted-foreground"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/home'} replace />;
  }

  return <Navigate to="/splash" replace />;
}

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/splash" replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}

// Admin Route Component - 관리자가 아니면 로그인 페이지로
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/splash" replace />;
  }

  return <>{children}</>;
}

function LazyFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-muted-foreground"></div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LazyFallback />}>
    <Routes>
      {/* Admin page - no Layout wrapper */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      
      <Route
        path="/admob-test"
        element={<AdMobTestPage />}
      />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />

      {/* Other routes - with Layout wrapper */}
      <Route
        path="*"
        element={
          <HideTabBarProvider>
            <Layout>
              <Routes>
              <Route path="/splash" element={<SplashPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/social-onboarding" element={<SocialOnboardingPage />} />
              <Route path="/mobile-login-complete" element={<MobileLoginCompletePage />} />
              <Route path="/login-redirect" element={<LoginRedirectPage />} />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <CalendarPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/diaries"
                element={
                  <ProtectedRoute>
                    <DiaryListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/diaries/new"
                element={
                  <ProtectedRoute>
                    <DiaryWritePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/folders/new"
                element={
                  <ProtectedRoute>
                    <CreateFolderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/diaries/:id"
                element={
                  <ProtectedRoute>
                    <DiaryDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/diaries/:id/edit"
                element={
                  <ProtectedRoute>
                    <DiaryWritePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/music"
                element={
                  <ProtectedRoute>
                    <MusicHomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/music/list"
                element={
                  <ProtectedRoute>
                    <MusicListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/music/create"
                element={
                  <ProtectedRoute>
                    <MusicCreatePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/music/jobs/:jobId"
                element={
                  <ProtectedRoute>
                    <MusicJobPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payment"
                element={
                  <ProtectedRoute>
                    <PaymentIntroPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payment/checkout"
                element={
                  <ProtectedRoute>
                    <PaymentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payment/success"
                element={
                  <ProtectedRoute>
                    <PaymentSuccessPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payment/fail"
                element={
                  <PaymentFailPage />
                }
              />
              <Route
                path="/my"
                element={
                  <ProtectedRoute>
                    <MyPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my/profile-edit"
                element={
                  <ProtectedRoute>
                    <ProfileEditPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my/payment-history"
                element={
                  <ProtectedRoute>
                    <PaymentHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my/support"
                element={
                  <ProtectedRoute>
                    <SupportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my/support/inquiry"
                element={
                  <ProtectedRoute>
                    <SupportInquiryPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<RootRedirect />} />
              </Routes>
            </Layout>
          </HideTabBarProvider>
        }
      />
    </Routes>
    </Suspense>
  );
}
