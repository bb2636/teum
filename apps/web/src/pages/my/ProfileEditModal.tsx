import { useEffect, useState, useRef } from 'react';
import { X, User, Pencil, Calendar, ChevronUp, ChevronDown as ChevronDownIcon, ChevronLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDate, startOfWeek, endOfWeek } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
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
import { useT } from '@/hooks/useTranslation';

const profileSchema = z.object({
  nickname: z
    .string()
    .optional()
    .refine((v) => !v || v.length === 0 || (v.length >= 2 && v.length <= 12), 'auth.nicknameRule'),
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
  const t = useT();
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
      alert(t('my.profileUpdateFailed'));
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
            <h2 className="text-xl font-bold text-brown-900">{t('my.profileEdit')}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100"
              aria-label={t('common.close')}
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
              <Label className="text-brown-900">{t('my.profileImage')}</Label>
            </div>

            {/* 이메일 (읽기 전용) */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-brown-900">{t('auth.email')}</Label>
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
              <Label htmlFor="nickname" className="text-brown-900">{t('auth.nickname')}</Label>
              <Input
                id="nickname"
                {...register('nickname')}
                placeholder={t('auth.enterNickname')}
                className="bg-gray-50"
              />
              {errors.nickname && (
                <p className="text-sm text-red-600">{errors.nickname.message}</p>
              )}
            </div>

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-brown-900">{t('auth.name')}</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder={t('auth.enterName')}
                className="bg-gray-50"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* 생년월일 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dateOfBirth" className="text-brown-900">{t('auth.dateOfBirth')}</Label>
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
                            {format(calendarDate, 'yyyy MMMM', { locale: getDateLocale() })}
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
                              {t('my.yearRange', { start: String(yearPickerStartYear), end: String(yearPickerStartYear + 9) })}
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
                                  {t('my.monthLabel', { month: String(month) })}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* 요일 헤더 */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {t('calendar.weekdays').split(',').map((day) => (
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
                          {t('my.calendarDelete')}
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
                          {t('my.calendarToday')}
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
                readOnly
                onFocus={(e) => { e.target.blur(); setShowCalendar(true); }}
                onClick={() => setShowCalendar(true)}
                className={`bg-gray-100 text-center cursor-pointer ${errors.dateOfBirth ? 'border-red-500' : ''}`}
              />
            </div>

            {/* 국가 선택 */}
            <div className="space-y-2">
              <Label htmlFor="country" className="text-brown-900">{t('my.selectCountry')}</Label>
              <select
                id="country"
                {...register('country')}
                className="w-full h-10 rounded-md border border-input bg-gray-50 px-3 text-sm"
              >
                <option value="">{t('my.selectCountry')}</option>
                <option value="KR">🇰🇷 Korea</option>
                <option value="US">🇺🇸 USA</option>
                <option value="JP">🇯🇵 Japan</option>
                <option value="CN">🇨🇳 China</option>
                <option value="ETC">{t('common.other')}</option>
              </select>
            </div>

            {/* 로그아웃 | 회원탈퇴 */}
            <div className="flex items-center justify-center gap-2 py-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="text-sm text-muted-foreground hover:text-brown-900 underline"
              >
                {t('auth.logout')}
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onClick={() => setShowWithdraw(true)}
                className="text-sm text-muted-foreground hover:text-brown-900 underline"
              >
                {t('auth.withdraw')}
              </button>
            </div>

            {/* 저장 버튼 */}
            <Button
              type="submit"
              className="w-full bg-[#665146] hover:bg-[#5A453A] text-white py-3"
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </div>
      </div>

      {/* 저장되었습니다 팝업 */}
      {showSaveSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 mb-6">{t('my.saved')}</p>
            <Button
              type="button"
              className="w-full bg-[#665146] hover:bg-[#5A453A]"
              onClick={handleSaveSuccessClose}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {/* 로그아웃 확인 팝업 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 mb-6">{t('auth.logoutConfirm')}</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-0 text-brown-700 rounded-full hover:bg-gray-100"
                onClick={() => setShowLogoutConfirm(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#665146] hover:bg-[#5A453A]"
                onClick={handleLogoutConfirm}
              >
                {t('common.confirm')}
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
