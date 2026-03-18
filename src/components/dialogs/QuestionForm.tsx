import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { QuestionFormData } from '@/lib/types';

interface QuestionFormProps {
  questions?: QuestionFormData[];
  onQuestionsChange?: (questions: QuestionFormData[]) => void;
}

export function QuestionForm({
  questions = [],
  onQuestionsChange,
}: QuestionFormProps) {
  const addQuestion = () => {
    const newQuestion: QuestionFormData = {
      questionNumber: (questions.length + 1),
      questionText: '',
      modelAnswer: '',
      maxMarks: 5,
      keywords: [],
    };
    onQuestionsChange?.([...questions, newQuestion]);
  };

  const removeQuestion = (index: number) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    // Renumber remaining questions
    const renumberedQuestions = updatedQuestions.map((q, i) => ({
      ...q,
      questionNumber: i + 1,
    }));
    onQuestionsChange?.(renumberedQuestions);
  };

  const updateQuestion = (index: number, field: keyof QuestionFormData, value: unknown) => {
    const updatedQuestions = questions.map((q, i) => 
      i === index ? { ...q, [field]: value } : q
    );
    onQuestionsChange?.(updatedQuestions);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < questions.length) {
      [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
      
      // Renumber questions
      const renumberedQuestions = newQuestions.map((q, i) => ({
        ...q,
        questionNumber: i + 1,
      }));
      
      onQuestionsChange?.(renumberedQuestions);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">
          Questions ({questions.length})
        </span>
        <Button
          type="button"
          onClick={addQuestion}
          size="sm"
          className="text-xs bg-amber-400 hover:bg-amber-300 text-black font-medium"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Question
        </Button>
      </div>

      {questions.map((q, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded">
                Q{q.questionNumber}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveQuestion(i, 'up')}
                  disabled={i === 0}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveQuestion(i, 'down')}
                  disabled={i === questions.length - 1}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {questions.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeQuestion(i)}
                className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Question</Label>
              <Textarea
                value={q.questionText}
                onChange={(e) => updateQuestion(i, 'questionText', e.target.value)}
                placeholder="Enter your question here..."
                className="text-sm resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Model Answer</Label>
              <Textarea
                value={q.modelAnswer}
                onChange={(e) => updateQuestion(i, 'modelAnswer', e.target.value)}
                placeholder="Provide the model answer..."
                className="text-sm resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Max Marks</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={q.maxMarks}
                  onChange={(e) => updateQuestion(i, 'maxMarks', parseInt(e.target.value) || 1)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Keywords (comma-separated)</Label>
                <Input
                  value={Array.isArray(q.keywords) ? q.keywords.join(', ') : q.keywords}
                  onChange={(e) => updateQuestion(i, 'keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                  placeholder="keyword1, keyword2, ..."
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
