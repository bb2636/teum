import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Plus, MoreHorizontal } from 'lucide-react';
import { StorageImage } from '@/components/StorageImage';
import { ProfileButton } from '@/components/ProfileButton';
import { useCalendarDiaries } from '@/hooks/useDiaries';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { MonthPickerModal } from './MonthPickerModal';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, addMonths, subMonths, getDate, addDays, subDays } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { useT } from '@/hooks/useTranslation';
import { Diary } from '@/hooks/useDiaries';
import { stripHTML, getFirstLine } from '@/lib/utils';

function getDiaryPreviewText(diary: Diary, allLabel: string): string {
  if (diary.folder) {
    return diary.folder.isDefault || diary.folder.name === 'All' ? allLabel : diary.folder.name;
  }
  return allLabel;
}

interface DiaryTypeModalProps {
  onClose: () => void;
  onSelectType: (type: 'free_form' | 'question_based') => void;
}

function DiaryTypeModal({ onClose, onSelectType }: DiaryTypeModalProps) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[#4A2C1A] mb-2">
          {t('calendar.howToRecord')}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          {t('calendar.recordDesc').split('\n').map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </p>
        <div className="space-y-3">
          <button
            onClick={() => onSelectType('free_form')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-[#4A2C1A] font-medium transition-colors"
          >
            {t('calendar.freeWrite')}
          </button>
          <button
            onClick={() => onSelectType('question_based')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-[#4A2C1A] font-medium transition-colors"
          >
            {t('calendar.questionRecord')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DiaryListPanelProps {
  date: Date;
  diaries: Diary[];
  onDateChange: (date: Date) => void;
}

function DiaryListPanel({ date, diaries, onDateChange }: DiaryListPanelProps) {
  const t = useT();
  const locale = getDateLocale();
  const navigate = useNavigate();
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const dateLabel = `${getDate(date)}. ${format(date, 'E', { locale })}`;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTransitioning) return;
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null || isTransitioning) return;
    const diffX = e.touches[0].clientX - swipeStartX.current;
    const diffY = e.touches[0].clientY - swipeStartY.current;
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffX) < 10) return;
    if (Math.abs(diffX) > 10) {
      e.preventDefault();
    }
    setSwipeOffset(diffX);
  };

  const handleTouchEnd = () => {
    if (swipeStartX.current === null || isTransitioning) {
      swipeStartX.current = null;
      swipeStartY.current = null;
      return;
    }
    const threshold = 60;
    if (Math.abs(swipeOffset) > threshold) {
      setIsTransitioning(true);
      const targetOffset = swipeOffset > 0 ? window.innerWidth : -window.innerWidth;
      setSwipeOffset(targetOffset);
      setTimeout(() => {
        const newDate = swipeOffset > 0 ? subDays(date, 1) : addDays(date, 1);
        onDateChange(newDate);
        setSwipeOffset(0);
        setIsTransitioning(false);
      }, 200);
    } else {
      setSwipeOffset(0);
    }
    swipeStartX.current = null;
    swipeStartY.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="px-4 pb-24"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isTransitioning ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        <div className="flex items-center justify-between py-4">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">{dateLabel}</h2>
        </div>

        <div className="space-y-3">
          {diaries.map((diary) => {
            const firstLine = getFirstLine(diary);
            const folderName = diary.folder
              ? (diary.folder.isDefault || diary.folder.name === 'All' ? t('common.all') : diary.folder.name)
              : t('common.all');
            return (
              <Link
                key={diary.id}
                to={`/diaries/${diary.id}?from=calendar&date=${format(date, 'yyyy-MM-dd')}`}
                className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">{folderName}</p>
                    <p className="text-sm text-gray-800 leading-relaxed line-clamp-3">
                      {firstLine || t('diary.noTitle')}
                      {diary.content?.trim() && firstLine !== stripHTML(diary.content).trim() && (
                        <span className="text-gray-500"> {stripHTML(diary.content).trim()}</span>
                      )}
                    </p>
                    {diary.images && diary.images.length > 0 && (
                      <div className="flex gap-2 mt-2.5">
                        {diary.images.slice(0, 4).map((img, idx) => (
                          <StorageImage
                            key={idx}
                            url={img.imageUrl}
                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                          />
                        ))}
                        {diary.images.length > 4 && (
                          <span className="flex items-center text-gray-400 text-xs">+{diary.images.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/diaries/${diary.id}?from=calendar&date=${format(date, 'yyyy-MM-dd')}`);
                    }}
                    className="text-gray-400 p-1 flex-shrink-0 ml-2"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </Link>
            );
          })}
          {diaries.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">{t('calendar.noDiariesDay')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const navigate = useNavigate();
  const { setHideTabBar } = useHideTabBar();
  const t = useT();
  const locale = getDateLocale();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeModalDate, setTypeModalDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [calSwipeStartX, setCalSwipeStartX] = useState<number | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const isListOpen = selectedDate !== null;

  useEffect(() => {
    setHideTabBar(false);
    return () => setHideTabBar(false);
  }, [setHideTabBar]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: diaries = [], isError, refetch } = useCalendarDiaries(year, month);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getDiariesForDate = useCallback((date: Date) => {
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return diaries.filter((diary) => {
      const diaryDate = new Date(diary.date);
      const normalizedDiaryDate = new Date(diaryDate.getFullYear(), diaryDate.getMonth(), diaryDate.getDate());
      return normalizedDate.getTime() === normalizedDiaryDate.getTime();
    });
  }, [diaries]);

  const firstDayOfWeek = getDay(monthStart);
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

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

  daysInMonth.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

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

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleMonthSelect = (year: number, month: number) => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
  };

  const handleCalTouchStart = (e: React.TouchEvent) => {
    if (!isListOpen) setCalSwipeStartX(e.touches[0].clientX);
  };
  const handleCalTouchMove = (e: React.TouchEvent) => {
    if (calSwipeStartX !== null && !isListOpen) e.preventDefault();
  };
  const handleCalTouchEnd = (e: React.TouchEvent) => {
    if (calSwipeStartX === null || isListOpen) return;
    const diffX = calSwipeStartX - e.changedTouches[0].clientX;
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) goToNextMonth();
      else goToPreviousMonth();
    }
    setCalSwipeStartX(null);
  };

  const handleDateClick = (date: Date) => {
    if (selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(null);
      return;
    }
    if (isListOpen) {
      const dayDiaries = getDiariesForDate(date);
      if (dayDiaries.length > 0) {
        setSelectedDate(date);
      } else {
        setSelectedDate(null);
      }
      return;
    }
    const dayDiaries = getDiariesForDate(date);
    if (dayDiaries.length > 0) {
      setSelectedDate(date);
    } else {
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

  const handleDateChangeFromList = (newDate: Date) => {
    setSelectedDate(newDate);
    if (!isSameMonth(newDate, currentDate)) {
      setCurrentDate(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
    }
  };

  const handleWriteNew = (date: Date) => {
    setTypeModalDate(date);
    setShowTypeModal(true);
  };

  const selectedDateDiaries = selectedDate ? getDiariesForDate(selectedDate) : [];
  const today = new Date();

  useEffect(() => {
    if (!isListOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalHtmlStyle = window.getComputedStyle(document.documentElement).overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
        document.documentElement.style.overflow = originalHtmlStyle;
      };
    }
  }, [isListOpen]);

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      <div className="max-w-md mx-auto h-screen flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2" style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' }}>
          <div className="flex items-center gap-2">
            <button onClick={goToPreviousMonth} className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowMonthPicker(true)}
              className="text-lg font-semibold text-[#4A2C1A] hover:text-[#5A3C2A] transition-colors"
            >
              {format(currentDate, 'yyyy.M', { locale })}
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
              {t('common.today')}
            </button>
            <ProfileButton />
          </div>
        </div>

        <div className="grid grid-cols-7">
          {t('calendar.weekdays').split(',').map((day, index) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-1 ${
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
              {t('calendar.retryFetch')}
            </button>
          </div>
        )}

        <div
          ref={calendarRef}
          className={`grid grid-cols-7 transition-all duration-300 ease-in-out ${
            isListOpen ? 'grid-rows-6' : 'grid-rows-6 flex-1'
          }`}
          style={isListOpen ? { height: '180px', minHeight: '180px' } : undefined}
          onTouchStart={handleCalTouchStart}
          onTouchMove={handleCalTouchMove}
          onTouchEnd={handleCalTouchEnd}
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
                  className={`relative border-b border-gray-100 flex flex-col items-center justify-start py-0.5 px-0.5 ${
                    !isCurrentMonth
                      ? 'opacity-30 bg-gray-50'
                      : isSelected
                      ? 'bg-[#f6efed]'
                      : isToday
                      ? 'bg-[#f6efed]'
                      : 'bg-white'
                  }`}
                >
                  <span
                    className={`text-xs font-medium mt-0.5 ${
                      isToday
                        ? 'bg-[#4A2C1A] text-white rounded-full w-5 h-5 flex items-center justify-center'
                        : isSunday
                        ? 'text-red-500'
                        : isSaturday
                        ? 'text-blue-500'
                        : 'text-gray-900'
                    }`}
                  >
                    {dayNumber}
                  </span>
                  {!isListOpen && dayDiaries.length > 0 && (
                    <div className="mt-0.5 flex flex-col gap-0.5 justify-center w-full px-0.5">
                      {(() => {
                        const folderCounts = new Map<string, number>();
                        dayDiaries.forEach((d) => {
                          const name = getDiaryPreviewText(d, t('common.all'));
                          folderCounts.set(name, (folderCounts.get(name) || 0) + 1);
                        });
                        const groups = Array.from(folderCounts.entries());

                        if (!groups.some(([name]) => name)) {
                          return (
                            <div className="flex justify-center">
                              <div className="w-1.5 h-1.5 bg-[#4A2C1A] rounded-full" />
                            </div>
                          );
                        }

                        const visibleGroups = groups.slice(0, 2);
                        const remainingCount = groups.slice(2).reduce((sum, [, c]) => sum + c, 0);

                        return (
                          <>
                            {visibleGroups.map(([name, count]) => (
                              <div
                                key={name}
                                className={`w-full text-[10px] px-1 py-0.5 rounded truncate text-center ${
                                  isToday ? 'bg-[#4A2C1A] text-white' : 'bg-[#f6efed] text-[#4A2C1A]'
                                }`}
                              >
                                {name}{count > 1 ? ` +${count - 1}` : ''}
                              </div>
                            ))}
                            {remainingCount > 0 && (
                              <div className={`w-full text-[10px] px-1 py-0.5 rounded text-center ${
                                isToday ? 'bg-[#4A2C1A] text-white' : 'bg-[#f6efed] text-[#4A2C1A]'
                              }`}>
                                +{remainingCount}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {isListOpen && dayDiaries.length > 0 && (
                    <div className="mt-0.5 flex justify-center">
                      <div className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-[#4A2C1A]'}`} />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {isListOpen && (
          <>
            <div className="border-t border-gray-200" />
            <DiaryListPanel
              date={selectedDate!}
              diaries={selectedDateDiaries}
              onDateChange={handleDateChangeFromList}
            />
          </>
        )}

        {isListOpen && (
          <button
            onClick={() => handleWriteNew(selectedDate!)}
            className="fixed bottom-24 right-4 max-w-md w-14 h-14 rounded-full bg-[#4A2C1A] text-white shadow-lg flex items-center justify-center hover:bg-[#5A3C2A] transition-colors z-40"
            style={{ right: 'max(16px, calc((100vw - 448px) / 2 + 16px))' }}
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      {showTypeModal && typeModalDate && (
        <DiaryTypeModal
          onClose={() => {
            setShowTypeModal(false);
            setTypeModalDate(null);
          }}
          onSelectType={handleTypeSelect}
        />
      )}

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
