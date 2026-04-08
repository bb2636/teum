import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, Calendar } from 'lucide-react';
import { ScrollYearMonthPicker } from '@/components/ScrollYearMonthPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMe, useUpdateProfile } from '@/hooks/useProfile';
import { useLogout } from '@/hooks/useAuth';
import { useSubscriptions, getEffectiveSubscription } from '@/hooks/usePayment';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { WithdrawModal } from './WithdrawModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useT } from '@/hooks/useTranslation';
import { getCurrentLanguage } from '@/lib/i18n';

const profileSchema = z.object({
  nickname: z
    .string()
    .optional()
    .refine((v) => !v || v.length === 0 || (v.length >= 2 && v.length <= 12), { message: 'my.nicknameRule' }),
  name: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  country: z.string().max(100).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;


export function ProfileEditPage() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const logout = useLogout();
  const updateProfile = useUpdateProfile();
  const t = useT();
  const { setLanguage } = useLanguage();
  const { data: subscriptions = [] } = useSubscriptions();
  const activeSubscription = getEffectiveSubscription(subscriptions);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showLanguageList, setShowLanguageList] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'ko' | 'en'>(getCurrentLanguage());
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
      const { name: _name, country: _country, ...rest } = data;
      await updateProfile.mutateAsync({ ...rest, dateOfBirth: dateOfBirthISO });
      
      setLanguage(selectedLanguage);
      
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
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-beige-50">
        <div className="max-w-md mx-auto px-4 py-6" style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 24px))' }}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-brown-900">{t('my.profileEdit')}</h1>
            <button
              type="button"
              onClick={() => navigate('/my')}
              className="p-2 rounded-full hover:bg-brown-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                placeholder={t('my.nicknamePlaceholder')}
                className="bg-gray-50"
              />
              {errors.nickname && (
                <p className="text-sm text-red-600">{t(errors.nickname.message || '')}</p>
              )}
            </div>

            {/* 이름 (읽기 전용 - 변경 불가) */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-brown-900">{t('auth.name')}</Label>
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
                <Label htmlFor="dateOfBirth" className="text-brown-900">{t('auth.dateOfBirth')}</Label>
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
                readOnly
                onFocus={(e) => { e.target.blur(); setShowCalendar(true); }}
                onClick={() => setShowCalendar(true)}
                className={`bg-gray-100 text-center cursor-pointer ${errors.dateOfBirth ? 'border-red-500' : ''}`}
              />
            </div>

            {/* 언어 선택 */}
            <div className="space-y-2">
              <Label className="text-brown-900">{t('my.selectLanguage')}</Label>
              <button
                type="button"
                onClick={() => setShowLanguageList(true)}
                className="w-full h-10 rounded-md border border-input bg-gray-50 px-3 text-sm flex items-center justify-between text-left"
              >
                <span className="text-brown-900">
                  {selectedLanguage === 'ko' ? t('my.langKorean') : t('my.langEnglish')}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
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
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white py-3 rounded-full"
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
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] rounded-full"
              onClick={handleSaveSuccessClose}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {/* 저장 실패 팝업 */}
      {showSaveError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 mb-6">{t('my.saveFailed')}</p>
            <Button
              type="button"
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] rounded-full"
              onClick={() => setShowSaveError(false)}
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
                className="flex-1 bg-[#4A2C1A] hover:bg-[#3A2010] rounded-full"
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
          }}
          hasActiveSubscription={!!activeSubscription}
        />
      )}

      {showLanguageList && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 animate-overlay-fade"
          onClick={() => setShowLanguageList(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-md shadow-lg pb-safe flex flex-col animate-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-brown-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-brown-900">{t('my.selectLanguage')}</h2>
              <button
                type="button"
                onClick={() => setShowLanguageList(false)}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="divide-y divide-brown-100 py-2">
              {([{ value: 'ko', label: t('my.langKorean') }, { value: 'en', label: t('my.langEnglish') }] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSelectedLanguage(value);
                    setShowLanguageList(false);
                  }}
                  className="w-full p-4 flex items-center justify-between hover:bg-brown-50 transition-colors text-left"
                >
                  <span className="font-medium text-brown-900">{label}</span>
                  {selectedLanguage === value && (
                    <span className="text-brown-600 text-sm">✓</span>
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
