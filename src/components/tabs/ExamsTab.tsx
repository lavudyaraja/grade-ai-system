'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Trash2, BookOpen, FileQuestion, Users, Search,
  Copy, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Eye,
  Loader2, Filter, SortAsc,
} from 'lucide-react';
import type { Exam, QuestionFormData } from '@/lib/types';
import ExamDialog from '../dialogs/ExamDialog';

interface ExamsTabProps {
  teacherId: string;
  onExamCreated?: () => void;
}

type SortKey = 'title' | 'createdAt' | 'totalMarks';
type StatusFilter = 'all' | 'draft' | 'active' | 'graded' | 'archived';

const STATUS_CONFIG: Record<string, { dot: string; text: string; badge: string }> = {
  draft:    { dot: 'bg-slate-500',  text: 'text-slate-400',  badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  active:   { dot: 'bg-emerald-400',text: 'text-emerald-400',badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  graded:   { dot: 'bg-blue-400',   text: 'text-blue-400',   badge: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  archived: { dot: 'bg-orange-400', text: 'text-orange-400', badge: 'bg-orange-400/10 text-orange-400 border-orange-400/20' },
};

const EMPTY_QUESTION = (): QuestionFormData => ({
  questionNumber: 1,
  questionText: '',
  modelAnswer: '',
  maxMarks: 10,
  keywords: [],
  gradingNotes: '',
});

export default function ExamsTab({ teacherId, onExamCreated }: ExamsTabProps) {
  const [exams, setExams]                     = useState<Exam[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [submitting, setSubmitting]           = useState(false);

  // ── UI state ────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]           = useState(false);
  const [editOpen, setEditOpen]               = useState(false);
  const [deleteOpen, setDeleteOpen]           = useState(false);
  const [previewOpen, setPreviewOpen]         = useState(false);
  const [selectedExam, setSelectedExam]       = useState<Exam | null>(null);

  // ── Filter / sort ────────────────────────────────────────────────
  const [search, setSearch]                   = useState('');
  const [statusFilter, setStatusFilter]       = useState<StatusFilter>('all');
  const [sortKey, setSortKey]                 = useState<SortKey>('createdAt');
  const [expandedQuestions, setExpandedQ]     = useState<Record<string, boolean>>({});

  // ── Form state ───────────────────────────────────────────────────
  const [title, setTitle]                     = useState('');
  const [subject, setSubject]                 = useState('');
  const [description, setDescription]         = useState('');
  const [status, setStatus]                   = useState<'draft'|'active'>('draft');
  const [questions, setQuestions]             = useState<QuestionFormData[]>([EMPTY_QUESTION()]);

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchExams = async () => {
    try {
      const res = await fetch('/api/exams');
      if (res.ok) setExams(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchExams(); }, []);

  // ── Derived list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = exams.filter(e => {
      const q = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q)
      );
    });
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    list = [...list].sort((a, b) => {
      if (sortKey === 'title')      return a.title.localeCompare(b.title);
      if (sortKey === 'totalMarks') return b.totalMarks - a.totalMarks;
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
    return list;
  }, [exams, search, statusFilter, sortKey]);

  // ── Helpers ───────────────────────────────────────────────────────
  const resetForm = () => {
    setTitle(''); setSubject(''); setDescription(''); setStatus('draft');
    setQuestions([EMPTY_QUESTION()]);
  };

  const loadExamIntoForm = (exam: Exam) => {
    setTitle(exam.title);
    setSubject(exam.subject);
    setDescription(exam.description ?? '');
    setStatus(exam.status === 'active' ? 'active' : 'draft');
    setQuestions(
      exam.questions.map(q => ({
        questionNumber: q.questionNumber,
        questionText:   q.questionText,
        modelAnswer:    q.modelAnswer,
        maxMarks:       q.maxMarks,
        keywords:       q.keywords ? JSON.parse(q.keywords) : [],
        gradingNotes:   q.gradingNotes ?? '',
      }))
    );
  };

  const totalMarks = questions.reduce((s, q) => s + (q.maxMarks || 0), 0);

  const addQuestion = () =>
    setQuestions(prev => [
      ...prev,
      { ...EMPTY_QUESTION(), questionNumber: prev.length + 1 },
    ]);

  const removeQuestion = (i: number) => {
    if (questions.length <= 1) return;
    setQuestions(prev =>
      prev.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, questionNumber: idx + 1 }))
    );
  };

  const updateQ = (i: number, field: keyof QuestionFormData, val: unknown) =>
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: val } : q));

  // ── API calls ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim() || !subject.trim()) return alert('Title and subject are required.');
    setSubmitting(true);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, subject, description, teacherId, status,
          questions: questions.filter(q => q.questionText && q.modelAnswer),
        }),
      });
      if (res.ok) {
        await fetchExams(); setCreateOpen(false); resetForm(); onExamCreated?.();
      } else { alert((await res.json()).error ?? 'Failed to create exam'); }
    } finally { setSubmitting(false); }
  };

  const handleUpdate = async () => {
    if (!selectedExam || !title.trim() || !subject.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exams/${selectedExam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, subject, description, status,
          questions: questions.filter(q => q.questionText && q.modelAnswer),
        }),
      });
      if (res.ok) { await fetchExams(); setEditOpen(false); setSelectedExam(null); resetForm(); }
      else alert((await res.json()).error ?? 'Failed to update');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!selectedExam) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exams/${selectedExam.id}`, { method: 'DELETE' });
      if (res.ok) { await fetchExams(); setDeleteOpen(false); setSelectedExam(null); }
      else alert((await res.json()).error ?? 'Failed to delete');
    } finally { setSubmitting(false); }
  };

  const handleDuplicate = async (exam: Exam) => {
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       `${exam.title} (Copy)`,
          subject:     exam.subject,
          description: exam.description,
          teacherId,
          status:      'draft',
          questions:   exam.questions.map(q => ({
            questionNumber: q.questionNumber,
            questionText:   q.questionText,
            modelAnswer:    q.modelAnswer,
            maxMarks:       q.maxMarks,
            keywords:       q.keywords ? JSON.parse(q.keywords) : [],
            gradingNotes:   q.gradingNotes ?? '',
          })),
        }),
      });
      if (res.ok) { await fetchExams(); onExamCreated?.(); }
    } catch (e) { console.error(e); }
  };

  const handleToggleStatus = async (exam: Exam) => {
    const next = exam.status === 'active' ? 'draft' : 'active';
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) await fetchExams();
    } catch (e) { console.error(e); }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Exams</h2>
          <p className="text-sm text-gray-600 mt-0.5">Create and manage exam papers with model answers</p>
        </div>
        <Button
          onClick={() => { resetForm(); setCreateOpen(true); }}
          className="bg-amber-400 hover:bg-amber-300 text-black font-semibold text-sm h-9 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Exam
        </Button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exams…"
            className="pl-8 h-9 bg-white border-gray-300 text-gray-800 text-sm focus:border-amber-400/40 placeholder:text-gray-400"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
          <SelectTrigger className="h-9 w-36 bg-white border-gray-300 text-gray-700 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200">
            {['all','draft','active','graded','archived'].map(s => (
              <SelectItem key={s} value={s} className="text-gray-700 capitalize">{s === 'all' ? 'All Status' : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v: SortKey) => setSortKey(v)}>
          <SelectTrigger className="h-9 w-36 bg-white border-gray-300 text-gray-700 text-sm">
            <SortAsc className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200">
            <SelectItem value="createdAt" className="text-gray-700">Newest</SelectItem>
            <SelectItem value="title" className="text-gray-700">A → Z</SelectItem>
            <SelectItem value="totalMarks" className="text-gray-700">Most marks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-[11px] text-gray-500 font-mono">
          {filtered.length} exam{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-5 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-gray-600">
              {search || statusFilter !== 'all' ? 'No exams match your filters' : 'No exams yet'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {search || statusFilter !== 'all'
                ? 'Try adjusting search or filters'
                : 'Create your first exam to get started'}
            </p>
          </div>
          {!search && statusFilter === 'all' && (
            <Button
              onClick={() => { resetForm(); setCreateOpen(true); }}
              className="bg-amber-400 hover:bg-amber-300 text-black font-semibold text-sm h-9 mt-1"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Create First Exam
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(exam => {
            const cfg = STATUS_CONFIG[exam.status] ?? STATUS_CONFIG.draft;
            return (
              <div
                key={exam.id}
                className="group rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 flex flex-col overflow-hidden"
              >
                {/* Card header */}
                <div className="p-4 pb-3 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{exam.title}</h3>
                      <p className="text-xs text-gray-600 truncate">{exam.subject}</p>
                    </div>
                    <Badge className={`text-[10px] flex-shrink-0 border ${cfg.badge} capitalize gap-1`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {exam.status}
                    </Badge>
                  </div>

                  {exam.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 mb-3">{exam.description}</p>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileQuestion className="h-3 w-3" />
                      {exam.questions?.length ?? 0}
                      <span className="text-gray-600">q</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {exam._count?.submissions ?? 0}
                      <span className="text-gray-600">sub</span>
                    </span>
                    <span className="ml-auto font-mono text-amber-600 text-[11px]">
                      {exam.totalMarks}m
                    </span>
                  </div>
                </div>

                {/* Question keyword pills */}
                {exam.questions?.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1">
                    {exam.questions.slice(0, 3).map((q, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-600 truncate max-w-[120px]"
                      >
                        Q{q.questionNumber}: {q.questionText.substring(0, 20)}{q.questionText.length > 20 ? '…' : ''}
                      </span>
                    ))}
                    {exam.questions.length > 3 && (
                      <span className="text-[10px] text-gray-500">+{exam.questions.length - 3} more</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-gray-200 px-3 py-2 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedExam(exam); setPreviewOpen(true); }}
                    className="h-7 px-2 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1"
                  >
                    <Eye className="h-3 w-3" /> Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedExam(exam); loadExamIntoForm(exam); setEditOpen(true); }}
                    className="h-7 px-2 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(exam)}
                    className="h-7 px-2 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(exam)}
                    className={`h-7 px-2 text-[11px] gap-1 ml-auto ${
                      exam.status === 'active'
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {exam.status === 'active'
                      ? <><ToggleRight className="h-3 w-3" /> Active</>
                      : <><ToggleLeft className="h-3 w-3" /> Activate</>
                    }
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedExam(exam); setDeleteOpen(true); }}
                    className="h-7 w-7 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Exam Dialogs ──────────────────────────────────────────── */}
      <ExamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        submitting={submitting}
        onCreate={handleCreate}
        initialData={{
          title,
          subject,
          description,
          status,
          questions,
        }}
      />

      <ExamDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        exam={selectedExam}
        submitting={submitting}
        onUpdate={handleUpdate}
        initialData={{
          title,
          subject,
          description,
          status,
          questions,
        }}
      />

      <ExamDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        mode="preview"
        exam={selectedExam}
      />

      {/* ── Delete Alert ───────────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-[#0f1016] border-white/[0.08] text-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete exam?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This permanently deletes <strong className="text-slate-200">"{selectedExam?.title}"</strong> and
              all associated submissions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="border-white/[0.08] text-slate-300 hover:bg-white/[0.06]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {submitting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}