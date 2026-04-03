import { useState, useEffect, useRef } from 'react';
import { t } from '@/lib/i18n';
import { useQuestions, useCreateQuestion, useUpdateQuestion, useDeleteQuestion, useUpdateQuestionOrder } from '@/hooks/useQuestions';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { QuestionEditModal } from './QuestionEditModal';
import { QuestionDeleteModal } from './QuestionDeleteModal';
import type { Question } from '@/hooks/useQuestions';

const EMPTY_QUESTIONS: Question[] = [];

export function QuestionsManagementTab() {
  const { data, isLoading } = useQuestions();
  const questions = data ?? EMPTY_QUESTIONS;
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const updateOrder = useUpdateQuestionOrder();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localQuestions, setLocalQuestions] = useState<typeof questions>([]);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTarget = useRef<number | null>(null);

  // questions가 변경되면 localQuestions 동기화 (초기 로드, refetch 시)
  // 주의: questions 기본값으로 [] 사용 시 매 렌더 새 참조가 생겨 무한 루프 발생 → EMPTY_QUESTIONS 사용
  useEffect(() => {
    if (questions.length > 0) {
      setLocalQuestions(questions);
    }
  }, [questions]);

  // 표시용: localQuestions가 있으면 사용 (드래그/수정 즉시 반영), 없으면 questions
  const sortedQuestions = localQuestions.length > 0 ? localQuestions : questions;

  const handleEdit = (question: { id: string; question: string }) => {
    setEditingId(question.id);
  };

  const handleSaveEdit = async (questionText: string) => {
    if (!editingId) return;

    const previousQuestions = [...localQuestions];
    setLocalQuestions((prev) =>
      prev.map((q) => (q.id === editingId ? { ...q, question: questionText } : q))
    );
    setEditingId(null);

    try {
      const updated = await updateQuestion.mutateAsync({
        id: editingId,
        question: questionText,
      });
      setLocalQuestions((prev) =>
        prev.map((q) => (q.id === editingId ? { ...q, ...updated } : q))
      );
    } catch (error) {
      console.error('Failed to update question:', error);
      setLocalQuestions(previousQuestions);
      setEditingId(editingId);
      alert('질문 수정에 실패했습니다.');
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    
    try {
      await deleteQuestion.mutateAsync(deletingId);
      setDeletingId(null);
    } catch (error) {
      console.error('Failed to delete question:', error);
      alert('질문 삭제에 실패했습니다.');
      throw error;
    }
  };

  const handleCreate = async (questionText: string) => {
    try {
      await createQuestion.mutateAsync({
        question: questionText,
        isActive: true,
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create question:', error);
      alert('질문 등록에 실패했습니다.');
      throw error;
    }
  };

  // Long press handlers for drag and drop
  const handleMouseDown = (index: number) => {
    longPressTarget.current = index;
    longPressTimer.current = setTimeout(() => {
      if (longPressTarget.current === index) {
        setIsDragging(true);
        setDraggedIndex(index);
      }
    }, 500); // 500ms long press
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressTarget.current = null;
  };

  const handleMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isDragging) {
      longPressTarget.current = null;
    }
  };

  const handleDragOver = (e: React.MouseEvent, index: number) => {
    if (!isDragging || draggedIndex === null) return;
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.MouseEvent, dropIndex: number) => {
    if (!isDragging || draggedIndex === null || draggedIndex === dropIndex) {
      setIsDragging(false);
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    e.preventDefault();

    // Reorder questions locally first for immediate feedback
    const newQuestions = [...sortedQuestions];
    const [movedQuestion] = newQuestions.splice(draggedIndex, 1);
    newQuestions.splice(dropIndex, 0, movedQuestion);
    setLocalQuestions(newQuestions);

    // Update order in database
    const questionIds = newQuestions.map(q => q.id);
    try {
      await updateOrder.mutateAsync(questionIds);
    } catch (error) {
      console.error('Failed to update question order:', error);
      // Revert on error
      setLocalQuestions(questions);
      alert('질문 순서 변경에 실패했습니다.');
    }
    
    setIsDragging(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#4A2C1A] mb-2">질문 관리</h2>
        <p className="text-sm text-gray-600">사용자에게 제공될 질문들을 관리합니다.</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          전체 {questions.length}개
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-black text-white hover:bg-gray-800"
        >
          <Plus className="w-4 h-4 mr-2" />
          등록하기
        </Button>
      </div>

      {/* Questions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 w-20">
                순서
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                질문내용
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 w-32">
                생성일
              </th>
              <th className="px-6 py-4 text-center text-sm font-medium text-gray-700 w-24">
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedQuestions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  등록된 질문이 없습니다.
                </td>
              </tr>
            ) : (
              sortedQuestions.map((question, index) => (
                <tr
                  key={question.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    draggedIndex === index ? 'opacity-50' : ''
                  } ${dragOverIndex === index ? 'bg-blue-50' : ''} ${
                    isDragging ? 'cursor-move' : ''
                  }`}
                  onMouseMove={(e) => {
                    if (isDragging) {
                      handleDragOver(e, index);
                    }
                  }}
                  onMouseUp={(e) => {
                    if (isDragging) {
                      handleDrop(e, index);
                    }
                    handleMouseUp();
                  }}
                  onMouseLeave={handleMouseLeave}
                >
                  <td className="px-6 py-4">
                    <div
                      className={`flex items-center justify-center ${
                        isDragging ? 'cursor-move' : 'cursor-grab'
                      }`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleMouseDown(index);
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        if (isDragging) {
                          handleDrop(e, index);
                        }
                        handleMouseUp();
                      }}
                    >
                      <GripVertical className={`w-5 h-5 ${
                        isDragging && draggedIndex === index
                          ? 'text-[#4A2C1A]'
                          : 'text-gray-400'
                      }`} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{question.question}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {format(new Date(question.createdAt), 'yy.MM.dd', { locale: ko })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(question);
                        }}
                        className="p-1.5 text-gray-600 hover:text-[#4A2C1A] transition-colors"
                        disabled={isDragging || (editingId !== null && editingId !== question.id)}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(question.id);
                        }}
                        className="p-1.5 text-gray-600 hover:text-red-600 transition-colors"
                        disabled={isDragging || deleteQuestion.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <QuestionEditModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        mode="create"
        isLoading={createQuestion.isPending}
      />

      {/* Edit Modal */}
      {editingId && (
        <QuestionEditModal
          isOpen={!!editingId}
          onClose={() => setEditingId(null)}
          onSave={handleSaveEdit}
          initialQuestion={sortedQuestions.find(q => q.id === editingId)?.question || ''}
          mode="edit"
          isLoading={updateQuestion.isPending}
        />
      )}

      {/* Delete Modal */}
      {deletingId && (
        <QuestionDeleteModal
          isOpen={!!deletingId}
          onClose={() => setDeletingId(null)}
          onConfirm={handleDelete}
          question={sortedQuestions.find(q => q.id === deletingId)?.question || ''}
          isLoading={deleteQuestion.isPending}
        />
      )}
    </div>
  );
}
