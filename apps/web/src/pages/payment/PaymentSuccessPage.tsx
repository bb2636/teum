import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Music, PenLine, ChevronRight, type LucideIcon } from 'lucide-react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@/hooks/useTranslation';

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const { setHideTabBar } = useHideTabBar();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(0);
  const t = useT();

  type GuidePage = {
    id: string;
    title: string;
    subtitle: string | null;
    icon: LucideIcon | null;
    tips?: string[];
    extraInfo?: string;
  };

  const GUIDE_PAGES: GuidePage[] = [
    {
      id: 'welcome',
      title: t('payment.success.subscriptionStarted'),
      subtitle: t('payment.success.analyzeAndCreate'),
      icon: null,
    },
    {
      id: 'how-to',
      icon: PenLine,
      title: t('payment.success.howToWrite'),
      subtitle: null,
      tips: [
        t('payment.success.tip1'),
        t('payment.success.tip2'),
        t('payment.success.tip3'),
        t('payment.success.tip4'),
      ],
    },
    {
      id: 'music-per-diaries',
      icon: Music,
      title: t('payment.success.musicPerDiaries'),
      subtitle: t('payment.success.musicPerDiariesDesc'),
      extraInfo: t('payment.success.moreDiaries'),
    },
  ];

  useEffect(() => {
    setHideTabBar(true);
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['music', 'jobs'] });
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar, queryClient]);

  const isLastPage = currentPage === GUIDE_PAGES.length - 1;
  const page = GUIDE_PAGES[currentPage];

  const handleNext = () => {
    if (isLastPage) return;
    setCurrentPage((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex justify-end p-4">
        <button
          onClick={() => navigate('/home')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-[#4A2C1A]" />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6" key={page.id}>
        {page.icon && (
          <div className="mb-8 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-[#F5F0EB] flex items-center justify-center">
              <page.icon className="w-8 h-8 text-[#665146]" />
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold text-[#4A2C1A] leading-tight animate-fade-in whitespace-pre-line">
          {page.title}
        </h1>

        {page.subtitle && (
          <p className="text-base text-gray-500 leading-relaxed mt-4 animate-fade-in whitespace-pre-line" style={{ animationDelay: '100ms' }}>
            {page.subtitle}
          </p>
        )}

        {page.extraInfo && (
          <div className="mt-8 bg-[#F9F6F3] rounded-2xl p-5 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <p className="text-sm font-medium text-[#665146] leading-relaxed">{page.extraInfo}</p>
          </div>
        )}

        {page.tips && (
          <div className="mt-6 space-y-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
            {page.tips.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-[#F9F6F3] rounded-xl p-4 animate-fade-in"
                style={{ animationDelay: `${150 + i * 80}ms` }}
              >
                <span className="text-[#665146] font-bold text-sm mt-0.5">{i + 1}</span>
                <p className="text-sm text-[#4A2C1A] leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-center gap-1.5 pb-4">
        {GUIDE_PAGES.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentPage ? 'w-6 bg-[#665146]' : 'w-1.5 bg-gray-200'
            }`}
          />
        ))}
      </div>

      <div className="p-6 space-y-3">
        {isLastPage ? (
          <>
            <button
              onClick={() => navigate('/home')}
              className="w-full py-4 px-4 rounded-full border border-gray-200 text-[#4A2C1A] font-medium transition-colors hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <PenLine className="w-4 h-4" />
              {t('payment.success.goWriteDiary')}
            </button>
            <button
              onClick={() => navigate('/music')}
              className="w-full py-4 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {t('payment.success.goCreateMusic')}
              <Sparkles className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate('/home')}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-2"
            >
              {t('common.skip')}
            </button>
            <button
              onClick={handleNext}
              className="w-full py-4 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {t('common.next')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
