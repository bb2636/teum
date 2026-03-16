import { useState } from 'react';
import { useMe } from '@/hooks/useProfile';
import { useQuestions, useCreateQuestion, useUpdateQuestion, useDeleteQuestion } from '@/hooks/useQuestions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Edit2, Plus, Check, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export function AdminPage() {
  const { data: user, isLoading: userLoading } = useMe();
  const { data: questions = [], isLoading: questionsLoading } = useQuestions();
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Check if user is admin
  if (userLoading) {
    return <div className="p-6">로딩 중...</div>;
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/home" replace />;
  }

  const handleCreate = async () => {
    if (!newQuestion.trim()) return;
    
    await createQuestion.mutateAsync({
      question: newQuestion.trim(),
      isActive,
    });
    setNewQuestion('');
    setIsActive(true);
  };

  const handleStartEdit = (question: { id: string; question: string; isActive: boolean }) => {
    setEditingId(question.id);
    setEditText(question.question);
    setIsActive(question.isActive);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return;
    
    await updateQuestion.mutateAsync({
      id,
      question: editText.trim(),
      isActive,
    });
    setEditingId(null);
    setEditText('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 질문을 삭제하시겠습니까?')) return;
    await deleteQuestion.mutateAsync(id);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-brown-900">관리자 페이지</h1>
        <p className="text-muted-foreground mt-2">질문 관리</p>
      </div>

      {/* Create New Question */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>새 질문 추가</CardTitle>
          <CardDescription>사용자에게 제공할 질문을 추가하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-question">질문 내용</Label>
            <Input
              id="new-question"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="예: 오늘 하루는 어땠나요?"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="new-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="new-active" className="cursor-pointer">
              활성화
            </Label>
          </div>
          <Button
            onClick={handleCreate}
            disabled={!newQuestion.trim() || createQuestion.isPending}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            질문 추가
          </Button>
        </CardContent>
      </Card>

      {/* Questions List */}
      <Card>
        <CardHeader>
          <CardTitle>질문 목록</CardTitle>
          <CardDescription>
            총 {questions.length}개의 질문이 등록되어 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {questionsLoading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              등록된 질문이 없습니다
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  {editingId === question.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="mb-2"
                      />
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <Label className="text-sm">활성화</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(question.id)}
                          disabled={!editText.trim() || updateQuestion.isPending}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          저장
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-4 h-4 mr-1" />
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="font-medium">{question.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              question.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {question.isActive ? '활성' : '비활성'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            생성일: {new Date(question.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(question)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(question.id)}
                          disabled={deleteQuestion.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
