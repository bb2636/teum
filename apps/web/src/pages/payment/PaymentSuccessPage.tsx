import { useNavigate } from 'react-router-dom';
import { X, Sparkles, BookOpen, Music, PenLine, ChevronRight, type LucideIcon } from 'lucide-react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useEffect, useState, type ReactNode } from 'react';

type GuidePage = {
  id: string;
  title: ReactNode;
  subtitle: ReactNode | null;
  icon: LucideIcon | null;
  tips?: string[];
};

const GUIDE_PAGES: GuidePage[] = [
  {
    id: 'welcome',
    title: (
      <>
        구독이<br />
        시작되었습니다.
      </>
    ),
    subtitle: (
      <>
        일기를 분석해<br />
        가사를 만들고,<br />
        음악까지 생성해 보세요.
      </>
    ),
    icon: null,
  },
  {
    id: 'why-diary',
    icon: BookOpen,
    title: (
      <>
        일기가 많을수록<br />
        더 좋은 음악이<br />
        만들어져요.
      </>
    ),
    subtitle: (
      <>
        AI는 일기 속 감정, 상황, 계절감을<br />
        분석해 가사와 멜로디를 만듭니다.<br />
        풍부한 기록이 곧 풍부한 음악이에요.
      </>
    ),
  },
  {
    id: 'how-to',
    icon: PenLine,
    title: (
      <>
        이렇게<br />
        써 보세요.
      </>
    ),
    subtitle: null,
    tips: [
      '오늘 하루 느낀 감정을 솔직하게 적어 보세요.',
      '날씨, 장소, 만난 사람 등 구체적인 상황을 담으면 좋아요.',
      '짧아도 괜찮아요. 매일 한 줄이면 충분합니다.',
      '질문형 일기를 활용하면 쉽게 시작할 수 있어요.',
    ],
  },
  {
    id: 'music-create',
    icon: Music,
    title: (
      <>
        일기를 모아<br />
        나만의 음악을<br />
        만들어 보세요.
      </>
    ),
    subtitle: (
      <>
        3편 이상의 일기가 쌓이면<br />
        음악 생성이 가능해요.<br />
        지금 바로 일기를 시작해 보세요!
      </>
    ),
  },
];

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const { setHideTabBar } = useHideTabBar();
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

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

        <h1 className="text-2xl font-bold text-black leading-tight animate-fade-in">
          {page.title}
        </h1>

        {page.subtitle && (
          <p className="text-base text-gray-500 leading-relaxed mt-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
            {page.subtitle}
          </p>
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
              일기 쓰러 가기
            </button>
            <button
              onClick={() => navigate('/music')}
              className="w-full py-4 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              음악 생성하기
              <Sparkles className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate('/home')}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-2"
            >
              건너뛰기
            </button>
            <button
              onClick={handleNext}
              className="w-full py-4 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
