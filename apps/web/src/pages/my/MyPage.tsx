import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Edit,
  CreditCard,
  MessageCircle,
  FileText,
  LogOut,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/useProfile';
import { useSubscriptions, usePayments } from '@/hooks/usePayment';
import { useSupportInquiries } from '@/hooks/useSupport';
import { useLogout } from '@/hooks/useAuth';
import { ProfileEditModal } from './ProfileEditModal';
import { PaymentHistoryModal } from './PaymentHistoryModal';
import { SupportModal } from './SupportModal';
import { TermsModal } from './TermsModal';

export function MyPage() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const { data: subscriptions = [] } = useSubscriptions();
  const { data: payments = [] } = usePayments();
  const { data: inquiries = [] } = useSupportInquiries();
  const logout = useLogout();

  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsType, setTermsType] = useState<'service' | 'privacy'>('service');

  const activeSubscription = subscriptions.find((s) => s.status === 'active');
  const recentPayments = payments.slice(0, 3);

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await logout.mutateAsync();
      navigate('/login');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <h1 className="text-2xl font-bold text-brown-900">마이페이지</h1>

        {/* Profile Section */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brown-200 flex items-center justify-center overflow-hidden">
              {user?.profile?.profileImageUrl ? (
                <img
                  src={user.profile.profileImageUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-brown-600" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-brown-900">
                {user?.profile?.nickname || user?.email}
              </h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {activeSubscription && (
                <p className="text-xs text-green-600 mt-1">
                  {activeSubscription.planName} 구독 중
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowProfileEdit(true)}
            >
              <Edit className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Subscription & Payment */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowPaymentHistory(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-brown-600" />
              <div className="text-left">
                <p className="font-medium text-brown-900">결제 내역</p>
                <p className="text-xs text-muted-foreground">
                  {recentPayments.length > 0
                    ? `최근 ${recentPayments.length}건`
                    : '결제 내역이 없습니다'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Support */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowSupport(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-brown-600" />
              <div className="text-left">
                <p className="font-medium text-brown-900">고객지원</p>
                <p className="text-xs text-muted-foreground">
                  {inquiries.length > 0
                    ? `문의 ${inquiries.length}건`
                    : '1:1 문의하기'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Terms */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => {
              setTermsType('service');
              setShowTerms(true);
            }}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">서비스 이용약관</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => {
              setTermsType('privacy');
              setShowTerms(true);
            }}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">개인정보 처리방침</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => navigate('/payment?amount=9900&plan=프리미엄 플랜')}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">구독 관리</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={handleLogout}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">로그아웃</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Modals */}
      {showProfileEdit && (
        <ProfileEditModal
          user={user}
          onClose={() => setShowProfileEdit(false)}
        />
      )}
      {showPaymentHistory && (
        <PaymentHistoryModal
          subscriptions={subscriptions}
          payments={payments}
          onClose={() => setShowPaymentHistory(false)}
        />
      )}
      {showSupport && (
        <SupportModal
          inquiries={inquiries}
          onClose={() => setShowSupport(false)}
        />
      )}
      {showTerms && (
        <TermsModal
          type={termsType}
          onClose={() => setShowTerms(false)}
        />
      )}
    </div>
  );
}
