import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { useT } from '@/hooks/useTranslation';

const WITHDRAW_NOTICE = `제1조 (목적)
본 약관은 회사가 제공하는 서비스의 이용 조건, 절차, 이용자와 회사 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 일기 및 이와 관련된 일체의 서비스를 의미합니다.
2. "회원"이란 서비스 이용계약을 체결하고 회사가 부여한 ID를 부여받은 자를 말합니다.

제3조 (약관의 효력 및 변경)
1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.
2. 회사는 합리적인 사유가 발생할 경우 관련 법령에 위배되지 않는 범위에서 본 약관을 변경할 수 있습니다.`;

interface WithdrawModalProps {
  onClose: () => void;
  onWithdrawComplete?: () => void;
  hasActiveSubscription?: boolean;
}

export function WithdrawModal({ onClose, onWithdrawComplete, hasActiveSubscription }: WithdrawModalProps) {
  const navigate = useNavigate();
  const t = useT();
  const [agreed, setAgreed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteError, setShowDeleteError] = useState(false);
  const [showSubWarning, setShowSubWarning] = useState(false);

  const handleDelete = async () => {
    if (hasActiveSubscription) {
      setShowSubWarning(true);
    } else {
      setShowConfirm(true);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await apiRequest('/users/account', { method: 'DELETE' });
      setShowConfirm(false);
      setShowComplete(true);
    } catch (e) {
      setShowConfirm(false);
      setShowDeleteError(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const queryClient = useQueryClient();

  const handleCompleteClose = () => {
    setShowComplete(false);
    onClose();
    onWithdrawComplete?.();
    sessionStorage.setItem('teum_logged_out', '1');
    queryClient.setQueryData(['user', 'me'], null);
    queryClient.removeQueries({ queryKey: ['user', 'me'] });
    queryClient.clear();
    navigate('/splash', { replace: true });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-overlay-fade">
        <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col animate-modal-pop">
          <div className="flex items-center justify-between p-4 border-b border-brown-200 shrink-0">
            <h2 className="text-xl font-bold text-brown-900">{t('auth.withdrawTitle')}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-4">
            <h3 className="font-semibold text-brown-900 mb-3">{t('auth.withdrawNotice')}</h3>
            <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed mb-6">
              {WITHDRAW_NOTICE}
            </div>

            <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-brown-600"
              />
              <span className="text-sm text-brown-900">
                {t('auth.withdrawAgree')}
              </span>
            </label>

            <Button
              type="button"
              variant="outline"
              className="w-full mt-6 border-0 text-brown-700 hover:bg-brown-50 rounded-full"
              disabled={!agreed}
              onClick={handleDelete}
            >
              {t('auth.deleteAccount')}
            </Button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg animate-modal-pop">
            <p className="text-center text-brown-900 mb-6">
              {t('auth.deleteConfirmMsg')}
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-0 text-brown-700 rounded-full hover:bg-gray-100"
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#4A2C1A] hover:bg-[#3A2010]"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t('common.processing') : t('common.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 mb-6">{t('auth.withdrawComplete')}</p>
            <Button
              type="button"
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010]"
              onClick={handleCompleteClose}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {showSubWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg animate-modal-pop">
            <h3 className="text-lg font-bold text-[#4A2C1A] text-center mb-3">{t('auth.subWarningTitle')}</h3>
            <p className="text-sm text-gray-700 text-center leading-relaxed mb-6">
              {t('auth.subWarningDesc').split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
              <span className="font-semibold text-red-500">{t('auth.noRefund')}</span>
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                className="flex-1 bg-[#4A2C1A] hover:bg-[#3A2010] rounded-full"
                onClick={() => setShowSubWarning(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-0 text-gray-500 rounded-full hover:bg-gray-100"
                onClick={() => {
                  setShowSubWarning(false);
                  setShowConfirm(true);
                }}
              >
                {t('auth.proceedWithdraw')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 animate-overlay-fade">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-lg text-center animate-modal-pop">
            <p className="text-brown-900 mb-6">{t('auth.withdrawFailed')}</p>
            <Button
              type="button"
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010]"
              onClick={() => setShowDeleteError(false)}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
