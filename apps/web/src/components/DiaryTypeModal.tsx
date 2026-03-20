import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export function DiaryTypeModal() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade" onClick={() => setShow(false)}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[#4A2C1A] mb-2">
          오늘은 어떤 방식으로 남기시겠습니까?
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          빠르게 쓰거나, 질문에 따라<br />차근히 정리할 수 있습니다.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => handleSelect('free_form')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-[#4A2C1A] font-medium transition-colors"
          >
            자유작성
          </button>
          <button
            onClick={() => handleSelect('question_based')}
            className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-[#4A2C1A] font-medium transition-colors"
          >
            질문기록
          </button>
        </div>
      </div>
    </div>
  );
}
