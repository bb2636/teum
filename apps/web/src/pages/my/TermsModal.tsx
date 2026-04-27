import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { t, getCurrentLanguage } from '@/lib/i18n';

const TERMS_TITLE_MAP: Record<string, Record<string, string>> = {
  ko: {
    service: '서비스 이용약관',
    privacy: '개인정보 처리방침',
    payment: '정기결제/자동갱신',
    refund: '환불/취소 정책',
  },
  en: {
    service: 'Terms of Service',
    privacy: 'Privacy Policy',
    payment: 'Recurring Payment / Auto-Renewal',
    refund: 'Refund / Cancellation Policy',
  },
};

interface TermsModalProps {
  type: string;
  onClose: () => void;
}

export function TermsModal({ type, onClose }: TermsModalProps) {
  const [terms, setTerms] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const response = await apiRequest<{
          data: { title: string; content: string };
        }>(`/terms/${type}`);
        const data = response.data;

        const lang = getCurrentLanguage();
        if (lang !== 'ko' && data.title && data.content) {
          setTerms(data);
          setLoading(false);
          setTranslating(true);
          try {
            const translated = await apiRequest<{
              data: { title: string; content: string };
            }>('/terms/translate', {
              method: 'POST',
              body: JSON.stringify({ title: data.title, content: data.content, lang, type }),
            });
            setTerms(translated.data);
          } catch {
            // keep original if translation fails
          } finally {
            setTranslating(false);
          }
        } else {
          setTerms(data);
        }
      } catch (error) {
        console.error('Failed to fetch terms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTerms();
  }, [type]);

  const lang = getCurrentLanguage();
  const titleMap = TERMS_TITLE_MAP[lang] || TERMS_TITLE_MAP.ko;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] animate-overlay-fade"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        paddingLeft: '1rem',
        paddingRight: '1rem',
      }}
    >
      <div className="bg-white rounded-xl max-w-md w-full max-h-full overflow-y-auto animate-modal-pop">
        <div className="sticky top-0 bg-white border-b border-brown-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brown-900">
            {titleMap[type] || type}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          ) : terms ? (
            <div className="space-y-4">
              {translating && (
                <div className="text-center py-2 text-xs text-gray-400">
                  {lang === 'en' ? 'Translating...' : t('common.loading')}
                </div>
              )}
              <h3 className="font-semibold text-brown-900">{terms.title}</h3>
              <div className="prose prose-sm max-w-none text-brown-800 whitespace-pre-wrap">
                {terms.content}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('terms.loadFailed')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
