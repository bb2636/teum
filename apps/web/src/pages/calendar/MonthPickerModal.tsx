import { ScrollYearMonthPicker } from '@/components/ScrollYearMonthPicker';

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
  return (
    <ScrollYearMonthPicker
      selectedYear={currentYear}
      selectedMonth={currentMonth}
      onSelect={onSelectMonth}
      onClose={onClose}
      minYear={2020}
      maxYear={new Date().getFullYear() + 1}
      mode="year-month"
    />
  );
}
