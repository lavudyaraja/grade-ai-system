'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Upload, FileImage, X, CheckCircle, AlertCircle, Loader2,
  Camera, FileText, Eye, RefreshCw, Zap, BookOpen,
  ChevronDown, ChevronUp, Image as ImgIcon,
} from 'lucide-react';
import type { Exam } from '@/lib/types';
import type { PageExtraction } from '@/app/api/ocr/route';
import PDFPreview from '@/components/PDFPreview';
import FullScreenTextDialog from '@/components/FullScreenTextDialog';
import PageWiseViewer from '@/components/PageWiseViewer';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadTabProps {
  teacherId: string;
  onSubmissionCreated?: () => void;
}

interface FileEntry {
  questionNumber: number;
  questionId:     string;
  questionText:   string;
  answerId:       string | null;
  file:           File | null;
  previewUrl:     string | null;
  uploaded:       boolean;
  filePath:       string | null;
  pages:          PageExtraction[];
  flatText:       string;
  confidence:     'high' | 'medium' | 'low' | null;
  ocrLoading:     boolean;
  error:          string | null;
  collapsed:      boolean;
}

interface AnswerFromServer {
  id:         string;
  questionId: string;
}

// ── Confidence pill ───────────────────────────────────────────────────────────
function ConfPill({ c }: { c: 'high' | 'medium' | 'low' | null }) {
  if (!c) return null;
  const map = {
    high:   'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    medium: 'bg-amber-400/10 text-amberald-400 border-amber-400/20',
    low:    'bg-red-400/10 text-red-400 border-red-400/20',
  };
  return (
    <span className={`text-[10px] font-mono border px-1.5 py-0.5 rounded ${map[c]}`}>
      {c.charAt(0).toUpperCase() + c.slice(1)} OCR
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UploadTab({ teacherId, onSubmissionCreated }: UploadTabProps) {
  const [exams, setExams]                   = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExam, setSelectedExam]     = useState<Exam | null>(null);
  const [studentName, setStudentName]       = useState('');
  const [studentId, setStudentId]           = useState('');
  const [uploading, setUploading]           = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [fileEntries, setFileEntries]       = useState<FileEntry[]>([]);
  const [submissionId, setSubmissionId]     = useState<string | null>(null);
  const [previewDialog, setPreviewDialog]   = useState<{
    open: boolean;
    questionNumber: number;
    pages: PageExtraction[];
    metadata?: { fileName?: string; fileSize?: string };
  }>({ open: false, questionNumber: 0, pages: [] });

  const submissionIdRef = useRef<string | null>(null);
  const fileEntriesRef  = useRef<FileEntry[]>([]);
  const fileInputRefs   = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => { fileEntriesRef.current = fileEntries; },  [fileEntries]);
  useEffect(() => { submissionIdRef.current = submissionId; }, [submissionId]);

  // ── Load exams ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/exams')
      .then(r => r.ok ? r.json() : [])
      .then(setExams)
      .catch(console.error);
  }, []);

  // ── Exam selection ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedExamId) {
      const exam = exams.find(e => e.id === selectedExamId) ?? null;
      setSelectedExam(exam);
      if (exam) {
        setFileEntries(exam.questions.map(q => ({
          questionNumber: q.questionNumber,
          questionId:     q.id,
          questionText:   q.questionText,
          answerId:       null,
          file:           null,
          previewUrl:     null,
          uploaded:       false,
          filePath:       null,
          pages:          [],
          flatText:       '',
          confidence:     null,
          ocrLoading:     false,
          error:          null,
          collapsed:      false,
        })));
      }
      setSubmissionId(null);
      submissionIdRef.current = null;
    } else {
      setSelectedExam(null);
      setFileEntries([]);
    }
    setStudentName('');
    setStudentId('');
  }, [selectedExamId, exams]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const updateEntry = useCallback(
    (questionNumber: number, patch: Partial<FileEntry>) =>
      setFileEntries(prev =>
        prev.map(f => f.questionNumber === questionNumber ? { ...f, ...patch } : f)
      ),
    []
  );

  // ── Upload ─────────────────────────────────────────────────────────────────
  const uploadFile = async (qNum: number, file: File, subId: string): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('submissionId', subId);
    fd.append('questionNumber', String(qNum));
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) return null;
      return (await res.json()).filePath ?? null;
    } catch { return null; }
  };

  // ── OCR ────────────────────────────────────────────────────────────────────
  const runOCR = async (filePath: string, questionText: string) => {
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, questionText }),
      });
      if (!res.ok) return { pages: [] as PageExtraction[], flatText: '', confidence: 'low' as const };
      const d = await res.json();
      return {
        pages:      d.pages     ?? [] as PageExtraction[],
        flatText:   d.text      ?? '',
        confidence: d.confidence ?? 'low' as 'high' | 'medium' | 'low',
      };
    } catch {
      return { pages: [] as PageExtraction[], flatText: '', confidence: 'low' as const };
    }
  };

  // ── Patch answer ───────────────────────────────────────────────────────────
  const patchAnswer = async (id: string, imgPath: string, text: string, conf: string) => {
    try {
      await fetch(`/api/answers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handwrittenImagePath: imgPath, recognizedText: text, confidenceLevel: conf }),
      });
    } catch { /* non-critical */ }
  };

  // ── File select ────────────────────────────────────────────────────────────
  const handleFileSelect = async (qNum: number, file: File) => {
    const ALLOWED = ['image/jpeg','image/png','image/webp','image/tiff','application/pdf'];
    if (!ALLOWED.includes(file.type)) {
      updateEntry(qNum, { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, TIFF, PDF' });
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    updateEntry(qNum, {
      file, previewUrl, uploaded: false, filePath: null,
      pages: [], flatText: '', confidence: null, ocrLoading: false, error: null, collapsed: false,
    });

    const subId = submissionIdRef.current;
    if (!subId) return;

    setUploading(true);
    try {
      const filePath = await uploadFile(qNum, file, subId);
      if (!filePath) { updateEntry(qNum, { error: 'Upload failed — please try again.' }); return; }
      updateEntry(qNum, { uploaded: true, filePath });
      updateEntry(qNum, { ocrLoading: true });
      const entry = fileEntriesRef.current.find(f => f.questionNumber === qNum);
      const { pages, flatText, confidence } = await runOCR(filePath, entry?.questionText ?? '');
      updateEntry(qNum, { pages, flatText, confidence, ocrLoading: false });
      const latest = fileEntriesRef.current.find(f => f.questionNumber === qNum);
      if (latest?.answerId) await patchAnswer(latest.answerId, filePath, flatText, confidence);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (qNum: number, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(qNum, file);
  };

  const removeFile = (qNum: number) => {
    const entry = fileEntriesRef.current.find(f => f.questionNumber === qNum);
    if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    updateEntry(qNum, {
      file: null, previewUrl: null, uploaded: false, filePath: null,
      pages: [], flatText: '', confidence: null, ocrLoading: false, error: null,
    });
  };

  const retryOCR = async (qNum: number) => {
    const entry = fileEntriesRef.current.find(f => f.questionNumber === qNum);
    if (!entry?.filePath) return;
    updateEntry(qNum, { ocrLoading: true, error: null });
    const { pages, flatText, confidence } = await runOCR(entry.filePath, entry.questionText);
    updateEntry(qNum, { pages, flatText, confidence, ocrLoading: false });
    if (entry.answerId) await patchAnswer(entry.answerId, entry.filePath, flatText, confidence);
  };

  // ── Create submission ──────────────────────────────────────────────────────
  const handleCreateSubmission = async () => {
    if (!selectedExam || !studentName.trim()) {
      alert('Please select an exam and enter the student name.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId:      selectedExam.id,
          studentName: studentName.trim(),
          studentId:   studentId.trim() || undefined,
        }),
      });
      if (!res.ok) { alert((await res.json()).error ?? 'Failed'); return; }
      const sub = await res.json();
      setSubmissionId(sub.id);
      submissionIdRef.current = sub.id;
      if (sub.answers?.length) {
        setFileEntries(prev => prev.map(f => {
          const ans = (sub.answers as AnswerFromServer[]).find(a => a.questionId === f.questionId);
          return ans ? { ...f, answerId: ans.id } : f;
        }));
      }
      onSubmissionCreated?.();
    } catch {
      alert('Failed to create submission');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Start grading ──────────────────────────────────────────────────────────
  const handleStartGrading = async () => {
    if (!submissionId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId }),
      });
      if (res.ok) {
        setSelectedExamId('');
        setStudentName('');
        setStudentId('');
        setSubmissionId(null);
        submissionIdRef.current = null;
        setFileEntries([]);
        alert('Grading completed! Check the Results tab.');
        onSubmissionCreated?.();
      } else {
        alert((await res.json()).error ?? 'Grading failed');
      }
    } catch {
      alert('Grading failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const uploadedEntries = fileEntries.filter(f => f.file && f.uploaded);
  const ocrDoneEntries  = uploadedEntries.filter(f => f.flatText);
  const anyOcrLoading   = fileEntries.some(f => f.ocrLoading);
  const canGrade        = !!submissionId && uploadedEntries.length > 0 && !submitting && !uploading;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="space-y-5"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Upload Answers</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          Select an exam, enter student details, then upload handwritten answer images or PDFs.
        </p>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* ── LEFT: Submission panel ────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-3 min-h-[800px]">

          {/* Submission details card */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-gray-300">
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-700">Submission Details</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Exam selection & student info</p>
            </div>

            <div className="p-4 space-y-3">
              {/* Exam selector */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono text-gray-500 uppercase tracking-wide">
                  Exam *
                </Label>
                <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={!!submissionId}>
                  <SelectTrigger className="h-9 bg-white border-gray-300 text-gray-700 text-sm focus:border-amber-400/40">
                    <SelectValue placeholder="Choose an exam…" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    {exams.map(exam => (
                      <SelectItem key={exam.id} value={exam.id} className="text-gray-700 text-sm">
                        {exam.title} — {exam.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student Name */}
              <div className="space-y-1.5">
                <Label htmlFor="sName" className="text-[10px] font-mono text-gray-500 uppercase tracking-wide">
                  Student Name *
                </Label>
                <Input
                  id="sName"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="Full name"
                  disabled={!!submissionId}
                  className="h-9 bg-white border-gray-300 text-gray-800 text-sm focus:border-amber-400/40 placeholder:text-gray-400"
                />
              </div>

              {/* Student ID */}
              <div className="space-y-1.5">
                <Label htmlFor="sId" className="text-[10px] font-mono text-gray-500 uppercase tracking-wide">
                  Roll / Student ID
                </Label>
                <Input
                  id="sId"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  placeholder="Optional"
                  disabled={!!submissionId}
                  className="h-9 bg-white border-gray-300 text-gray-800 text-sm focus:border-amber-400/40 placeholder:text-gray-400"
                />
              </div>

              {/* Exam info box */}
              {selectedExam && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-900">{selectedExam.title}</p>
                  {[
                    { label: 'Subject',   value: selectedExam.subject },
                    { label: 'Questions', value: selectedExam.questions.length },
                    { label: 'Marks',     value: selectedExam.totalMarks },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-600 font-mono">{label}</span>
                      <span className="text-[10px] text-gray-700 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              {!submissionId ? (
                <Button
                  className="w-full h-9 text-sm bg-amber-400 hover:bg-amber-300 text-black font-semibold gap-1.5"
                  onClick={handleCreateSubmission}
                  disabled={!selectedExamId || !studentName.trim() || submitting}
                >
                  {submitting
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
                    : <><Upload className="h-3.5 w-3.5" /> Create Submission</>
                  }
                </Button>
              ) : (
                <div className="space-y-3">
                  {/* Status row */}
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Submission created
                  </div>

                  {/* Upload stats */}
                  {uploadedEntries.length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-1">
                      {[
                        { label: 'Uploaded', value: uploadedEntries.length, color: 'text-gray-900' },
                        { label: 'OCR done', value: ocrDoneEntries.length,  color: 'text-emerald-400' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-600 font-mono">{label}</span>
                          <span className={`text-[10px] font-bold font-mono ${color}`}>{value}</span>
                        </div>
                      ))}
                      {anyOcrLoading && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 pt-0.5">
                          <Loader2 className="h-3 w-3 animate-spin" /> OCR in progress…
                        </div>
                      )}
                    </div>
                  )}

                  {/* Grade button */}
                  <Button
                    className={`w-full h-9 text-sm font-semibold gap-1.5 ${
                      canGrade
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                        : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    }`}
                    onClick={handleStartGrading}
                    disabled={!canGrade}
                  >
                    {submitting
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Grading…</>
                      : <><Zap className="h-3.5 w-3.5" /> Start AI Grading</>
                    }
                  </Button>

                  {uploadedEntries.length === 0 && (
                    <p className="text-[10px] text-gray-600 text-center font-mono">
                      Upload at least one answer to enable grading
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Overall progress mini card */}
          {selectedExam && fileEntries.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Upload Progress</p>
                <span className="text-[10px] font-mono text-gray-500">
                  {uploadedEntries.length}/{fileEntries.length}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-amber-400/60 transition-all duration-500"
                  style={{ width: `${fileEntries.length > 0 ? (uploadedEntries.length / fileEntries.length) * 100 : 0}%` }}
                />
              </div>
              {/* Per-question status dots */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {fileEntries.map(f => (
                  <div
                    key={f.questionNumber}
                    title={`Q${f.questionNumber}: ${f.uploaded ? f.confidence ?? 'uploaded' : 'pending'}`}
                    className={`h-5 w-5 rounded-md flex items-center justify-center text-[9px] font-mono border transition-colors ${
                      f.uploaded && f.flatText
                        ? f.confidence === 'high'   ? 'bg-emerald-400/20 border-emerald-400/30 text-emerald-400'
                        : f.confidence === 'medium' ? 'bg-amber-400/20 border-amber-400/30 text-amber-400'
                        : f.confidence === 'low'    ? 'bg-red-400/20 border-red-400/30 text-red-400'
                        : 'bg-emerald-400/20 border-emerald-400/30 text-emerald-400'
                        : f.ocrLoading              ? 'bg-amber-400/10 border-amber-400/20 text-amber-400 animate-pulse'
                        : f.uploaded               ? 'bg-blue-50 border-blue-200 text-blue-600'
                        : f.file                   ? 'bg-gray-100 border-gray-300 text-gray-500'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    {f.questionNumber}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Answer upload cards ─────────────────────────────── */}
        <div className="lg:col-span-2 min-h-[800px]">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-gray-300">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-700">Answer Images</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  Upload handwritten answers per question · text extracted automatically
                </p>
              </div>
              {selectedExam && (
                <span className="text-[10px] font-mono text-gray-600">
                  {uploadedEntries.length}/{fileEntries.length} uploaded
                </span>
              )}
            </div>

            {!selectedExam ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <Camera className="h-8 w-8 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 font-medium">No exam selected</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Select an exam on the left to start uploading answers
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 max-h-[800px] overflow-y-auto">
                {selectedExam.questions.map(question => {
                  const entry   = fileEntries.find(f => f.questionNumber === question.questionNumber);
                  if (!entry) return null;

                  const isPDF          = entry.file?.type === 'application/pdf';
                  const hasExtraction  = entry.pages.length > 0 && entry.flatText;
                  const isCollapsed    = entry.collapsed && !!entry.file;

                  return (
                    <div key={question.id} className="group">
                      {/* Question row header */}
                      <div
                        className={`flex items-start gap-3 px-4 py-3 transition-all duration-200 border border-transparent ${
                          entry.file ? 'cursor-pointer hover:bg-gray-50 hover:border-gray-200 hover:shadow-md' : ''
                        }`}
                        onClick={() => {
                          if (entry.file) updateEntry(question.questionNumber, { collapsed: !entry.collapsed });
                        }}
                      >
                        {/* Q badge */}
                        <div className={`h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-mono flex-shrink-0 mt-0.5 border-2 ${
                          hasExtraction
                            ? entry.confidence === 'high'   ? 'bg-emerald-400/20 border-emerald-400/30 text-emerald-400'
                            : entry.confidence === 'medium' ? 'bg-amber-400/20 border-amber-400/30 text-amber-400'
                            : entry.confidence === 'low'    ? 'bg-red-400/20 border-red-400/30 text-red-400'
                            : 'bg-emerald-400/20 border-emerald-400/30 text-emerald-400'
                            : entry.ocrLoading              ? 'bg-amber-400/10 border-amber-400/20 text-amber-400 animate-pulse'
                            : entry.uploaded               ? 'bg-blue-50 border-blue-200 text-blue-600'
                            : entry.file                   ? 'bg-gray-100 border-gray-300 text-gray-500'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}>
                          {question.questionNumber}
                        </div>

                        {/* Question text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-black line-clamp-1 leading-snug">
                            {question.questionText}
                          </p>
                          <p className="text-[10px] text-black mt-0.5 font-mono">
                            {question.maxMarks}m
                          </p>
                        </div>

                        {/* Status badges */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {entry.uploaded && (
                            <span className="text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5">
                              <CheckCircle className="h-2.5 w-2.5" /> Up
                            </span>
                          )}
                          {entry.ocrLoading && (
                            <span className="text-[10px] bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> OCR
                            </span>
                          )}
                          {hasExtraction && (
                            <span className="text-[10px] bg-blue-400/10 text-blue-400 border border-blue-400/20 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5">
                              <FileText className="h-2.5 w-2.5" /> Done
                            </span>
                          )}
                          {entry.error && (
                            <span className="text-[10px] bg-red-400/10 text-red-400 border border-red-400/20 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5">
                              <AlertCircle className="h-2.5 w-2.5" /> Err
                            </span>
                          )}
                          {entry.file && (
                            <div className="text-gray-500 hover:text-gray-700">
                              {isCollapsed
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronUp className="h-3.5 w-3.5" />
                              }
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expandable body */}
                      {!isCollapsed && (
                        <div className="px-4 pb-4 space-y-3">
                          {/* Hidden file input */}
                          <input
                            ref={el => { fileInputRefs.current[question.questionNumber] = el; }}
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(question.questionNumber, file);
                              e.target.value = '';
                            }}
                            disabled={!submissionId || uploading}
                          />

                          {entry.file ? (
                            <div className="space-y-3">
                              {/* File preview */}
                              <div className="relative">
                                {entry.previewUrl ? (
                                  <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                    <img
                                      src={entry.previewUrl}
                                      alt={`Q${question.questionNumber}`}
                                      className="w-full max-h-52 object-contain"
                                    />
                                  </div>
                                ) : isPDF ? (
                                  <PDFPreview
                                    file={entry.file}
                                    filePath={entry.filePath ?? undefined}
                                    height={240}
                                  />
                                ) : (
                                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <FileImage className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                    <span className="text-xs text-gray-600 truncate">{entry.file.name}</span>
                                  </div>
                                )}

                                {/* Remove */}
                                <button
                                  onClick={() => removeFile(question.questionNumber)}
                                  disabled={uploading || entry.ocrLoading}
                                  className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-md bg-red-500/80 hover:bg-red-500 text-white transition-colors disabled:opacity-40"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>

                              {/* OCR progress */}
                              {entry.ocrLoading && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 flex-shrink-0" />
                                  <span className="text-xs text-amber-700">
                                    Extracting text{isPDF ? ' — processing PDF pages…' : '…'}
                                  </span>
                                </div>
                              )}

                              {/* Extraction result */}
                              {hasExtraction && (
                                <div className="space-y-2">
                                  {/* Header row */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                      <span className="text-xs font-medium text-emerald-600">
                                        Extracted
                                        {entry.pages.length > 1 && (
                                          <span className="ml-1 text-emerald-600/60">
                                            ({entry.pages.length} pages)
                                          </span>
                                        )}
                                      </span>
                                      <ConfPill c={entry.confidence} />
                                    </div>
                                    <div className="flex gap-1">
                                      {!entry.ocrLoading && (
                                        <button
                                          onClick={() => retryOCR(question.questionNumber)}
                                          className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-700 transition-colors font-mono px-1.5 py-0.5 rounded hover:bg-gray-100"
                                        >
                                          <RefreshCw className="h-2.5 w-2.5" /> Retry
                                        </button>
                                      )}
                                      <button
                                        onClick={() => setPreviewDialog({
                                          open: true,
                                          questionNumber: entry.questionNumber,
                                          pages: entry.pages,
                                          metadata: {
                                            fileName: entry.file?.name,
                                            fileSize: entry.file
                                              ? `${(entry.file.size / 1024).toFixed(1)} KB`
                                              : undefined,
                                          },
                                        })}
                                        className="flex items-center gap-1 text-[10px] text-amber-600/70 hover:text-amber-600 transition-colors font-mono px-1.5 py-0.5 rounded hover:bg-amber-50 border border-transparent hover:border-amber-200"
                                      >
                                        <Eye className="h-2.5 w-2.5" /> View extraction
                                      </button>
                                    </div>
                                  </div>

                                  {/* Text snippet */}
                                  <div className="relative rounded-lg border border-emerald-200 bg-emerald-50 p-3 overflow-hidden max-h-20">
                                    <p className="text-[11px] text-gray-700 line-clamp-3 font-mono leading-relaxed">
                                      {entry.flatText.substring(0, 260)}
                                      {entry.flatText.length > 260 ? '…' : ''}
                                    </p>
                                    <div className="absolute bottom-0 inset-x-0 h-5 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />
                                  </div>
                                </div>
                              )}

                              {/* OCR failed */}
                              {entry.uploaded && !entry.ocrLoading && !hasExtraction && (
                                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                                  <span className="text-xs text-amber-700 flex items-center gap-1.5">
                                    <AlertCircle className="h-3 w-3" /> OCR returned no text
                                  </span>
                                  <button
                                    onClick={() => retryOCR(question.questionNumber)}
                                    className="text-[10px] text-amber-600/70 hover:text-amber-600 font-mono flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-amber-50 transition-colors"
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" /> Retry OCR
                                  </button>
                                </div>
                              )}

                              {/* Error */}
                              {entry.error && (
                                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                                  <p className="text-xs text-red-700">{entry.error}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Drop zone */
                            <div
                              className={`border border-dashed rounded-lg p-6 text-center transition-all duration-150 ${
                                submissionId
                                  ? 'cursor-pointer border-gray-300 hover:border-amber-400 hover:bg-amber-50 hover:shadow-lg hover:shadow-amber-200/20'
                                  : 'border-gray-200 opacity-40 cursor-not-allowed'
                              }`}
                              onDrop={e => handleDrop(question.questionNumber, e)}
                              onDragOver={e => e.preventDefault()}
                              onClick={() =>
                                submissionId && fileInputRefs.current[question.questionNumber]?.click()
                              }
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className="h-9 w-9 rounded-xl bg-gray-50 border-2 border-gray-300 flex items-center justify-center">
                                  <Upload className="h-5 w-5 text-gray-600" />
                                </div>
                                <div>
                                  <p className="text-xs text-black">
                                    {!submissionId ? 'Create submission first' : 'Drop file or click to browse'}
                                  </p>
                                  <p className="text-[10px] text-black mt-0.5 font-mono">
                                    JPEG · PNG · WebP · TIFF · PDF
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Extraction dialog ─────────────────────────────────────────── */}
      <FullScreenTextDialog
        open={previewDialog.open}
        onClose={() => setPreviewDialog(d => ({ ...d, open: false }))}
        title={`Extracted Content — Question ${previewDialog.questionNumber}`}
        description={
          previewDialog.pages.length > 1
            ? `${previewDialog.pages.length} pages · navigate with the page selector below`
            : 'OCR extraction result'
        }
      >
        <PageWiseViewer
          pages={previewDialog.pages}
          totalPages={previewDialog.pages.length}
          metadata={previewDialog.metadata}
        />
      </FullScreenTextDialog>
    </div>
  );
}