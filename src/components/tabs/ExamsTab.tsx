'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  FileQuestion,
  Users,
  MoreVertical,
} from 'lucide-react';
import type { Exam, QuestionFormData } from '@/lib/types';

interface ExamsTabProps {
  teacherId: string;
  onExamCreated?: () => void;
}

export default function ExamsTab({ teacherId, onExamCreated }: ExamsTabProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionFormData[]>([
    { questionNumber: 1, questionText: '', modelAnswer: '', maxMarks: 10, keywords: [], gradingNotes: '' }
  ]);

  const fetchExams = async () => {
    try {
      const response = await fetch('/api/exams');
      if (response.ok) {
        const data = await response.json();
        setExams(data);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const resetForm = () => {
    setTitle('');
    setSubject('');
    setDescription('');
    setQuestions([
      { questionNumber: 1, questionText: '', modelAnswer: '', maxMarks: 10, keywords: [], gradingNotes: '' }
    ]);
  };

  const handleCreateExam = async () => {
    if (!title || !subject) {
      alert('Please fill in title and subject');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject,
          description,
          teacherId,
          questions: questions.filter(q => q.questionText && q.modelAnswer),
        }),
      });

      if (response.ok) {
        await fetchExams();
        setIsCreateOpen(false);
        resetForm();
        onExamCreated?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create exam');
      }
    } catch (error) {
      console.error('Error creating exam:', error);
      alert('Failed to create exam');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateExam = async () => {
    if (!selectedExam || !title || !subject) {
      alert('Please fill in title and subject');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/exams/${selectedExam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject,
          description,
          questions: questions.filter(q => q.questionText && q.modelAnswer),
        }),
      });

      if (response.ok) {
        await fetchExams();
        setIsEditOpen(false);
        setSelectedExam(null);
        resetForm();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update exam');
      }
    } catch (error) {
      console.error('Error updating exam:', error);
      alert('Failed to update exam');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!selectedExam) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/exams/${selectedExam.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchExams();
        setIsDeleteOpen(false);
        setSelectedExam(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete exam');
      }
    } catch (error) {
      console.error('Error deleting exam:', error);
      alert('Failed to delete exam');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setTitle(exam.title);
    setSubject(exam.subject);
    setDescription(exam.description || '');
    setQuestions(exam.questions.map(q => ({
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      modelAnswer: q.modelAnswer,
      maxMarks: q.maxMarks,
      keywords: q.keywords ? JSON.parse(q.keywords) : [],
      gradingNotes: q.gradingNotes || '',
    })));
    setIsEditOpen(true);
  };

  const openDeleteDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setIsDeleteOpen(true);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        questionNumber: questions.length + 1,
        questionText: '',
        modelAnswer: '',
        maxMarks: 10,
        keywords: [],
        gradingNotes: '',
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, field: keyof QuestionFormData, value: unknown) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'graded':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const totalMarks = questions.reduce((sum, q) => sum + q.maxMarks, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Exams</h2>
          <p className="text-muted-foreground">
            Create and manage exams with questions and model answers
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Exam
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl grid-rows-[auto_1fr_auto] max-h-[90vh] p-0 gap-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>Create New Exam</DialogTitle>
              <DialogDescription>
                Add exam details and questions with model answers for grading
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 py-4 max-h-[60vh]">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Exam Title *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Midterm Exam 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Mathematics"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description of the exam..."
                    rows={2}
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Questions (Total: {totalMarks} marks)</Label>
                    <Button variant="outline" size="sm" onClick={addQuestion}>
                      <Plus className="mr-1 h-3 w-3" />
                      Add Question
                    </Button>
                  </div>
                  {questions.map((q, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Question {q.questionNumber}</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuestion(index)}
                            disabled={questions.length === 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label>Question Text *</Label>
                          <Textarea
                            value={q.questionText}
                            onChange={(e) => updateQuestion(index, 'questionText', e.target.value)}
                            placeholder="Enter the question..."
                            rows={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Model Answer *</Label>
                          <Textarea
                            value={q.modelAnswer}
                            onChange={(e) => updateQuestion(index, 'modelAnswer', e.target.value)}
                            placeholder="Enter the expected answer for grading..."
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Max Marks</Label>
                            <Input
                              type="number"
                              value={q.maxMarks}
                              onChange={(e) => updateQuestion(index, 'maxMarks', parseFloat(e.target.value) || 0)}
                              min={0}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Keywords (comma-separated)</Label>
                            <Input
                              value={q.keywords?.join(', ') || ''}
                              onChange={(e) => updateQuestion(index, 'keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                              placeholder="keyword1, keyword2"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t bg-background">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateExam} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Exam'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : exams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No exams yet</p>
            <p className="text-muted-foreground text-sm mb-4">
              Create your first exam to start grading handwritten submissions
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Exam
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <Card key={exam.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{exam.title}</CardTitle>
                    <CardDescription>{exam.subject}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    <span className={`mr-1.5 h-2 w-2 rounded-full ${getStatusColor(exam.status)}`} />
                    {exam.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {exam.description || 'No description provided'}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <FileQuestion className="h-4 w-4" />
                    <span>{exam.questions?.length || 0} questions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{exam._count?.submissions || 0} submissions</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Total Marks: {exam.totalMarks}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(exam)}
                    className="flex-1"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(exam)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl grid-rows-[auto_1fr_auto] max-h-[90vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Edit Exam</DialogTitle>
            <DialogDescription>
              Update exam details and questions
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 max-h-[60vh]">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Exam Title *</Label>
                  <Input
                    id="edit-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-subject">Subject *</Label>
                  <Input
                    id="edit-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Questions (Total: {totalMarks} marks)</Label>
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Question
                  </Button>
                </div>
                {questions.map((q, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Question {q.questionNumber}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuestion(index)}
                          disabled={questions.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>Question Text *</Label>
                        <Textarea
                          value={q.questionText}
                          onChange={(e) => updateQuestion(index, 'questionText', e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Model Answer *</Label>
                        <Textarea
                          value={q.modelAnswer}
                          onChange={(e) => updateQuestion(index, 'modelAnswer', e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Max Marks</Label>
                          <Input
                            type="number"
                            value={q.maxMarks}
                            onChange={(e) => updateQuestion(index, 'maxMarks', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Keywords</Label>
                          <Input
                            value={q.keywords?.join(', ') || ''}
                            onChange={(e) => updateQuestion(index, 'keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t bg-background">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateExam} disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Exam'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedExam?.title}"? This will also delete all
              submissions and answers associated with this exam. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExam}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
