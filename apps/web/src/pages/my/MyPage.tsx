import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pencil,
  FileText,
  ClipboardList,
  HelpCircle,
  LogOut,
  ChevronRight,
  X,
} from 'lucide-react';
import { useMe } from '@/hooks/useProfile';
import { useSubscriptions, getEffectiveSubscription } from '@/hooks/usePayment';
import { useSupportInquiries } from '@/hooks/useSupport';
import { useLogout } from '@/hooks/useAuth';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { apiRequest } from '@/lib/api';
import { TermsModal } from './TermsModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useT } from '@/hooks/useTranslation';
import { getCurrentLanguage, type Language } from '@/lib/i18n';

const TERMS_TITLE_EN: Record<string, string> = {
  '서비스 이용약관': 'Terms of Service',
  '개인정보 처리방침': 'Privacy Policy',
  '정기결제/자동갱신': 'Recurring Payment / Auto-Renewal',
  '환불/취소 정책': 'Refund / Cancellation Policy',
  '정기 결제 및 자동 갱신': 'Recurring Payment & Auto-Renewal',
  '환불/해지 정책': 'Refund / Cancellation Policy',
};

type TermsItem = {
  type: string;
  title: string;
  version: string;
  updatedAt: string | null;
};

export function MyPage() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const t = useT();
  const { setLanguage } = useLanguage();
  const { data: subscriptions = [] } = useSubscriptions();
  useSupportInquiries();
  const logout = useLogout();
  const { setHideTabBar } = useHideTabBar();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showTermsList, setShowTermsList] = useState(false);
  const [termsType, setTermsType] = useState<string>('service');
  const [termsList, setTermsList] = useState<TermsItem[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);

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

  const activeSubscription = getEffectiveSubscription(subscriptions);
  
  useEffect(() => {
    return () => setHideTabBar(false);
  }, [setHideTabBar]);

  useEffect(() => {
    if (user?.profile?.language) {
      setLanguage(user.profile.language as Language);
    }
  }, [user?.profile?.language]);
  
  // 다음 결제일 (endDate = 한 달 뒤)
  const nextPaymentDateStr = activeSubscription?.endDate
    ? (() => {
        const d = new Date(activeSubscription.endDate);
        return Number.isNaN(d.getTime())
          ? null
          : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      })()
    : null;

  const openTermsList = async () => {
    setShowTermsList(true);
    setHideTabBar(true);
    setTermsLoading(true);
    try {
      const res = await apiRequest<{ data: TermsItem[] }>('/terms/all');
      setTermsList(res.data);
    } catch {
      setTermsList([]);
    } finally {
      setTermsLoading(false);
    }
  };

  const closeTermsList = () => {
    setShowTermsList(false);
    setHideTabBar(false);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // ignore
    }
    setShowLogoutConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-beige-50 flex flex-col overflow-hidden">
      <div className="shrink-0 max-w-md mx-auto w-full px-4 pb-2" style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 24px))' }}>
        <h1 className="text-2xl font-bold text-brown-900">{t('my.profile')}</h1>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto max-w-md mx-auto w-full px-4 pb-20 space-y-4">

        {/* Profile Section - 가운데 정렬 (아바타 + 닉네임) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-[#4A2C1A] flex items-center justify-center">
              <span className="text-white text-2xl font-medium">
                {user?.profile?.nickname
                  ? user.profile.nickname.charAt(0).toUpperCase()
                  : user?.profile?.name
                  ? user.profile.name.charAt(0).toUpperCase()
                  : user?.email
                  ? user.email.charAt(0).toUpperCase()
                  : 'U'}
              </span>
            </div>
            <h2 className="font-semibold text-brown-900 mt-2">
              {user?.profile?.nickname || user?.email}
            </h2>
          </div>
        </div>

        {showPromo && (
          <div className="bg-gray-100 rounded-xl p-4 shadow-sm relative">
            <div className="flex items-start justify-between gap-2">
              <img
                src="/mureka_logo.png"
                alt="Mureka"
                className="h-4 w-auto shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
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
              {t('my.promoTitle')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
              {t('my.promoDesc')}
            </p>
          </div>
        )}

        {/* 구독 상태 카드 (팝업 닫은 후 표시) */}
        {!showPromo && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-brown-900">
                {activeSubscription
                  ? activeSubscription.status === 'cancelled'
                    ? t('my.subscriptionCancelled')
                    : t('my.subscribing')
                  : t('my.notSubscribed')}
              </span>
            </div>
            {activeSubscription && nextPaymentDateStr && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {activeSubscription.status === 'cancelled'
                    ? t('my.availableUntil')
                    : t('my.nextPaymentDate')}
                </span>
                <span>{nextPaymentDateStr}</span>
              </div>
            )}
          </div>
        )}

        {/* 메뉴: 프로필 편집, 결제 내역, 약관 보기, 고객 지원, 로그아웃 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => navigate('/my/profile-edit')}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100 menu-item-tap"
          >
            <div className="flex items-center gap-3">
              <Pencil className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">{t('my.profileEdit')}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate('/my/payment-history')}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100 menu-item-tap"
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">{t('my.paymentHistory')}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={openTermsList}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100 menu-item-tap"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">{t('my.viewTerms')}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate('/my/support')}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors border-b border-brown-100 menu-item-tap"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">{t('my.customerSupport')}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={handleLogout}
            className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors menu-item-tap"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-brown-600" />
              <span className="font-medium text-brown-900">{t('auth.logout')}</span>
            </div>
          </button>
        </div>

        <footer className="pt-4 pb-2 text-xs text-gray-400 leading-relaxed">
          <div className="space-y-1">
            <p className="font-medium text-gray-500">TEUM</p>
            <p>{t('my.footer.companyName')} | {t('my.footer.ceo')}</p>
            <p>{t('my.footer.bizNumber')}</p>
            <p>{t('my.footer.salesNumber')}</p>
            <p>{t('my.footer.email')}</p>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => { setTermsType('service'); setShowTerms(true); }}
              className="text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              {t('my.footer.terms')}
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => { setTermsType('privacy'); setShowTerms(true); }}
              className="text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              {t('my.footer.privacy')}
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => { setTermsType('refund'); setShowTerms(true); }}
              className="text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              {t('my.footer.refund')}
            </button>
          </div>
          <p className="mt-3 text-gray-300">{t('my.footer.version')} 1.0.0</p>
          <p className="mt-1 text-gray-300">{t('my.footer.copyright')}</p>
        </footer>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 mb-6">{t('auth.logoutConfirm')}</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 py-2.5 border border-brown-200 text-brown-700 rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => setShowLogoutConfirm(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 bg-[#4A2C1A] hover:bg-[#3A2010] text-white rounded-full transition-colors"
                onClick={handleLogoutConfirm}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showTermsList && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-overlay-fade" onClick={closeTermsList}>
          <div
            className="bg-white rounded-t-2xl w-full max-w-md shadow-lg pb-safe min-h-[40vh] max-h-[70vh] flex flex-col animate-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-brown-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-brown-900">{t('my.viewTerms')}</h2>
              <button type="button" onClick={closeTermsList} className="p-1" aria-label="닫기">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="divide-y divide-brown-100 overflow-y-auto flex-1 py-2">
              {termsLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
              ) : termsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('terms.noTerms')}</div>
              ) : (
                termsList.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setTermsType(item.type);
                      closeTermsList();
                      setShowTerms(true);
                    }}
                    className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors text-left"
                  >
                    <span className="font-medium text-brown-900">{getCurrentLanguage() === 'en' ? (TERMS_TITLE_EN[item.title] || item.title) : item.title}</span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
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
