import { useEffect, useState, useRef } from 'react';
import { X, User, Pencil, Calendar, ChevronUp, ChevronDown as ChevronDownIcon, ChevronLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDate, startOfWeek, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMe, useUpdateProfile, User as UserType } from '@/hooks/useProfile';
import { useLogout } from '@/hooks/useAuth';
import { useSubscriptions, getEffectiveSubscription } from '@/hooks/usePayment';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { WithdrawModal } from './WithdrawModal';

const profileSchema = z.object({
  nickname: z
    .string()
    .optional()
    .refine((v) => !v || v.length === 0 || (v.length >= 2 && v.length <= 12), '닉네임은 2~12자입니다'),
  name: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  country: z.string().max(100).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileEditModalProps {
  user: UserType | undefined;
  onClose: () => void;
}


export function ProfileEditModal({ user, onClose }: ProfileEditModalProps) {
  const logout = useLogout();
  const updateProfile = useUpdateProfile();
  useMe();
  const { data: subscriptions = [] } = useSubscriptions();
  const activeSubscription = getEffectiveSubscription(subscriptions);

  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [yearPickerStartYear, setYearPickerStartYear] = useState(() => {
    const currentYear = new Date().getFullYear();
    return Math.floor(currentYear / 10) * 10; // 현재 연도의 10년 단위 시작 연도
  });
  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [dateDisplayValue, setDateDisplayValue] = useState('');
  
  // 생년월일을 단일 문자열로 관리
  const [dateOfBirthISO, setDateOfBirthISO] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nickname: user?.profile?.nickname || '',
      name: user?.profile?.name || '',
      phone: user?.profile?.phone || '',
      country: user?.profile?.country || '',
    },
  });

  useEffect(() => {
    if (user?.profile) {
      setValue('nickname', user.profile.nickname || '');
      setValue('name', user.profile.name || '');
      setValue('phone', user.profile.phone || '');
      setValue('country', user.profile.country || '');
      if (user.profile.dateOfBirth) {
        setDateOfBirthISO(user.profile.dateOfBirth);
      }
    }
  }, [user, setValue]);

  // dateOfBirthISO 변경 시 표시값 동기화
  useEffect(() => {
    if (dateOfBirthISO) {
      const [year, month, day] = dateOfBirthISO.split('-');
      if (year && month && day) {
        setDateDisplayValue(`${year} / ${month.padStart(2, '0')} / ${day.padStart(2, '0')}`);
      } else if (year && month) {
        setDateDisplayValue(`${year} / ${month.padStart(2, '0')} / `);
      } else if (year) {
        setDateDisplayValue(`${year} / `);
      } else {
        setDateDisplayValue('');
      }
    } else {
      setDateDisplayValue('');
    }
  }, [dateOfBirthISO]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync({ ...data, dateOfBirth: dateOfBirthISO });
      setShowSaveSuccess(true);
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('프로필 업데이트에 실패했습니다.');
    }
  };

  const handleSaveSuccessClose = () => {
    setShowSaveSuccess(false);
    onClose();
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await logout.mutateAsync();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-overlay-fade">
        <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-modal-pop">
          <div className="sticky top-0 bg-white border-b border-brown-200 p-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-brown-900">프로필 편집</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-5">
            {/* 프로필 이미지 */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-full bg-brown-200 flex items-center justify-center overflow-hidden">
                  {user?.profile?.profileImageUrl ? (
                    <img
                      src={user.profile.profileImageUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-brown-600" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#665146] flex items-center justify-center">
                  <Pencil className="w-3 h-3 text-white" />
                </div>
              </div>
              <Label className="text-brown-900">프로필 이미지</Label>
            </div>

            {/* 이메일 (읽기 전용) */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-brown-900">이메일</Label>
              <Input
                id="email"
                value={user?.email ?? ''}
                readOnly
                disabled
                className="bg-gray-100 text-muted-foreground"
              />
            </div>

            {/* 닉네임 */}
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-brown-900">닉네임</Label>
              <Input
                id="nickname"
                {...register('nickname')}
                placeholder="닉네임을 입력하세요"
                className="bg-gray-50"
              />
              {errors.nickname && (
                <p className="text-sm text-red-600">{errors.nickname.message}</p>
              )}
            </div>

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-brown-900">이름</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="이름을 입력하세요"
                className="bg-gray-50"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* 생년월일 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dateOfBirth" className="text-brown-900">생년월일</Label>
                <button
                  ref={calendarButtonRef}
                  type="button"
                  onClick={() => {
                    if (dateOfBirthISO) {
                      const [year, month, day] = dateOfBirthISO.split('-');
                      if (year && month && day) {
                        const selectedYear = parseInt(year);
                        setCalendarDate(new Date(selectedYear, parseInt(month) - 1, parseInt(day)));
                        // 선택된 연도 기준으로 10년 범위 설정
                        setYearPickerStartYear(Math.floor(selectedYear / 10) * 10);
                      }
                    } else {
                      // 현재 연도 기준으로 10년 범위 설정
                      const currentYear = new Date().getFullYear();
                      setYearPickerStartYear(Math.floor(currentYear / 10) * 10);
                    }
                    setShowCalendar(!showCalendar);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Calendar className="w-4 h-4 text-[#4A2C1A]" />
                </button>
                
                {/* 커스텀 달력 - 모달 형태로 화면 중앙에 표시 */}
                {showCalendar && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-overlay-fade">
                    <div 
                      className="fixed inset-0 bg-black/50 z-[60]" 
                      onClick={() => setShowCalendar(false)}
                    />
                    <div
                      ref={calendarRef}
                      className="relative z-[70] bg-gray-800 rounded-lg p-4 shadow-xl w-full max-w-sm animate-modal-pop"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* 달력 헤더 */}
                      <div className="flex items-center justify-between mb-4 text-white">
                        <button
                          type="button"
                          onClick={() => setShowYearMonthPicker(!showYearMonthPicker)}
                          className="flex items-center gap-2 hover:bg-gray-700 rounded px-2 py-1"
                        >
                          <span className="text-sm font-medium">
                            {format(calendarDate, 'yyyy년 MM월', { locale: ko })}
                          </span>
                          <ChevronDownIcon className={`w-4 h-4 transition-transform ${showYearMonthPicker ? 'rotate-180' : ''}`} />
                        </button>
                        {!showYearMonthPicker && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCalendarDate(subMonths(calendarDate, 1))}
                              className="p-1 hover:bg-gray-700 rounded"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCalendarDate(addMonths(calendarDate, 1))}
                              className="p-1 hover:bg-gray-700 rounded"
                            >
                              <ChevronDownIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* 연도/월 선택기 */}
                      {showYearMonthPicker && (
                        <div className="mb-4">
                          {/* 연도 선택 헤더 */}
                          <div className="flex items-center justify-between mb-3">
                            <button
                              type="button"
                              onClick={() => setYearPickerStartYear(yearPickerStartYear - 10)}
                              className="p-1 hover:bg-gray-700 rounded text-white"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-white">
                              {yearPickerStartYear}년 - {yearPickerStartYear + 9}년
                            </span>
                            <button
                              type="button"
                              onClick={() => setYearPickerStartYear(yearPickerStartYear + 10)}
                              className="p-1 hover:bg-gray-700 rounded text-white"
                            >
                              <ChevronLeft className="w-4 h-4 rotate-180" />
                            </button>
                          </div>
                          
                          {/* 연도 그리드 (10년치) */}
                          <div className="grid grid-cols-5 gap-2 mb-3">
                            {Array.from({ length: 10 }, (_, i) => {
                              const year = yearPickerStartYear + i;
                              const isCurrentYear = year === calendarDate.getFullYear();
                              return (
                                <button
                                  key={year}
                                  type="button"
                                  onClick={() => {
                                    // 연도만 선택하고 연도/월 선택기는 유지 (월 선택 가능하도록)
                                    setCalendarDate(new Date(year, calendarDate.getMonth(), 1));
                                    // setShowYearMonthPicker(false); 제거 - 연도 선택 후에도 선택기 유지
                                  }}
                                  className={`p-2 rounded text-xs ${
                                    isCurrentYear
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-700 text-white hover:bg-gray-600'
                                  }`}
                                >
                                  {year}
                                </button>
                              );
                            })}
                          </div>
                          
                          {/* 월 그리드 */}
                          <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 12 }, (_, i) => {
                              const month = i + 1;
                              const isCurrentMonth = month === calendarDate.getMonth() + 1;
                              const isCurrentYearMonth = 
                                calendarDate.getFullYear() === new Date().getFullYear() &&
                                month === new Date().getMonth() + 1;
                              return (
                                <button
                                  key={month}
                                  type="button"
                                  onClick={() => {
                                    setCalendarDate(new Date(calendarDate.getFullYear(), month - 1, 1));
                                    setShowYearMonthPicker(false);
                                  }}
                                  className={`p-2 rounded text-xs ${
                                    isCurrentMonth && isCurrentYearMonth
                                      ? 'bg-blue-500 text-white'
                                      : isCurrentMonth
                                      ? 'bg-gray-600 text-white'
                                      : 'bg-gray-700 text-white hover:bg-gray-600'
                                  }`}
                                >
                                  {month}월
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* 요일 헤더 */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                          <div key={day} className="text-center text-xs text-gray-400 py-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      {/* 달력 그리드 */}
                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          const monthStart = startOfMonth(calendarDate);
                          const monthEnd = endOfMonth(calendarDate);
                          const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
                          const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
                          const days = eachDayOfInterval({ start: startDate, end: endDate });
                          const selectedDate = dateOfBirthISO ? new Date(dateOfBirthISO) : null;
                          
                          return days.map((day) => {
                            const isCurrentMonth = isSameMonth(day, calendarDate);
                            const isSelected = selectedDate && isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            
                            return (
                              <button
                                key={day.toISOString()}
                                type="button"
                                onClick={() => {
                                  const dateStr = format(day, 'yyyy-MM-dd');
                                  setDateOfBirthISO(dateStr);
                                  setShowCalendar(false);
                                }}
                                className={`
                                  w-8 h-8 rounded text-xs
                                  ${!isCurrentMonth ? 'text-gray-600' : 'text-white'}
                                  ${isSelected ? 'bg-blue-500 text-white border border-white' : ''}
                                  ${!isSelected && isCurrentMonth ? 'hover:bg-gray-700' : ''}
                                  ${isToday && !isSelected ? 'border border-gray-500' : ''}
                                `}
                              >
                                {getDate(day)}
                              </button>
                            );
                          });
                        })()}
                      </div>
                      
                      {/* 하단 버튼 */}
                      <div className="flex justify-between mt-4 pt-4 border-t border-gray-700">
                        <button
                          type="button"
                          onClick={() => {
                            setDateOfBirthISO(undefined);
                            setShowCalendar(false);
                          }}
                          className="text-blue-400 text-sm"
                        >
                          삭제
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const today = format(new Date(), 'yyyy-MM-dd');
                            setDateOfBirthISO(today);
                            setCalendarDate(new Date());
                            setShowCalendar(false);
                          }}
                          className="text-blue-400 text-sm"
                        >
                          오늘
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <Input
                ref={dateInputRef}
                id="dateOfBirth"
                type="text"
                placeholder="2000 / 00 / 00"
                value={dateDisplayValue}
                onChange={(e) => {
                  const input = e.target;
                  const oldValue = dateDisplayValue;
                  const newValue = e.target.value;
                  const cursorPosition = input.selectionStart || 0;
                  
                  // 이전 숫자 개수 계산
                  const oldNumbers = oldValue.replace(/[^\d]/g, '');
                  // 새 숫자만 추출
                  const newNumbers = newValue.replace(/[^\d]/g, '');
                  
                  // 숫자가 변경되지 않았으면 포맷팅만 수행
                  if (oldNumbers === newNumbers && newValue !== oldValue) {
                    // 포맷팅만 변경된 경우 (슬래시 추가/제거 등)
                    return;
                  }
                  
                  // 한 번에 하나의 숫자만 추가되도록 제한
                  const numbersDiff = newNumbers.length - oldNumbers.length;
                  if (numbersDiff > 1) {
                    // 여러 숫자가 한 번에 입력된 경우, 마지막 숫자만 허용
                    const lastNumber = newNumbers.slice(-1);
                    const limitedNumbers = oldNumbers + lastNumber;
                    
                    // 제한된 숫자로 다시 처리
                    const year = limitedNumbers.slice(0, 4);
                    const month = limitedNumbers.slice(4, 6);
                    const day = limitedNumbers.slice(6, 8);
                    
                    let displayValue = '';
                    if (year.length > 0) {
                      displayValue = year;
                      if (month.length > 0) {
                        displayValue += ` / ${month}`;
                        if (day.length > 0) {
                          displayValue += ` / ${day}`;
                        }
                      } else if (year.length === 4) {
                        // 년도 4자리 입력 후 자동으로 " / " 추가
                        displayValue = year + ' / ';
                      }
                    }
                    
                    setDateDisplayValue(displayValue);
                    
                    // 폼에 저장할 값 업데이트
                    if (year.length === 4 && month.length === 2 && day.length === 2) {
                      setDateOfBirthISO(`${year}-${month}-${day}`);
                    } else if (year.length === 4 && month.length === 2) {
                      setDateOfBirthISO(`${year}-${month}-`);
                    } else if (year.length === 4) {
                      setDateOfBirthISO(`${year}--`);
                    } else if (year.length > 0) {
                      setDateOfBirthISO(`${year}-`);
                    } else {
                      setDateOfBirthISO(undefined);
                    }
                    
                    // 커서 위치 조정
                    requestAnimationFrame(() => {
                      if (!dateInputRef.current) return;
                      let newPos = 0;
                      if (limitedNumbers.length <= 4) {
                        newPos = limitedNumbers.length;
                        if (limitedNumbers.length === 4) {
                          newPos = 7; // "2000 / " = 7자리
                        }
                      } else if (limitedNumbers.length <= 6) {
                        newPos = limitedNumbers.length + 3;
                        if (limitedNumbers.length === 6) {
                          newPos = 10; // "2000 / 12 / " = 10자리
                        }
                      } else {
                        newPos = limitedNumbers.length + 6;
                      }
                      newPos = Math.min(newPos, displayValue.length);
                      dateInputRef.current.setSelectionRange(newPos, newPos);
                    });
                    
                    return;
                  }
                  
                  // 년(4자리), 월(2자리), 일(2자리)로 분리
                  const year = newNumbers.slice(0, 4);
                  const month = newNumbers.slice(4, 6);
                  const day = newNumbers.slice(6, 8);
                  
                  // 표시값 생성 - 실제 입력된 값만 표시
                  let displayValue = '';
                  if (year.length > 0) {
                    displayValue = year;
                    // 월 부분은 실제로 입력된 경우에만 추가
                    if (month.length > 0) {
                      displayValue += ` / ${month}`;
                      // 일 부분은 실제로 입력된 경우에만 추가
                      if (day.length > 0) {
                        displayValue += ` / ${day}`;
                      }
                    } else if (year.length === 4) {
                      // 년도 4자리 입력 후 자동으로 " / " 추가
                      displayValue = year + ' / ';
                    }
                  }
                  
                  setDateDisplayValue(displayValue);
                  
                  // 폼에 저장할 값 (ISO 형식: YYYY-MM-DD)
                  if (year.length === 4 && month.length === 2 && day.length === 2) {
                    setDateOfBirthISO(`${year}-${month}-${day}`);
                  } else if (year.length === 4 && month.length === 2) {
                    setDateOfBirthISO(`${year}-${month}-`);
                  } else if (year.length === 4) {
                    setDateOfBirthISO(`${year}--`);
                  } else if (year.length > 0) {
                    setDateOfBirthISO(`${year}-`);
                  } else {
                    setDateOfBirthISO(undefined);
                  }
                  
                  // 커서 위치 계산 및 복원
                  requestAnimationFrame(() => {
                    if (!dateInputRef.current) return;
                    
                    // 숫자 입력 위치에 따라 커서 위치 조정
                    let newCursorPos = cursorPosition;
                    const oldNumbersCount = oldNumbers.length;
                    const newNumbersCount = newNumbers.length;
                    
                    // 숫자가 추가된 경우
                    if (newNumbersCount > oldNumbersCount) {
                      // 년도 입력 중
                      if (newNumbersCount <= 4) {
                        newCursorPos = newNumbersCount;
                        // 년도 4자리 입력 완료 시 " / " 뒤로 커서 이동
                        if (newNumbersCount === 4) {
                          newCursorPos = 7; // "2000 / " = 7자리
                        }
                      }
                      // 월 입력 중
                      else if (newNumbersCount <= 6) {
                        newCursorPos = newNumbersCount + 3; // "YYYY / " = 7자리, 그 다음 숫자 위치
                        // 월 2자리 입력 완료 시 " / " 뒤로 커서 이동
                        if (newNumbersCount === 6) {
                          newCursorPos = 10; // "2000 / 12 / " = 10자리
                        }
                      }
                      // 일 입력 중
                      else {
                        newCursorPos = newNumbersCount + 6; // "YYYY / MM / " = 10자리, 그 다음 숫자 위치
                      }
                    }
                    // 숫자가 삭제된 경우
                    else if (newNumbersCount < oldNumbersCount) {
                      // 년도 삭제 중
                      if (newNumbersCount <= 4) {
                        newCursorPos = newNumbersCount;
                      }
                      // 월 삭제 중
                      else if (newNumbersCount <= 6) {
                        newCursorPos = newNumbersCount + 3;
                      }
                      // 일 삭제 중
                      else {
                        newCursorPos = newNumbersCount + 6;
                      }
                    }
                    
                    newCursorPos = Math.min(newCursorPos, displayValue.length);
                    dateInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                  });
                }}
                onKeyDown={(e) => {
                  // 백스페이스 처리: 슬래시나 공백을 건너뛰기
                  if (e.key === 'Backspace' && dateInputRef.current) {
                    const input = dateInputRef.current;
                    const cursorPos = input.selectionStart || 0;
                    const value = input.value;
                    
                    // 커서가 슬래시나 공백 바로 뒤에 있으면 한 칸 더 뒤로
                    if (cursorPos > 0 && (value[cursorPos - 1] === '/' || value[cursorPos - 1] === ' ')) {
                      e.preventDefault();
                      const numbers = value.replace(/[^\d]/g, '');
                      const newNumbers = numbers.slice(0, Math.max(0, numbers.length - 1));
                      
                      const year = newNumbers.slice(0, 4);
                      const month = newNumbers.slice(4, 6);
                      const day = newNumbers.slice(6, 8);
                      
                      let displayValue = '';
                      if (year.length > 0) {
                        displayValue = year;
                        // 월 부분은 실제로 입력된 경우에만 추가
                        if (month.length > 0) {
                          displayValue += ` / ${month}`;
                          // 일 부분은 실제로 입력된 경우에만 추가
                          if (day.length > 0) {
                            displayValue += ` / ${day}`;
                          }
                        } else if (year.length === 4) {
                          // 년도 4자리 입력 후 자동으로 " / " 추가
                          displayValue = year + ' / ';
                        }
                      }
                      
                      setDateDisplayValue(displayValue);
                      
                      if (year.length === 4 && month.length === 2 && day.length === 2) {
                        setDateOfBirthISO(`${year}-${month}-${day}`);
                      } else if (year.length === 4 && month.length === 2) {
                        setDateOfBirthISO(`${year}-${month}-`);
                      } else if (year.length === 4) {
                        setDateOfBirthISO(`${year}--`);
                      } else if (year.length > 0) {
                        setDateOfBirthISO(`${year}-`);
                      } else {
                        setDateOfBirthISO(undefined);
                      }
                      
                      requestAnimationFrame(() => {
                        if (!dateInputRef.current) return;
                        let newPos = 0;
                        if (newNumbers.length <= 4) {
                          newPos = newNumbers.length;
                        } else if (newNumbers.length <= 6) {
                          newPos = newNumbers.length + 3;
                        } else {
                          newPos = newNumbers.length + 6;
                        }
                        newPos = Math.max(0, Math.min(newPos, displayValue.length));
                        dateInputRef.current.setSelectionRange(newPos, newPos);
                      });
                    }
                  }
                }}
                className={`bg-gray-100 text-center ${errors.dateOfBirth ? 'border-red-500' : ''}`}
              />
            </div>

            {/* 국가 선택 */}
            <div className="space-y-2">
              <Label htmlFor="country" className="text-brown-900">국가 선택</Label>
              <select
                id="country"
                {...register('country')}
                className="w-full h-10 rounded-md border border-input bg-gray-50 px-3 text-sm"
              >
                <option value="">국가 선택</option>
                <option value="KR">대한민국</option>
                <option value="US">미국</option>
                <option value="JP">일본</option>
                <option value="CN">중국</option>
                <option value="ETC">기타</option>
              </select>
            </div>

            {/* 로그아웃 | 회원탈퇴 */}
            <div className="flex items-center justify-center gap-2 py-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="text-sm text-muted-foreground hover:text-brown-900 underline"
              >
                로그아웃
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onClick={() => setShowWithdraw(true)}
                className="text-sm text-muted-foreground hover:text-brown-900 underline"
              >
                회원탈퇴
              </button>
            </div>

            {/* 저장 버튼 */}
            <Button
              type="submit"
              className="w-full bg-[#665146] hover:bg-[#5A453A] text-white py-3"
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? '저장 중...' : '저장'}
            </Button>
          </form>
        </div>
      </div>

      {/* 저장되었습니다 팝업 */}
      {showSaveSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 mb-6">저장되었습니다</p>
            <Button
              type="button"
              className="w-full bg-[#665146] hover:bg-[#5A453A]"
              onClick={handleSaveSuccessClose}
            >
              확인
            </Button>
          </div>
        </div>
      )}

      {/* 로그아웃 확인 팝업 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 mb-6">정말 로그아웃 하시겠습니까?</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-0 text-brown-700 rounded-full hover:bg-gray-100"
                onClick={() => setShowLogoutConfirm(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#665146] hover:bg-[#5A453A]"
                onClick={handleLogoutConfirm}
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 회원탈퇴 모달 */}
      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          onWithdrawComplete={() => {
            setShowWithdraw(false);
            onClose();
          }}
          hasActiveSubscription={!!activeSubscription}
        />
      )}
    </>
  );
}
