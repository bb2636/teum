import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { StorageImage } from '@/components/StorageImage';
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

/** 일기 첫 내용을 3~4글자로 자르기 */
function getDiaryPreviewText(diary: Diary): string {
  const firstLine = getFirstLine(diary);
  if (!firstLine) return '';
  // 3~4글자로 자르기 (한글 기준)
  return firstLine.length > 4 ? firstLine.substring(0, 4) : firstLine;
}

interface DiarySlideProps {
  date: Date;
  diaries: Diary[];
  onClose: () => void;
}

function DiarySlide({ date, diaries, onClose }: DiarySlideProps) {
  const dateLabel = `${format(date, 'M월 d일', { locale: ko })} (${format(date, 'E', { locale: ko })})`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 animate-overlay-fade" onClick={onClose}>
      <div
        className="absolute inset-0 bg-white animate-modal-sheet flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">
            {dateLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-4 space-y-4 pb-safe overflow-y-auto flex-1">
          {diaries.map((diary) => {
            const firstLine = getFirstLine(diary);
            const diaryDate = diary.date ? format(new Date(diary.date), 'M월 d일 (E)', { locale: ko }) : dateLabel;
            return (
              <Link
                key={diary.id}
                to={`/diaries/${diary.id}`}
                onClick={onClose}
                className="block bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">
                    {diary.folder 
                      ? (diary.folder.isDefault || diary.folder.name === 'All' ? '전체' : diary.folder.name)
                      : '전체'}
                  </span>
                  {diary.type === 'question_based' && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      질문기록
                    </span>
                  )}
                  <span className="ml-auto text-gray-400">⋯</span>
                </div>
                <p className="text-sm text-[#4A2C1A] font-medium mb-1">{diaryDate}</p>
                {firstLine && (
                  <p className="text-sm text-gray-700 line-clamp-2">{firstLine}</p>
                )}
                {diary.images && diary.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto mt-3">
                    {diary.images.slice(0, 4).map((img, idx) => (
                      <StorageImage
                        key={idx}
                        url={img.imageUrl}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                    ))}
                    {diary.images.length > 4 && (
                      <span className="flex items-center text-gray-400 text-sm">+{diary.images.length - 4}</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
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
          빠르게 쓰거나, 질문에 따라 차근히 정리할 수 있습니다.
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

  const { data: diaries = [] } = useCalendarDiaries(year, month);

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
          <button
            onClick={goToToday}
            className="text-sm text-[#4A2C1A] font-medium px-3 py-1.5 rounded-lg border border-[#4A2C1A] hover:bg-gray-100 transition-colors"
          >
            오늘
          </button>
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
                  className={`relative border-b border-gray-200 flex flex-col items-center justify-start ${
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
                      {dayDiaries.slice(0, 2).map((diary) => {
                        const previewText = getDiaryPreviewText(diary);
                        return previewText ? (
                          <div
                            key={diary.id}
                            className="w-full bg-pink-100 text-pink-700 text-[10px] px-1 py-0.5 rounded truncate text-center"
                          >
                            {previewText}
                          </div>
                        ) : null;
                      })}
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
          onClose={() => setShowMonthPicker(false)}
          onSelectMonth={handleMonthSelect}
        />
      )}
    </div>
  );
}
