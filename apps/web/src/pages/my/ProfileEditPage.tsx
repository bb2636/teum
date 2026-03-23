import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, Calendar } from 'lucide-react';
import { ScrollYearMonthPicker } from '@/components/ScrollYearMonthPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMe, useUpdateProfile } from '@/hooks/useProfile';
import { useLogout } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { WithdrawModal } from './WithdrawModal';
import { COUNTRY_OPTIONS } from '@/lib/countries';
import { setLanguageFromCountry } from '@/lib/i18n';

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


export function ProfileEditPage() {
  const navigate = useNavigate();
  const { data: user, isLoading, refetch } = useMe();
  const logout = useLogout();
  const updateProfile = useUpdateProfile();
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showCountryList, setShowCountryList] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
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
    watch,
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

  useEffect(() => {
    if (dateOfBirthISO) {
      const dateOnly = dateOfBirthISO.includes('T') ? dateOfBirthISO.split('T')[0] : dateOfBirthISO;
      const [year, month, day] = dateOnly.split('-');
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
      const { name: _name, ...rest } = data;
      await updateProfile.mutateAsync({ ...rest, dateOfBirth: dateOfBirthISO });
      await refetch();
      
      // 국가가 변경된 경우 언어도 업데이트
      if (data.country) {
        setLanguageFromCountry(data.country);
      }
      
      setShowSaveSuccess(true);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setShowSaveError(true);
    }
  };

  const handleSaveSuccessClose = () => {
    setShowSaveSuccess(false);
    navigate('/my');
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await logout.mutateAsync();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-beige-50">
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-brown-900">프로필 편집</h1>
            <button
              type="button"
              onClick={() => navigate('/my')}
              className="p-2 rounded-full hover:bg-brown-100"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

            {/* 이름 (읽기 전용 - 변경 불가) */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-brown-900">이름</Label>
              <Input
                id="name"
                value={user?.profile?.name ?? ''}
                readOnly
                disabled
                className="bg-gray-100 text-muted-foreground"
              />
            </div>

            {/* 생년월일 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dateOfBirth" className="text-brown-900">생년월일</Label>
                <button
                  ref={calendarButtonRef}
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Calendar className="w-4 h-4 text-[#4A2C1A]" />
                </button>
                
                {showCalendar && (() => {
                  const isValidDate = dateOfBirthISO && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirthISO);
                  const selectedDate = isValidDate ? new Date(dateOfBirthISO) : new Date();
                  return (
                    <ScrollYearMonthPicker
                      selectedYear={selectedDate.getFullYear()}
                      selectedMonth={selectedDate.getMonth() + 1}
                      selectedDay={isValidDate ? selectedDate.getDate() : undefined}
                      onSelect={() => {}}
                      onClose={() => setShowCalendar(false)}
                      mode="year-month-day"
                      onSelectDay={(year, month, day) => {
                        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        setDateOfBirthISO(dateStr);
                      }}
                      onDelete={() => {
                        setDateOfBirthISO(undefined);
                      }}
                    />
                  );
                })()}
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

            {/* 국가 선택 - 팝업 스타일 토글 목록 (다른 팝업과 UI 통일) */}
            <div className="space-y-2">
              <Label className="text-brown-900">국가 선택</Label>
              <button
                type="button"
                onClick={() => setShowCountryList(true)}
                className="w-full h-10 rounded-md border border-input bg-gray-50 px-3 text-sm flex items-center justify-between text-left"
              >
                <span className={watch('country') ? 'text-brown-900' : 'text-muted-foreground'}>
                  {watch('country')
                    ? COUNTRY_OPTIONS.find((c) => c.value === watch('country'))?.label ?? '국가 선택'
                    : '국가 선택'}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>

            {/* 국가 선택 팝업은 form 바깥 fragment 레벨에서 렌더링 */}

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
              className="w-full bg-[#665146] hover:bg-[#5A453A] text-white py-3 rounded-full"
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
              className="w-full bg-[#665146] hover:bg-[#5A453A] rounded-full"
              onClick={handleSaveSuccessClose}
            >
              확인
            </Button>
          </div>
        </div>
      )}

      {/* 저장 실패 팝업 */}
      {showSaveError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 mb-6">프로필 업데이트에 실패했습니다.</p>
            <Button
              type="button"
              className="w-full bg-[#665146] hover:bg-[#5A453A] rounded-full"
              onClick={() => setShowSaveError(false)}
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
                className="flex-1 bg-[#665146] hover:bg-[#5A453A] rounded-full"
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
            navigate('/login');
          }}
        />
      )}

      {showCountryList && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 animate-overlay-fade"
          onClick={() => setShowCountryList(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-md shadow-lg pb-safe min-h-[40vh] max-h-[70vh] flex flex-col animate-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-brown-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-brown-900">국가 선택</h2>
              <button
                type="button"
                onClick={() => setShowCountryList(false)}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="divide-y divide-brown-100 overflow-y-auto flex-1 py-2">
              {COUNTRY_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setValue('country', value);
                    setShowCountryList(false);
                  }}
                  className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors text-left"
                >
                  <span className="font-medium text-brown-900">{label}</span>
                  {watch('country') === value && (
                    <span className="text-brown-600 text-sm">선택됨</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
