import { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ScrollYearMonthPickerProps {
  selectedYear: number;
  selectedMonth: number;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
  minYear?: number;
  maxYear?: number;
  mode?: 'year-month' | 'year-month-day';
  selectedDay?: number;
  onSelectDay?: (year: number, month: number, day: number) => void;
  onDelete?: () => void;
}

export function ScrollYearMonthPicker({
  selectedYear,
  selectedMonth,
  onSelect,
  onClose,
  minYear = 1920,
  maxYear,
  mode = 'year-month',
  selectedDay,
  onSelectDay,
  onDelete,
}: ScrollYearMonthPickerProps) {
  const currentYear = new Date().getFullYear();
  const resolvedMaxYear = maxYear ?? currentYear;
  const years = Array.from({ length: resolvedMaxYear - minYear + 1 }, (_, i) => minYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const [pickerYear, setPickerYear] = useState(selectedYear);
  const [pickerMonth, setPickerMonth] = useState(selectedMonth);
  const [showDayGrid, setShowDayGrid] = useState(false);

  const yearListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (yearListRef.current) {
      const selectedEl = yearListRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    }
  }, []);

  const handleYearClick = (year: number) => {
    setPickerYear(year);
  };

  const handleMonthClick = (month: number) => {
    setPickerMonth(month);
    if (mode === 'year-month') {
      onSelect(pickerYear, month);
      onClose();
    } else {
      setShowDayGrid(true);
    }
  };

  const handleDayClick = (day: number) => {
    if (onSelectDay) {
      onSelectDay(pickerYear, pickerMonth, day);
    }
    onClose();
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfWeek = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(pickerYear, pickerMonth);
  const firstDay = getFirstDayOfWeek(pickerYear, pickerMonth);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-sm mx-4 animate-modal-pop overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">
            {showDayGrid
              ? `${pickerYear}년 ${pickerMonth}월`
              : '날짜 선택'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showDayGrid ? (
          <div className="flex gap-0 px-2 pb-4">
            <div
              ref={yearListRef}
              className="flex-1 h-[280px] overflow-y-auto px-2 scrollbar-thin"
            >
              {years.map((year) => {
                const isSelected = year === pickerYear;
                return (
                  <button
                    key={year}
                    data-selected={isSelected}
                    onClick={() => handleYearClick(year)}
                    className={`w-full py-2.5 text-center text-sm font-medium rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-[#4A2C1A] text-white'
                        : 'text-[#4A2C1A] hover:bg-gray-100'
                    }`}
                  >
                    {year}년
                  </button>
                );
              })}
            </div>

            <div className="flex-1 px-2">
              <div className="grid grid-cols-3 gap-2">
                {months.map((month) => {
                  const isSelected = month === pickerMonth && pickerYear === selectedYear;
                  return (
                    <button
                      key={month}
                      onClick={() => handleMonthClick(month)}
                      className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-[#4A2C1A] text-white'
                          : 'bg-gray-100 text-[#4A2C1A] hover:bg-gray-200'
                      }`}
                    >
                      {month}월
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-4">
            <button
              onClick={() => setShowDayGrid(false)}
              className="text-sm text-[#4A2C1A] mb-3 hover:underline"
            >
              ← 연도/월 변경
            </button>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                <div
                  key={day}
                  className={`text-center text-xs font-medium py-1 ${
                    idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-gray-400'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }, (_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const isSelected = day === selectedDay && pickerMonth === selectedMonth && pickerYear === selectedYear;
                const isToday =
                  day === new Date().getDate() &&
                  pickerMonth === new Date().getMonth() + 1 &&
                  pickerYear === new Date().getFullYear();
                const dayOfWeek = (firstDay + i) % 7;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`w-full aspect-square rounded-lg text-sm flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-[#4A2C1A] text-white'
                        : isToday
                        ? 'border border-[#4A2C1A] text-[#4A2C1A]'
                        : dayOfWeek === 0
                        ? 'text-red-400 hover:bg-gray-100'
                        : dayOfWeek === 6
                        ? 'text-blue-400 hover:bg-gray-100'
                        : 'text-[#4A2C1A] hover:bg-gray-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {onDelete && (
              <div className="flex justify-between mt-4 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="text-red-400 text-sm"
                >
                  삭제
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    if (onSelectDay) {
                      onSelectDay(today.getFullYear(), today.getMonth() + 1, today.getDate());
                    }
                    onClose();
                  }}
                  className="text-[#4A2C1A] text-sm font-medium"
                >
                  오늘
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
