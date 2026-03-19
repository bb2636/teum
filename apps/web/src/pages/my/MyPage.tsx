import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Edit,
  CreditCard,
  MessageCircle,
  FileText,
  LogOut,
  ChevronRight,
  X,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useMe } from '@/hooks/useProfile';
import { useSubscriptions } from '@/hooks/usePayment';
import { useSupportInquiries } from '@/hooks/useSupport';
import { useLogout } from '@/hooks/useAuth';
import { TermsModal } from './TermsModal';
import { setLanguageFromCountry } from '@/lib/i18n';

export function MyPage() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const { data: subscriptions = [] } = useSubscriptions();
  const { data: inquiries = [] } = useSupportInquiries();
  const logout = useLogout();

  const [showTerms, setShowTerms] = useState(false);
  const [showTermsList, setShowTermsList] = useState(false);
  const [termsType, setTermsType] = useState<'service' | 'privacy'>('service');

  const promoDismissed = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('teum_profile_promo_dismissed') === '1';
  }, []);
  const [showPromo, setShowPromo] = useState(!promoDismissed);
  const dismissPromo = () => {
    setShowPromo(false);
    try {
      localStorage.setItem('teum_profile_promo_dismissed', '1');
    } catch (_) {}
  };

  const activeSubscription = subscriptions.find((s) => s.status === 'active');
  
  // 사용자 프로필의 국가 정보로 언어 설정
  useEffect(() => {
    if (user?.profile?.country) {
      setLanguageFromCountry(user.profile.country);
    }
  }, [user?.profile?.country]);
  
  // 다음 결제일 (endDate = 한 달 뒤)
  const nextPaymentDateStr = activeSubscription?.endDate
    ? (() => {
        const d = new Date(activeSubscription.endDate);
        return Number.isNaN(d.getTime())
          ? null
          : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      })()
    : null;

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
        <h1 className="text-2xl font-bold text-brown-900">프로필</h1>

        {/* Profile Section - 가운데 정렬 (아바타 + 닉네임) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-brown-200 flex items-center justify-center overflow-hidden">
              {user?.profile?.profileImageUrl ? (
                <img
                  src={user.profile.profileImageUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-brown-600" />
              )}
            </div>
            <h2 className="font-semibold text-brown-900 mt-2">
              {user?.profile?.nickname || user?.email}
            </h2>
          </div>
        </div>

        {/* 기록이 곧~ 팝업 카드 (닫기 전) */}
        {showPromo && (
          <div className="bg-gray-100 rounded-xl p-4 shadow-sm relative">
            <div className="flex items-start justify-between gap-2">
              <Logo size="sm" showText={false} className="shrink-0" />
              <button
                type="button"
                onClick={dismissPromo}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-500 shrink-0"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h3 className="text-lg font-semibold text-brown-900 mt-2">
              기록이 곧, 당신만의 트랙이 됩니다.
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              일기의 감정이 그대로 담긴 단 하나의 선물입니다. 기록하는 순간, 새로운 음악이 태어납니다.
            </p>
          </div>
        )}

        {/* 구독 상태 카드 (팝업 닫은 후 표시) */}
        {!showPromo && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-brown-900">
                {activeSubscription ? '구독중' : '미구독'}
              </span>
            </div>
            {activeSubscription && nextPaymentDateStr && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>다음 결제일</span>
                <span>{nextPaymentDateStr}</span>
              </div>
            )}
          </div>
        )}

        {/* 메뉴: 프로필 편집, 결제 내역, 약관 보기, 고객 지원, 로그아웃 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => navigate('/my/profile-edit')}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100"
          >
            <div className="flex items-center gap-3">
              <Edit className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">프로필 편집</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate('/my/payment-history')}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">결제 내역</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowTermsList(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">약관 보기</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate('/my/support')}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100"
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">고객 지원</span>
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
      {showTermsList && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowTermsList(false)}>
          <div
            className="bg-white rounded-t-2xl w-full max-w-md shadow-lg pb-safe min-h-[40vh] max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-brown-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-brown-900">약관 보기</h2>
              <button type="button" onClick={() => setShowTermsList(false)} className="p-1" aria-label="닫기">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="divide-y divide-brown-100 overflow-y-auto flex-1 py-2">
              <button
                type="button"
                onClick={() => {
                  setTermsType('service');
                  setShowTermsList(false);
                  setShowTerms(true);
                }}
                className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors text-left"
              >
                <span className="font-medium text-brown-900">서비스 이용약관</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTermsType('privacy');
                  setShowTermsList(false);
                  setShowTerms(true);
                }}
                className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors text-left"
              >
                <span className="font-medium text-brown-900">개인정보 처리방침</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            </div>
          </div>
        </div>
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
