'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  FileImage,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Camera,
  FileText,
  Eye,
  RefreshCw,
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
  questionId: string;
  questionText: string;
  answerId: string | null;
  file: File | null;
  previewUrl: string | null;
  uploaded: boolean;
  filePath: string | null;
  // Page-wise extraction data
  pages: PageExtraction[];
  flatText: string;
  confidence: 'high' | 'medium' | 'low' | null;
  ocrLoading: boolean;
  error: string | null;
}

interface AnswerFromServer {
  id: string;
  questionId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UploadTab({ teacherId, onSubmissionCreated }: UploadTabProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    questionNumber: number;
    pages: PageExtraction[];
    metadata?: { fileName?: string; fileSize?: string };
  }>({ open: false, questionNumber: 0, pages: [] });

  // Stable refs to avoid stale closures in async handlers
  const submissionIdRef = useRef<string | null>(null);
  const fileEntriesRef = useRef<FileEntry[]>([]);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => { fileEntriesRef.current = fileEntries; }, [fileEntries]);
  useEffect(() => { submissionIdRef.current = submissionId; }, [submissionId]);

  // ── Load exams ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/exams')
      .then((r) => r.ok ? r.json() : [])
      .then(setExams)
      .catch(console.error);
  }, []);

  // ── Exam selection ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (selectedExamId) {
      const exam = exams.find((e) => e.id === selectedExamId) ?? null;
      setSelectedExam(exam);
      if (exam) {
        setFileEntries(
          exam.questions.map((q) => ({
            questionNumber: q.questionNumber,
            questionId: q.id,
            questionText: q.questionText,
            answerId: null,
            file: null,
            previewUrl: null,
            uploaded: false,
            filePath: null,
            pages: [],
            flatText: '',
            confidence: null,
            ocrLoading: false,
            error: null,
          }))
        );
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
      setFileEntries((prev) =>
        prev.map((f) => (f.questionNumber === questionNumber ? { ...f, ...patch } : f))
      ),
    []
  );

  // ── Upload one file ────────────────────────────────────────────────────────

  const uploadFile = async (questionNumber: number, file: File, subId: string): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('submissionId', subId);
    fd.append('questionNumber', String(questionNumber));

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) return null;
      const data = await res.json();
      return data.filePath ?? null;
    } catch {
      return null;
    }
  };

  // ── OCR one file ───────────────────────────────────────────────────────────

  const runOCR = async (
    filePath: string,
    questionText: string
  ): Promise<{ pages: PageExtraction[]; flatText: string; confidence: 'high' | 'medium' | 'low' }> => {
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, questionText }),
      });
      if (!res.ok) return { pages: [], flatText: '', confidence: 'low' };
      const data = await res.json();
      return {
        pages: data.pages ?? [],
        flatText: data.text ?? '',
        confidence: data.confidence ?? 'low',
      };
    } catch {
      return { pages: [], flatText: '', confidence: 'low' };
    }
  };

  // ── Patch answer record ────────────────────────────────────────────────────

  const patchAnswer = async (
    answerId: string,
    imagePath: string,
    text: string,
    confidence: string
  ) => {
    try {
      await fetch(`/api/answers/${answerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handwrittenImagePath: imagePath,
          recognizedText: text,
          confidenceLevel: confidence,
        }),
      });
    } catch {/* non-critical */}
  };

  // ── File select / drop ─────────────────────────────────────────────────────

  const handleFileSelect = async (questionNumber: number, file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'application/pdf'];
    if (!ALLOWED.includes(file.type)) {
      updateEntry(questionNumber, { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, TIFF, PDF' });
      return;
    }

    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    updateEntry(questionNumber, {
      file,
      previewUrl,
      uploaded: false,
      filePath: null,
      pages: [],
      flatText: '',
      confidence: null,
      ocrLoading: false,
      error: null,
    });

    // If submission exists, upload immediately
    const subId = submissionIdRef.current;
    if (!subId) return;

    setUploading(true);
    try {
      const filePath = await uploadFile(questionNumber, file, subId);
      if (!filePath) {
        updateEntry(questionNumber, { error: 'Upload failed — please try again.' });
        return;
      }
      updateEntry(questionNumber, { uploaded: true, filePath });

      // OCR
      updateEntry(questionNumber, { ocrLoading: true });
      const entry = fileEntriesRef.current.find((f) => f.questionNumber === questionNumber);
      const { pages, flatText, confidence } = await runOCR(filePath, entry?.questionText ?? '');

      updateEntry(questionNumber, { pages, flatText, confidence, ocrLoading: false });

      // Persist extracted text to the answer record
      const latest = fileEntriesRef.current.find((f) => f.questionNumber === questionNumber);
      if (latest?.answerId) {
        await patchAnswer(latest.answerId, filePath, flatText, confidence);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (questionNumber: number, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(questionNumber, file);
  };

  const removeFile = (questionNumber: number) => {
    const entry = fileEntriesRef.current.find((f) => f.questionNumber === questionNumber);
    if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    updateEntry(questionNumber, {
      file: null,
      previewUrl: null,
      uploaded: false,
      filePath: null,
      pages: [],
      flatText: '',
      confidence: null,
      ocrLoading: false,
      error: null,
    });
  };

  const retryOCR = async (questionNumber: number) => {
    const entry = fileEntriesRef.current.find((f) => f.questionNumber === questionNumber);
    if (!entry?.filePath) return;
    updateEntry(questionNumber, { ocrLoading: true, error: null });
    const { pages, flatText, confidence } = await runOCR(entry.filePath, entry.questionText);
    updateEntry(questionNumber, { pages, flatText, confidence, ocrLoading: false });
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
          examId: selectedExam.id,
          studentName: studentName.trim(),
          studentId: studentId.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? 'Failed to create submission');
        return;
      }
      const submission = await res.json();
      setSubmissionId(submission.id);
      submissionIdRef.current = submission.id;

      if (submission.answers?.length) {
        setFileEntries((prev) =>
          prev.map((f) => {
            const ans = (submission.answers as AnswerFromServer[]).find(
              (a) => a.questionId === f.questionId
            );
            return ans ? { ...f, answerId: ans.id } : f;
          })
        );
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
        const err = await res.json();
        alert(err.error ?? 'Grading failed');
      }
    } catch {
      alert('Grading failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const uploadedEntries = fileEntries.filter((f) => f.file && f.uploaded);
  const ocrDoneEntries = uploadedEntries.filter((f) => f.flatText);
  const anyOcrLoading = fileEntries.some((f) => f.ocrLoading);
  const canGrade = !!submissionId && uploadedEntries.length > 0 && !submitting && !uploading;

  // ── Confidence pill ────────────────────────────────────────────────────────

  const ConfPill = ({ c }: { c: 'high' | 'medium' | 'low' | null }) => {
    if (!c) return null;
    const map = {
      high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${map[c]}`}>
        {c.charAt(0).toUpperCase() + c.slice(1)} confidence
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Upload Answers</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Select an exam, enter student details, then upload handwritten answer images or PDFs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: Submission details ─────────────────────────────────── */}
        <Card className="lg:col-span-1 self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submission Details</CardTitle>
            <CardDescription className="text-xs">Exam selection & student info</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Exam *</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={!!submissionId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose an exam…" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id} className="text-sm">
                      {exam.title} — {exam.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="studentName" className="text-xs">Student Name *</Label>
              <Input
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Full name"
                className="h-9 text-sm"
                disabled={!!submissionId}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="studentId" className="text-xs">Roll / Student ID</Label>
              <Input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Optional"
                className="h-9 text-sm"
                disabled={!!submissionId}
              />
            </div>

            {selectedExam && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-sm">{selectedExam.title}</p>
                <p>Subject: {selectedExam.subject}</p>
                <p>Questions: {selectedExam.questions.length}</p>
                <p>Total marks: {selectedExam.totalMarks}</p>
              </div>
            )}

            {!submissionId ? (
              <Button
                className="w-full h-9 text-sm"
                onClick={handleCreateSubmission}
                disabled={!selectedExamId || !studentName.trim() || submitting}
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Creating…</>
                ) : (
                  <><Upload className="mr-2 h-3.5 w-3.5" />Create Submission</>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Submission created — now upload answer images
                </div>

                {uploadedEntries.length > 0 && (
                  <div className="rounded-lg bg-muted/40 border border-border p-2.5 text-xs space-y-0.5 text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{uploadedEntries.length}</span> image(s) uploaded
                    </p>
                    <p>
                      <span className="font-medium text-foreground">{ocrDoneEntries.length}</span> OCR completed
                    </p>
                    {anyOcrLoading && <p className="text-amber-600 dark:text-amber-400">OCR in progress…</p>}
                  </div>
                )}

                <Button
                  className="w-full h-9 text-sm"
                  onClick={handleStartGrading}
                  disabled={!canGrade}
                >
                  {submitting ? (
                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Grading…</>
                  ) : (
                    'Start AI Grading'
                  )}
                </Button>

                {uploadedEntries.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Upload at least one answer to enable grading.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Right: File upload area ──────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Answer Images</CardTitle>
            <CardDescription className="text-xs">
              Upload handwritten answers per question. Text is extracted automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedExam ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                  <Camera className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Select an exam to start uploading answers.</p>
              </div>
            ) : (
              <ScrollArea className="h-[560px] pr-3">
                <div className="space-y-4">
                  {selectedExam.questions.map((question) => {
                    const entry = fileEntries.find(
                      (f) => f.questionNumber === question.questionNumber
                    );
                    if (!entry) return null;

                    const isPDF = entry.file?.type === 'application/pdf';
                    const hasExtraction = entry.pages.length > 0 && entry.flatText;

                    return (
                      <Card key={question.id} className="overflow-hidden border-border/70">
                        {/* Question header */}
                        <div className="flex items-start gap-3 p-3 bg-muted/30 border-b border-border/50">
                          <Badge variant="outline" className="text-[11px] flex-shrink-0 mt-0.5">
                            Q{question.questionNumber}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug line-clamp-2">
                              {question.questionText}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Max marks: {question.maxMarks}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1 flex-shrink-0">
                            {entry.uploaded && (
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] border-emerald-300/50 gap-0.5">
                                <CheckCircle className="h-2.5 w-2.5" /> Uploaded
                              </Badge>
                            )}
                            {entry.ocrLoading && (
                              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] border-amber-300/50 gap-0.5">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> OCR…
                              </Badge>
                            )}
                            {hasExtraction && (
                              <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] border-blue-300/50 gap-0.5">
                                <FileText className="h-2.5 w-2.5" /> Extracted
                              </Badge>
                            )}
                            {entry.error && (
                              <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] border-red-300/50 gap-0.5">
                                <AlertCircle className="h-2.5 w-2.5" /> Error
                              </Badge>
                            )}
                          </div>
                        </div>

                        <CardContent className="p-3">
                          {/* Hidden file input */}
                          <input
                            ref={(el) => { fileInputRefs.current[question.questionNumber] = el; }}
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(question.questionNumber, file);
                              e.target.value = '';
                            }}
                            disabled={!submissionId || uploading}
                          />

                          {entry.file ? (
                            <div className="space-y-3">
                              {/* Preview */}
                              <div className="relative">
                                {entry.previewUrl ? (
                                  <div className="relative rounded-lg overflow-hidden border border-border bg-muted/20">
                                    <img
                                      src={entry.previewUrl}
                                      alt={`Q${question.questionNumber} answer`}
                                      className="w-full max-h-48 object-contain"
                                    />
                                  </div>
                                ) : isPDF ? (
                                  <PDFPreview
                                    file={entry.file}
                                    filePath={entry.filePath ?? undefined}
                                    height={240}
                                  />
                                ) : (
                                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
                                    <FileImage className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm text-muted-foreground truncate">
                                      {entry.file.name}
                                    </span>
                                  </div>
                                )}

                                {/* Remove button */}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2 h-6 w-6 p-0 rounded-md opacity-80 hover:opacity-100"
                                  onClick={() => removeFile(question.questionNumber)}
                                  disabled={uploading || entry.ocrLoading}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* OCR loading */}
                              {entry.ocrLoading && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                                  Extracting text — this may take a moment for PDFs…
                                </div>
                              )}

                              {/* Extraction result */}
                              {hasExtraction && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                        Extraction complete
                                        {entry.pages.length > 1 && ` (${entry.pages.length} pages)`}
                                      </span>
                                      <ConfPill c={entry.confidence} />
                                    </div>
                                    <div className="flex gap-1">
                                      {entry.uploaded && !entry.ocrLoading && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => retryOCR(question.questionNumber)}
                                          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                        >
                                          <RefreshCw className="h-2.5 w-2.5" /> Retry
                                        </Button>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setPreviewDialog({
                                            open: true,
                                            questionNumber: entry.questionNumber,
                                            pages: entry.pages,
                                            metadata: {
                                              fileName: entry.file?.name,
                                              fileSize: entry.file
                                                ? `${(entry.file.size / 1024).toFixed(1)} KB`
                                                : undefined,
                                            },
                                          })
                                        }
                                        className="h-6 px-2 text-[10px] gap-1"
                                      >
                                        <Eye className="h-2.5 w-2.5" /> View extraction
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Preview snippet */}
                                  <div className="relative rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 overflow-hidden max-h-20">
                                    <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3 font-mono leading-relaxed">
                                      {entry.flatText.substring(0, 250)}
                                      {entry.flatText.length > 250 ? '…' : ''}
                                    </p>
                                    <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-emerald-50 dark:from-emerald-950/50 to-transparent pointer-events-none" />
                                  </div>
                                </div>
                              )}

                              {/* OCR failed state */}
                              {entry.uploaded && !entry.ocrLoading && !hasExtraction && (
                                <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    OCR returned no text
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => retryOCR(question.questionNumber)}
                                    className="h-6 px-2 text-[10px] gap-1"
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" /> Retry OCR
                                  </Button>
                                </div>
                              )}

                              {/* Upload error */}
                              {entry.error && (
                                <p className="text-xs text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                                  {entry.error}
                                </p>
                              )}
                            </div>
                          ) : (
                            /* Drop zone */
                            <div
                              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                                submissionId
                                  ? 'cursor-pointer border-border hover:border-primary/50 hover:bg-muted/20'
                                  : 'border-border/40 opacity-50 cursor-not-allowed'
                              }`}
                              onDrop={(e) => handleDrop(question.questionNumber, e)}
                              onDragOver={(e) => e.preventDefault()}
                              onClick={() =>
                                submissionId &&
                                fileInputRefs.current[question.questionNumber]?.click()
                              }
                            >
                              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                {!submissionId
                                  ? 'Create submission first'
                                  : 'Drop file here or click to browse'}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                JPEG · PNG · WebP · TIFF · PDF
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Extraction dialog ─────────────────────────────────────────────── */}
      <FullScreenTextDialog
        open={previewDialog.open}
        onClose={() => setPreviewDialog((d) => ({ ...d, open: false }))}
        title={`Extracted Content — Question ${previewDialog.questionNumber}`}
        description={
          previewDialog.pages.length > 1
            ? `${previewDialog.pages.length} pages extracted · Navigate with the page selector below`
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