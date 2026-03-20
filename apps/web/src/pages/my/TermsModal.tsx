import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface TermsModalProps {
  type: 'service' | 'privacy' | 'payment' | 'refund';
  onClose: () => void;
}

export function TermsModal({ type, onClose }: TermsModalProps) {
  const [terms, setTerms] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const response = await apiRequest<{
          data: { title: string; content: string };
        }>(`/terms/${type}`);
        setTerms(response.data);
      } catch (error) {
        console.error('Failed to fetch terms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTerms();
  }, [type]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-overlay-fade">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-modal-pop">
        <div className="sticky top-0 bg-white border-b border-brown-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brown-900">
            {type === 'service' ? '서비스 이용약관' :
             type === 'privacy' ? '개인정보 처리방침' :
             type === 'payment' ? '정기결제/자동갱신' :
             '환불/취소 정책'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : terms ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-brown-900">{terms.title}</h3>
              <div className="prose prose-sm max-w-none text-brown-800 whitespace-pre-wrap">
                {terms.content}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              약관을 불러올 수 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
