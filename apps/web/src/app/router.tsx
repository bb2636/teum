import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from './providers';
import { SplashPage } from '../pages/auth/SplashPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { HomePage } from '../pages/home/HomePage';
import { CalendarPage } from '../pages/calendar/CalendarPage';
import { DiaryListPage } from '../pages/diaries/DiaryListPage';
import { DiaryDetailPage } from '../pages/diaries/DiaryDetailPage';
import { DiaryWritePage } from '../pages/diaries/DiaryWritePage';
import { CreateFolderPage } from '../pages/diaries/CreateFolderPage';
import { MusicHomePage } from '../pages/music/MusicHomePage';
import { MusicJobPage } from '../pages/music/MusicJobPage';
import { MyPage } from '../pages/my/MyPage';
import { PaymentPage } from '../pages/payment/PaymentPage';
import { AdminPage } from '../pages/admin/AdminPage';
import { apiRequest } from '../lib/api';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      try {
        const response = await apiRequest<{ data: { user: any } }>('/users/me');
        return response.data.user;
      } catch {
        return null;
      }
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/splash" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
          path="/music"
          element={
            <ProtectedRoute>
              <MusicHomePage />
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
              <PaymentPage />
            </ProtectedRoute>
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
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/splash" replace />} />
      </Routes>
    </Layout>
  );
}
