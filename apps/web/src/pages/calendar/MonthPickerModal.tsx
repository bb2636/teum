import { X } from 'lucide-react';

interface MonthPickerModalProps {
  currentYear: number;
  currentMonth: number;
  onClose: () => void;
  onSelectMonth: (year: number, month: number) => void;
}

export function MonthPickerModal({
  currentYear,
  currentMonth,
  onClose,
  onSelectMonth,
}: MonthPickerModalProps) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleMonthSelect = (month: number) => {
    onSelectMonth(currentYear, month);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">{currentYear}년</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {months.map((month) => {
            const isSelected = month === currentMonth;
            return (
              <button
                key={month}
                onClick={() => handleMonthSelect(month)}
                className={`py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
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
  );
}
