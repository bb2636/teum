import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMe, useUpdateProfile, User } from '@/hooks/useProfile';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const profileSchema = z.object({
  nickname: z.string().min(2).max(12).optional(),
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  country: z.string().max(100).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileEditModalProps {
  user: User | undefined;
  onClose: () => void;
}

export function ProfileEditModal({ user, onClose }: ProfileEditModalProps) {
  const updateProfile = useUpdateProfile();
  const { refetch } = useMe();

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
      dateOfBirth: user?.profile?.dateOfBirth
        ? user.profile.dateOfBirth.split('T')[0]
        : '',
      country: user?.profile?.country || '',
    },
  });

  useEffect(() => {
    if (user?.profile) {
      setValue('nickname', user.profile.nickname || '');
      setValue('name', user.profile.name || '');
      setValue('phone', user.profile.phone || '');
      setValue(
        'dateOfBirth',
        user.profile.dateOfBirth ? user.profile.dateOfBirth.split('T')[0] : ''
      );
      setValue('country', user.profile.country || '');
    }
  }, [user, setValue]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync(data);
      await refetch();
      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('프로필 업데이트에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-brown-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brown-900">프로필 편집</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">닉네임</Label>
            <Input
              id="nickname"
              {...register('nickname')}
              placeholder="닉네임을 입력하세요"
            />
            {errors.nickname && (
              <p className="text-sm text-red-600">{errors.nickname.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="이름을 입력하세요"
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">전화번호</Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder="010-1234-5678"
            />
            {errors.phone && (
              <p className="text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">생년월일</Label>
            <Input
              id="dateOfBirth"
              type="date"
              {...register('dateOfBirth')}
            />
            {errors.dateOfBirth && (
              <p className="text-sm text-red-600">{errors.dateOfBirth.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">국가</Label>
            <Input
              id="country"
              {...register('country')}
              placeholder="대한민국"
            />
            {errors.country && (
              <p className="text-sm text-red-600">{errors.country.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-brown-600 hover:bg-brown-700"
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
