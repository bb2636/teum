import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { StorageImage } from '@/components/StorageImage';
import { ProfileButton } from '@/components/ProfileButton';
import { useCalendarDiaries } from '@/hooks/useDiaries';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { MonthPickerModal } from './MonthPickerModal';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, addMonths, subMonths, getDate } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Diary } from '@/hooks/useDiaries';

/** HTML 태그를 제거하고 텍스트만 반환 */
function stripHTML(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/** 일기에서 목록에 쓸 "첫 줄" 텍스트 추출 */
function getFirstLine(diary: Diary): string {
  if (diary.title?.trim()) return diary.title.trim();
  if (diary.type === 'question_based' && diary.answers?.length) {
    // 질문기록일 때는 먼저 첫 번째 질문 제목을 확인
    const firstQuestion = diary.answers[0].question?.question?.trim();
    if (firstQuestion) return firstQuestion;
    // 질문 제목이 없으면 답변 내용 확인
    const first = diary.answers[0].answer?.trim();
    if (first) return first.split('\n')[0].trim() || first;
    // 질문 제목도 답변도 없으면 공백 반환
    return '';
  }
  if (diary.content?.trim()) {
    const textContent = stripHTML(diary.content);
    return textContent.trim().split('\n')[0].trim();
  }
  // 질문기록이지만 답변이 없는 경우 공백 반환
  if (diary.type === 'question_based') {
    return '';
  }
  return '';
}

function getDiaryPreviewText(diary: Diary): string {
  if (diary.folder) {
    return diary.folder.isDefault || diary.folder.name === 'All' ? '전체' : diary.folder.name;
  }
  return '전체';
}

interface DiarySlideProps {
  date: Date;
  diaries: Diary[];
  onClose: () => void;
}

function DiarySlide({ date, diaries, onClose }: DiarySlideProps) {
  const dateLabel = `${format(date, 'M월 d일', { locale: ko })} (${format(date, 'E', { locale: ko })})`;
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const PEEK_HEIGHT = 360;

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 250);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    dragCurrentY.current = e.touches[0].clientY - dragStartY.current;

    if (!expanded && dragCurrentY.current < -40) {
      setExpanded(true);
      dragStartY.current = null;
      return;
    }

    if (expanded && dragCurrentY.current > 0 && sheetRef.current) {
      const scrollTop = sheetRef.current.querySelector('.sheet-scroll')?.scrollTop || 0;
      if (scrollTop <= 0) {
        if (dragCurrentY.current > 80) {
          setExpanded(false);
          dragStartY.current = null;
          return;
        }
      }
    }

    if (!expanded && dragCurrentY.current > 60) {
      handleClose();
      dragStartY.current = null;
    }
  };

  const handleTouchEnd = () => {
    dragStartY.current = null;
    dragCurrentY.current = 0;
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-colors duration-250 ${closing ? 'bg-black/0' : 'bg-black/50'}`}
      onClick={handleClose}
    >
      <div
        ref={sheetRef}
        className={`absolute left-0 right-0 bg-white rounded-t-2xl flex flex-col transition-all duration-300 ease-out ${closing ? 'translate-y-full' : ''}`}
        style={{
          top: expanded ? 0 : `calc(100% - ${PEEK_HEIGHT}px)`,
          bottom: 0,
          borderTopLeftRadius: expanded ? 0 : '1rem',
          borderTopRightRadius: expanded ? 0 : '1rem',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center cursor-grab">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex-shrink-0 px-4 pb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">{dateLabel}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 text-lg"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="sheet-scroll flex-1 overflow-y-auto px-4 pb-safe">
          <div className="space-y-3 pb-6">
            {diaries.map((diary) => {
              const firstLine = getFirstLine(diary);
              return (
                <Link
                  key={diary.id}
                  to={`/diaries/${diary.id}`}
                  onClick={onClose}
                  className="block bg-white rounded-xl p-4 border border-[#4A2C1A]/20 shadow-sm hover:shadow-md hover:border-[#4A2C1A]/40 transition-all duration-200"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs text-gray-500">
                      {diary.folder
                        ? (diary.folder.isDefault || diary.folder.name === 'All' ? '전체' : diary.folder.name)
                        : '전체'}
                    </span>
                    {diary.type === 'question_based' && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">질문기록</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#4A2C1A] truncate">{firstLine || '제목 없음'}</p>
                  {diary.content?.trim() && firstLine !== stripHTML(diary.content).trim() && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{stripHTML(diary.content).trim()}</p>
                  )}
                  {diary.images && diary.images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto mt-2.5">
                      {diary.images.slice(0, 4).map((img, idx) => (
                        <StorageImage
                          key={idx}
                          url={img.imageUrl}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      ))}
                      {diary.images.length > 4 && (
                        <span className="flex items-center text-gray-400 text-xs">+{diary.images.length - 4}</span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
            {diaries.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">이 날에 작성된 일기가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DiaryTypeModalProps {
  onClose: () => void;
  onSelectType: (type: 'free_form' | 'question_based') => void;
}

function DiaryTypeModal({ onClose, onSelectType }: DiaryTypeModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[#4A2C1A] mb-2">
          오늘은 어떤 방식으로 남기시겠습니까?
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          빠르게 쓰거나, 질문에 따라<br />차근히 정리할 수 있습니다.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => onSelectType('free_form')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-[#4A2C1A] font-medium transition-colors"
          >
            자유작성
          </button>
          <button
            onClick={() => onSelectType('question_based')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-[#4A2C1A] font-medium transition-colors"
          >
            질문기록
          </button>
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const navigate = useNavigate();
  const { setHideTabBar } = useHideTabBar();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeModalDate, setTypeModalDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // 일기 목록 슬라이드 열릴 때 하단바 숨기기
  useEffect(() => {
    setHideTabBar(selectedDate !== null);
    return () => setHideTabBar(false);
  }, [selectedDate, setHideTabBar]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: diaries = [], isError, refetch } = useCalendarDiaries(year, month);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get diaries for a specific date
  const getDiariesForDate = (date: Date) => {
    // Normalize dates to compare only year, month, day (ignore time)
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return diaries.filter((diary) => {
      const diaryDate = new Date(diary.date);
      const normalizedDiaryDate = new Date(diaryDate.getFullYear(), diaryDate.getMonth(), diaryDate.getDate());
      return normalizedDate.getTime() === normalizedDiaryDate.getTime();
    });
  };

  // Calendar grid
  const firstDayOfWeek = getDay(monthStart);
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  // Add empty cells for days before month starts
  if (firstDayOfWeek > 0) {
    const prevMonth = subMonths(currentDate, 1);
    const prevMonthEnd = endOfMonth(prevMonth);
    const daysToShow = firstDayOfWeek;
    for (let i = daysToShow - 1; i >= 0; i--) {
      const day = new Date(prevMonthEnd);
      day.setDate(day.getDate() - i);
      currentWeek.push(day);
    }
  }

  // Add days of the month
  daysInMonth.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  // Add empty cells for remaining days
  if (currentWeek.length > 0) {
    const nextMonth = addMonths(currentDate, 1);
    let nextMonthDay = 1;
    while (currentWeek.length < 7) {
      const day = new Date(nextMonth);
      day.setDate(nextMonthDay);
      currentWeek.push(day);
      nextMonthDay++;
    }
    weeks.push(currentWeek);
  }

  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleMonthSelect = (year: number, month: number) => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Prevent default scrolling during swipe
    if (swipeStartX !== null) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX === null) return;

    const swipeEndX = e.changedTouches[0].clientX;
    const diffX = swipeStartX - swipeEndX;
    const threshold = 50; // Minimum swipe distance

    if (Math.abs(diffX) > threshold) {
      if (diffX > 0) {
        // Swipe left - next month
        goToNextMonth();
      } else {
        // Swipe right - previous month
        goToPreviousMonth();
      }
    }

    setSwipeStartX(null);
  };

  const handleDateClick = (date: Date) => {
    const dayDiaries = getDiariesForDate(date);
    if (dayDiaries.length > 0) {
      // Show slide with diaries
      setSelectedDate(date);
    } else {
      // Show type selection modal
      setTypeModalDate(date);
      setShowTypeModal(true);
    }
  };

  const handleTypeSelect = (type: 'free_form' | 'question_based') => {
    if (typeModalDate) {
      const dateStr = format(typeModalDate, 'yyyy-MM-dd');
      navigate(`/diaries/new?type=${type}&date=${dateStr}`);
    }
    setShowTypeModal(false);
    setTypeModalDate(null);
  };

  const selectedDateDiaries = selectedDate ? getDiariesForDate(selectedDate) : [];
  const today = new Date();

  // Check if current month has 6 weeks
  const hasSixWeeks = weeks.length === 6;

  // Prevent scrolling
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const originalHtmlStyle = window.getComputedStyle(document.documentElement).overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalStyle;
      document.documentElement.style.overflow = originalHtmlStyle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white pb-20 overflow-hidden">
      <div className={`max-w-md mx-auto h-screen flex flex-col overflow-hidden ${hasSixWeeks ? 'pb-16' : ''}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 ${hasSixWeeks ? 'py-2' : 'py-3'}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="text-gray-500 hover:text-gray-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowMonthPicker(true)}
              className="text-lg font-semibold text-[#4A2C1A] hover:text-[#5A3C2A] transition-colors"
            >
              {format(currentDate, 'yyyy.M', { locale: ko })}
            </button>
            <button onClick={goToNextMonth} className="text-gray-500 hover:text-gray-700">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="text-sm text-[#4A2C1A] font-medium px-3 py-1.5 rounded-lg border border-[#4A2C1A] hover:bg-gray-100 transition-colors"
            >
              오늘
            </button>
            <ProfileButton />
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <div
              key={day}
              className={`text-center text-xs font-medium ${hasSixWeeks ? 'py-1' : 'py-2'} ${
                index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {isError && (
          <div className="text-center py-2">
            <button onClick={() => refetch()} className="text-sm text-[#4A2C1A] underline">
              일기를 불러오지 못했습니다. 다시 시도
            </button>
          </div>
        )}

        {/* Calendar Grid */}
        <div
          ref={calendarRef}
          className="flex-1 grid grid-rows-6 grid-cols-7 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'pan-y' }}
        >
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => {
              const dayDiaries = getDiariesForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const dayNumber = getDate(day);
              const isSunday = getDay(day) === 0;
              const isSaturday = getDay(day) === 6;

              return (
                <button
                  key={`${weekIndex}-${dayIndex}`}
                  onClick={() => handleDateClick(day)}
                  className={`relative border-b border-gray-200 flex flex-col items-center justify-start calendar-cell-tap ${
                    hasSixWeeks ? 'py-0.5 px-0.5' : 'p-1'
                  } ${
                    !isCurrentMonth 
                      ? 'opacity-30 bg-gray-50' 
                      : isToday || isSelected
                      ? 'bg-pink-50'
                      : 'bg-white'
                  }`}
                >
                  <span
                    className={`${hasSixWeeks ? 'text-xs' : 'text-sm'} font-medium ${
                      hasSixWeeks ? 'mt-0.5' : 'mt-1'
                    } ${
                      isToday
                        ? `bg-[#4A2C1A] text-white rounded-full ${hasSixWeeks ? 'w-5 h-5' : 'w-6 h-6'} flex items-center justify-center`
                        : isSunday
                        ? 'text-red-500'
                        : isSaturday
                        ? 'text-blue-500'
                        : 'text-gray-900'
                    }`}
                  >
                    {dayNumber}
                  </span>
                  {dayDiaries.length > 0 && (
                    <div className={`${hasSixWeeks ? 'mt-0.5' : 'mt-1'} flex flex-col gap-0.5 justify-center w-full px-0.5`}>
                      {(() => {
                        const previewDiaries = dayDiaries.slice(0, 2);
                        const hasAnyPreview = previewDiaries.some(d => getDiaryPreviewText(d));
                        if (hasAnyPreview) {
                          return previewDiaries.map((diary) => {
                            const previewText = getDiaryPreviewText(diary);
                            return previewText ? (
                              <div
                                key={diary.id}
                                className="w-full bg-pink-100 text-pink-700 text-[10px] px-1 py-0.5 rounded truncate text-center"
                              >
                                {previewText}
                              </div>
                            ) : null;
                          });
                        }
                        return (
                          <div className="flex justify-center">
                            <div className="w-1.5 h-1.5 bg-pink-400 rounded-full" />
                          </div>
                        );
                      })()}
                      {dayDiaries.length > 2 && (
                        <div className="w-full bg-pink-100 text-pink-700 text-[10px] px-1 py-0.5 rounded text-center">
                          +{dayDiaries.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Diary Slide */}
      {selectedDate && selectedDateDiaries.length > 0 && (
        <DiarySlide
          date={selectedDate}
          diaries={selectedDateDiaries}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {/* Type Selection Modal */}
      {showTypeModal && typeModalDate && (
        <DiaryTypeModal
          onClose={() => {
            setShowTypeModal(false);
            setTypeModalDate(null);
          }}
          onSelectType={handleTypeSelect}
        />
      )}

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <MonthPickerModal
          currentYear={year}
          currentMonth={month}
          onClose={() => {
            setShowMonthPicker(false);
            requestAnimationFrame(() => {
              window.scrollTo(0, 0);
              document.body.scrollTop = 0;
              document.documentElement.scrollTop = 0;
            });
          }}
          onSelectMonth={handleMonthSelect}
        />
      )}
    </div>
  );
}
