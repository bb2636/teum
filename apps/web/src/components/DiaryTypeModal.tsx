import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useT } from '@/hooks/useTranslation';

export function DiaryTypeModal() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const t = useT();

  useEffect(() => {
    const handleOpen = () => setShow(true);
    window.addEventListener('openDiaryTypeModal', handleOpen);
    return () => window.removeEventListener('openDiaryTypeModal', handleOpen);
  }, []);

  if (!show) return null;

  const handleSelect = (type: 'free_form' | 'question_based') => {
    setShow(false);
    const today = format(new Date(), 'yyyy-MM-dd');
    navigate(`/diaries/new?type=${type}&date=${today}`);
  };

  const titleLines = t('diary.typeModalTitle').split('\n');
  const descLines = t('diary.typeModalDesc').split('\n');
  const hintLines = t('diary.typeModalHint').split('\n');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade" onClick={() => setShow(false)}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 animate-modal-pop text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-[#4A2C1A] mb-3">
          {titleLines.map((line, i) => (
            <span key={i}>{line}{i < titleLines.length - 1 && <br />}</span>
          ))}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {descLines.map((line, i) => (
            <span key={i}>{line}{i < descLines.length - 1 && <br />}</span>
          ))}
        </p>
        <div className="space-y-3">
          <button
            onClick={() => handleSelect('free_form')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-full text-[#4A2C1A] font-medium transition-colors"
          >
            {t('diary.freeFormWrite')}
          </button>
          <button
            onClick={() => handleSelect('question_based')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-full text-[#4A2C1A] font-medium transition-colors"
          >
            {t('diary.questionBasedWrite')}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-5">
          {hintLines.map((line, i) => (
            <span key={i}>{line}{i < hintLines.length - 1 && <br />}</span>
          ))}
        </p>
      </div>
    </div>
  );
}
