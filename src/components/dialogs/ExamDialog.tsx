import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ExamMetaFields } from './ExamMetaFields';
import { QuestionForm } from './QuestionForm';
import type { QuestionFormData } from '@/lib/types';

interface ExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit' | 'preview';
  exam?: any;
  submitting?: boolean;
  onCreate?: () => void;
  onUpdate?: () => void;
  initialData?: {
    title?: string;
    subject?: string;
    description?: string;
    status?: 'draft' | 'active';
    questions?: QuestionFormData[];
  };
}

export default function ExamDialog({
  open,
  onOpenChange,
  mode,
  exam,
  submitting = false,
  onCreate,
  onUpdate,
  initialData,
}: ExamDialogProps) {
  // Use initialData for create/edit modes, fallback to exam data for edit mode
  const [title, setTitle] = useState(initialData?.title || exam?.title || '');
  const [subject, setSubject] = useState(initialData?.subject || exam?.subject || '');
  const [description, setDescription] = useState(initialData?.description || exam?.description || '');
  const [status, setStatus] = useState<'draft' | 'active'>(initialData?.status || exam?.status || 'draft');
  const [questions, setQuestions] = useState<QuestionFormData[]>(
    initialData?.questions || exam?.questions || [{
      questionNumber: 1,
      questionText: '',
      modelAnswer: '',
      maxMarks: 5,
      keywords: [],
    }]
  );

  // Sync state when initialData changes (important for create/edit modes)
  React.useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setSubject(initialData.subject || '');
      setDescription(initialData.description || '');
      setStatus(initialData.status || 'draft');
      setQuestions(initialData.questions || [{
        questionNumber: 1,
        questionText: '',
        modelAnswer: '',
        maxMarks: 5,
        keywords: [],
      }]);
    }
  }, [initialData]);

  const titleText = mode === 'create' ? 'Create New Exam' : mode === 'edit' ? 'Edit Exam' : exam?.title || 'Exam Preview';
  const descriptionText = mode === 'create' 
    ? 'Fill in exam details and add questions with model answers.'
    : mode === 'edit' 
    ? 'Update exam details and questions.'
    : exam?.subject || '';

  const handleSubmit = () => {
    // For create and edit modes, we need to pass the current state back to parent
    if (mode === 'create' && onCreate) {
      // Pass current state to parent before calling onCreate
      (onCreate as any)({ title, subject, description, status, questions });
    } else if (mode === 'edit' && onUpdate) {
      (onUpdate as any)({ title, subject, description, status, questions });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 bg-white border-gray-200 text-gray-800">
        <DialogHeader className="p-5 pb-4 border-b border-gray-200">
          <DialogTitle className="text-gray-900">{titleText}</DialogTitle>
          <DialogDescription className="text-gray-600 text-sm">
            {descriptionText}
          </DialogDescription>
        </DialogHeader>
        
        {mode === 'preview' ? (
          <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: '70vh' }}>
            {exam?.description && (
              <p className="text-sm text-gray-600 border border-gray-200 rounded-lg p-3 bg-gray-50">
                {exam.description}
              </p>
            )}
            {exam?.questions.map((q: any, i: number) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded">
                    Q{q.questionNumber}
                  </span>
                  <span className="text-xs text-amber-600 font-mono">{q.maxMarks} marks</span>
                </div>
                <p className="text-sm font-medium text-gray-800">{q.questionText}</p>
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Model Answer</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{q.modelAnswer}</p>
                </div>
                {q.keywords && (() => {
                  const keywordsArray = typeof q.keywords === 'string' ? JSON.parse(q.keywords) : q.keywords;
                  return keywordsArray.length > 0;
                })() && (
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {(typeof q.keywords === 'string' ? JSON.parse(q.keywords) : q.keywords).map((kw: string, idx: number) => (
                        <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-y-auto p-5 space-y-5" style={{ maxHeight: '65vh' }}>
            <ExamMetaFields
              title={title}
              subject={subject}
              description={description}
              status={status}
              onTitleChange={setTitle}
              onSubjectChange={setSubject}
              onDescriptionChange={setDescription}
              onStatusChange={setStatus}
            />
            <QuestionForm
              questions={questions}
              onQuestionsChange={setQuestions}
            />
          </div>
        )}

        {mode !== 'preview' && (
          <DialogFooter className="p-4 border-t border-gray-200 bg-gray-50">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-amber-400 hover:bg-amber-300 text-black font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {mode === 'create' ? 'Creating…' : 'Saving…'}
                </>
              ) : (
                mode === 'create' ? 'Create Exam' : 'Save Changes'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
