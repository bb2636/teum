import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuestionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (question: string) => Promise<void>;
  initialQuestion?: string;
  mode: 'create' | 'edit';
  isLoading?: boolean;
}

export function QuestionEditModal({
  isOpen,
  onClose,
  onSave,
  initialQuestion = '',
  mode,
  isLoading = false,
}: QuestionEditModalProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuestion(initialQuestion);
      setHasChanges(false);
    }
  }, [isOpen, initialQuestion]);

  const handleQuestionChange = (value: string) => {
    setQuestion(value);
    setHasChanges(value !== initialQuestion && value.trim() !== '');
  };

  const handleClose = () => {
    if (hasChanges && question.trim() !== '') {
      if (!confirm('입력한 내용이 취소됩니다. 계속하시겠습니까?')) {
        return;
      }
    }
    setQuestion('');
    setHasChanges(false);
    onClose();
  };

  const handleSave = async () => {
    if (!question.trim()) return;
    await onSave(question.trim());
    setQuestion('');
    setHasChanges(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#4A2C1A]">
              {mode === 'create' ? '등록하기' : '수정하기'}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              질문 내용
            </label>
            <textarea
              value={question}
              onChange={(e) => handleQuestionChange(e.target.value)}
              placeholder="사용자에게 물어볼 질문을 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#4A2C1A] focus:border-transparent"
              rows={4}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSave();
                } else if (e.key === 'Escape') {
                  handleClose();
                }
              }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <Button
              onClick={handleClose}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={!question.trim() || isLoading}
              className={`${
                question.trim() && !isLoading
                  ? 'bg-[#4A2C1A] text-white hover:bg-[#3A2215]'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {mode === 'create' ? '등록하기' : '수정'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
