import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface TermsResponse {
  data: {
    title?: string;
    content: string;
    version?: string;
    updatedAt?: string | null;
  };
}

export function EulaPage() {
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('서비스 이용약관 (EULA)');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest<TermsResponse>('/terms/service');
        if (cancelled) return;
        setContent(res.data?.content || '');
        if (res.data?.title) setTitle(res.data.title);
        setUpdatedAt(res.data?.updatedAt || null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '약관을 불러올 수 없습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#4A2C1A] mb-4">{title}</h1>
        {updatedAt && (
          <p className="text-xs text-gray-500 mb-6">
            최종 업데이트: {new Date(updatedAt).toLocaleDateString('ko-KR')}
          </p>
        )}

        {loading && <p className="text-sm text-gray-500">불러오는 중...</p>}

        {error && !loading && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && content && (
          <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">© Teum. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
