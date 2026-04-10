import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, X, Plus } from 'lucide-react';
import { StorageImage } from '@/components/StorageImage';
import { ProfileButton } from '@/components/ProfileButton';
import { useCalendarDiaries } from '@/hooks/useDiaries';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { MonthPickerModal } from './MonthPickerModal';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, addMonths, subMonths, getDate, addDays, subDays, isAfter, startOfDay } from 'date-fns';
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
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 animate-modal-pop text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[#4A2C1A] mb-2">
          {t('calendar.howToRecord')}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {t('calendar.recordDesc').split('\n').map((line, i) => (
            <span key={i}>{line}{i < t('calendar.recordDesc').split('\n').length - 1 && <br />}</span>
          ))}
        </p>
        <div className="space-y-3">
          <button
            onClick={() => onSelectType('free_form')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-full text-[#4A2C1A] font-medium transition-colors"
          >
            {t('calendar.freeWrite')}
          </button>
          <button
            onClick={() => onSelectType('question_based')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-full text-[#4A2C1A] font-medium transition-colors"
          >
            {t('calendar.questionRecord')}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-5">
          {t('calendar.recordHint').split('\n').map((line, i) => (
            <span key={i}>{line}{i < t('calendar.recordHint').split('\n').length - 1 && <br />}</span>
          ))}
        </p>
      </div>
    </div>
  );
}

interface DiaryListPanelProps {
  date: Date;
  diaries: Diary[];
  onDateChange: (date: Date) => void;
  onClose: () => void;
}

function DiaryListPanel({ date, diaries, onDateChange, onClose }: DiaryListPanelProps) {
  const t = useT();
  const locale = getDateLocale();
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const dateLabel = `${getDate(date)}. ${format(date, 'E', { locale })}`;

  const handleTouchStart = (e: TouchEvent) => {
    if (isTransitioning) return;
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null || isTransitioning) return;
    const diffX = e.touches[0].clientX - swipeStartX.current;
    const diffY = e.touches[0].clientY - swipeStartY.current;
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffX) < 10) return;
    if (Math.abs(diffX) > 10) {
      e.preventDefault();
    }
    setSwipeOffset(diffX);
  };

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  });

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
      ref={panelRef}
      className="flex-1 overflow-y-auto scrollbar-hide"
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div
        className="px-4 pb-24"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isTransitioning ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        <div className="flex items-center justify-between pt-3 pb-2">
          <h2 className="text-base font-semibold text-[#4A2C1A]">{dateLabel}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <X className="w-[18px] h-[18px] text-gray-500" />
          </button>
        </div>

        <div className="space-y-2.5">
          {diaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-gray-400">{t('calendar.noDiariesDay')}</p>
            </div>
          ) : (
          diaries.map((diary) => {
            const firstLine = getFirstLine(diary);
            const contentText = diary.content ? stripHTML(diary.content).trim() : '';
            const hasContent = contentText && firstLine !== contentText;
            return (
              <Link
                key={diary.id}
                to={`/diaries/${diary.id}?from=calendar&date=${format(date, 'yyyy-MM-dd')}`}
                className="block bg-white rounded-xl p-3.5 shadow-sm border border-gray-100"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#4A2C1A] leading-snug">
                    {firstLine || t('diary.noTitle')}
                  </p>
                  {hasContent && (
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mt-1">
                      {contentText}
                    </p>
                  )}
                  {diary.images && diary.images.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {diary.images.slice(0, 4).map((img, idx) => (
                        <StorageImage
                          key={idx}
                          url={img.imageUrl}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ))}
                      {diary.images.length > 4 && (
                        <span className="flex items-center text-gray-400 text-xs">+{diary.images.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })
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
  const [isListFullScreen, setIsListFullScreen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'none' | 'left' | 'right'>('none');
  const [isAnimating, setIsAnimating] = useState(false);
  const handleSwipeStartY = useRef<number | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const isListOpen = selectedDate !== null;

  useEffect(() => {
    setHideTabBar(isListFullScreen);
    return () => setHideTabBar(false);
  }, [setHideTabBar, isListFullScreen]);

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

  const animateMonthChange = (direction: 'left' | 'right', newDate: Date) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setSlideDirection(direction);
    setTimeout(() => {
      setCurrentDate(newDate);
      setSlideDirection(direction === 'left' ? 'right' : 'left');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlideDirection('none');
          setTimeout(() => setIsAnimating(false), 250);
        });
      });
    }, 200);
  };

  const goToPreviousMonth = () => animateMonthChange('right', subMonths(currentDate, 1));
  const goToNextMonth = () => animateMonthChange('left', addMonths(currentDate, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(null);
    setSlideDirection('none');
  };

  const handleMonthSelect = (year: number, month: number) => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    setSlideDirection('none');
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

  const closeList = () => {
    setSelectedDate(null);
    setIsListFullScreen(false);
  };

  const handleGripTouchStart = (e: React.TouchEvent) => {
    handleSwipeStartY.current = e.touches[0].clientY;
  };
  const handleGripTouchEnd = (e: React.TouchEvent) => {
    if (handleSwipeStartY.current === null) return;
    const diffY = handleSwipeStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diffY) > 40) {
      if (diffY > 0) {
        setIsListFullScreen(true);
      } else {
        if (isListFullScreen) {
          setIsListFullScreen(false);
        } else {
          closeList();
        }
      }
    }
    handleSwipeStartY.current = null;
  };

  const handleDateClick = (date: Date) => {
    if (selectedDate && isSameDay(date, selectedDate)) {
      closeList();
      return;
    }
    if (isListOpen) {
      const dayDiaries = getDiariesForDate(date);
      if (dayDiaries.length > 0) {
        setSelectedDate(date);
        setIsListFullScreen(false);
      } else {
        closeList();
      }
      return;
    }
    const dayDiaries = getDiariesForDate(date);
    if (dayDiaries.length > 0) {
      setSelectedDate(date);
    } else {
      const today = startOfDay(new Date());
      if (isAfter(startOfDay(date), today)) return;
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

  const selectedDateDiaries = selectedDate ? getDiariesForDate(selectedDate) : [];
  const today = new Date();
  const weekdayLabels = t('calendar.weekdays').split(',');

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
    <div className="min-h-screen bg-white overflow-hidden">
      <div className="max-w-md mx-auto h-screen flex flex-col overflow-hidden relative">

        {!isListFullScreen && (
        <div
          className="shrink-0 z-30 bg-white flex items-center justify-between px-4 py-2"
          style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' }}
        >
          <div className="flex items-center gap-1.5">
            <button onClick={goToPreviousMonth} className="p-1 text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowMonthPicker(true)}
              className="text-xl font-bold text-[#4A2C1A] hover:text-[#3A2010] transition-colors tracking-tight"
            >
              {format(currentDate, 'yyyy.M', { locale })}
            </button>
            <button onClick={goToNextMonth} className="p-1 text-gray-500 hover:text-gray-700">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="text-sm text-[#4A2C1A] font-medium px-3 py-1.5 rounded-lg border border-[#4A2C1A]/30 hover:bg-gray-50 transition-colors"
            >
              {t('common.today')}
            </button>
            <ProfileButton />
          </div>
        </div>
        )}

        {!isListFullScreen && (
        <div className="grid grid-cols-7 px-2 pt-1">
          {weekdayLabels.map((day, index) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-1.5 ${
                index === 0 ? 'text-red-400' : index === 6 ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
        )}

        {isError && (
          <div className="text-center py-1">
            <button onClick={() => refetch()} className="text-sm text-[#4A2C1A] underline">
              {t('calendar.retryFetch')}
            </button>
          </div>
        )}

        <div
          ref={calendarRef}
          className={`flex flex-col px-2 overflow-hidden ${isListFullScreen ? 'hidden' : 'flex-1'}`}
          style={isListOpen && !isListFullScreen ? { flex: '0 0 35%', maxHeight: '35%' } : !isListOpen ? { paddingBottom: '80px' } : undefined}
          onTouchStart={handleCalTouchStart}
          onTouchMove={handleCalTouchMove}
          onTouchEnd={handleCalTouchEnd}
        >
          <div
            className={`flex flex-col flex-1 ${
              slideDirection === 'none'
                ? 'transition-transform duration-250 ease-out translate-x-0 opacity-100'
                : slideDirection === 'left'
                ? '-translate-x-full opacity-0 transition-transform duration-200 ease-in'
                : 'translate-x-full opacity-0 transition-transform duration-200 ease-in'
            }`}
          >
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className={`grid grid-cols-7 flex-1 ${
                weekIndex < weeks.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              {week.map((day, dayIndex) => {
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
                    className={`relative flex flex-col items-center justify-start pt-2 pb-1 transition-colors ${
                      !isCurrentMonth
                        ? 'opacity-30'
                        : isSelected
                        ? 'bg-[#f6efed] rounded-lg'
                        : isToday && !isListOpen
                        ? 'bg-[#f6efed] rounded-lg'
                        : ''
                    }`}
                  >
                    <span
                      className={`text-sm font-medium leading-none ${
                        isToday
                          ? 'bg-[#4A2C1A] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs'
                          : isSunday
                          ? 'text-red-400'
                          : isSaturday
                          ? 'text-blue-400'
                          : 'text-gray-800'
                      }`}
                    >
                      {dayNumber}
                    </span>
                    {!isListOpen && dayDiaries.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0.5 w-full px-0.5">
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
                                  className={`w-full text-[9px] leading-tight px-0.5 py-px rounded truncate text-center ${
                                    isToday ? 'bg-[#4A2C1A] text-white' : 'bg-[#f6efed] text-[#4A2C1A]'
                                  }`}
                                >
                                  {name}{count > 1 ? ` +${count - 1}` : ''}
                                </div>
                              ))}
                              {remainingCount > 0 && (
                                <div className={`w-full text-[9px] leading-tight px-0.5 py-px rounded text-center ${
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
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4A2C1A]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          </div>
        </div>

        {isListOpen && (
          <div
            className={`bg-white flex flex-col transition-all duration-300 ease-in-out ${
              isListFullScreen
                ? 'absolute inset-0 z-40'
                : 'flex-1 z-10'
            }`}
            style={isListFullScreen ? { paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' } : { flex: '1 1 auto' }}
          >
            <div
              className="flex justify-center py-2 cursor-grab shrink-0"
              onTouchStart={handleGripTouchStart}
              onTouchEnd={handleGripTouchEnd}
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <DiaryListPanel
              date={selectedDate!}
              diaries={selectedDateDiaries}
              onDateChange={handleDateChangeFromList}
              onClose={closeList}
            />
            {isListFullScreen && selectedDate && !isAfter(startOfDay(selectedDate), startOfDay(new Date())) && (
              <button
                onClick={() => {
                  if (selectedDate) {
                    setTypeModalDate(selectedDate);
                    setShowTypeModal(true);
                  }
                }}
                className="fixed right-4 w-14 h-14 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] flex items-center justify-center shadow-lg z-50 transition-colors"
                style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
              >
                <Plus className="w-7 h-7 text-white" />
              </button>
            )}
          </div>
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
