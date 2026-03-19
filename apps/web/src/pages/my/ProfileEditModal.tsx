import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMe, useUpdateProfile, User as UserType } from '@/hooks/useProfile';
import { useLogout } from '@/hooks/useAuth';
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

function formatDateForInput(dateStr?: string | null) {
  if (!dateStr) return { year: '', month: '', day: '' };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { year: '', month: '', day: '' };
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    day: String(d.getDate()).padStart(2, '0'),
  };
}

function toISODate(year: string, month: string, day: string) {
  if (!year || !month || !day) return undefined;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return undefined;
  const date = new Date(y, m - 1, d);
  return date.toISOString().split('T')[0];
}

export function ProfileEditModal({ user, onClose }: ProfileEditModalProps) {
  const navigate = useNavigate();
  const logout = useLogout();
  const updateProfile = useUpdateProfile();
  const { refetch } = useMe();

  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');

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
      const b = formatDateForInput(user.profile.dateOfBirth);
      setBirthYear(b.year);
      setBirthMonth(b.month);
      setBirthDay(b.day);
    }
  }, [user, setValue]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      const dateOfBirth = toISODate(birthYear, birthMonth, birthDay);
      await updateProfile.mutateAsync({ ...data, dateOfBirth });
      await refetch();
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
    onClose();
    navigate('/login');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
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
              <Label className="text-brown-900">생년월일</Label>
              <div className="flex items-center gap-2 bg-gray-50 rounded-md border border-input px-3 py-2">
                <input
                  type="text"
                  placeholder="YYYY"
                  maxLength={4}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-14 bg-transparent outline-none text-center"
                />
                <span className="text-muted-foreground">/</span>
                <input
                  type="text"
                  placeholder="MM"
                  maxLength={2}
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="w-8 bg-transparent outline-none text-center"
                />
                <span className="text-muted-foreground">/</span>
                <input
                  type="text"
                  placeholder="DD"
                  maxLength={2}
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="w-8 bg-transparent outline-none text-center"
                />
              </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center">
            <p className="text-brown-900 mb-6">정말 로그아웃 하시겠습니까?</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-brown-300 text-brown-700"
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
        />
      )}
    </>
  );
}
