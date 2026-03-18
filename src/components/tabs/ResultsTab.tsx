'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid,
  PolarAngleAxis, Radar, Legend,
} from 'recharts';
import {
  CheckCircle, XCircle, AlertTriangle, Eye, Trash2, User, Calendar,
  Award, Search, Download, SortAsc, Loader2, RotateCcw, Pencil, Save,
} from 'lucide-react';
import type { Submission, Exam, Answer } from '@/lib/types';
import ResultDetailDialog from '@/components/ResultDetailDialog';

interface ResultsTabProps { refreshTrigger?: number; }
type SortKey = 'date' | 'score' | 'name';

function scoreColor(p: number) {
  if (p >= 80) return 'text-emerald-400';
  if (p >= 60) return 'text-amber-400';
  if (p >= 40) return 'text-orange-400';
  return 'text-red-400';
}
function scoreBarColor(p: number) {
  if (p >= 80) return 'bg-emerald-400';
  if (p >= 60) return 'bg-amber-400';
  if (p >= 40) return 'bg-orange-400';
  return 'bg-red-400';
}

export default function ResultsTab({ refreshTrigger }: ResultsTabProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams]             = useState<Exam[]>([]);
  const [loading, setLoading]         = useState(true);
  const [deleting, setDeleting]       = useState(false);

  const [examFilter, setExamFilter]   = useState('all');
  const [search, setSearch]           = useState('');
  const [sortKey, setSortKey]         = useState<SortKey>('date');
  const [statusFilter, setStatus]     = useState('all');
  const [detailSub, setDetailSub]     = useState<Submission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);

  // Override state
  const [overrideId, setOverrideId]   = useState<string | null>(null);
  const [oScore, setOScore]           = useState('');
  const [oComment, setOComment]       = useState('');
  const [savingOv, setSavingOv]       = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sr, er] = await Promise.all([fetch('/api/submissions'), fetch('/api/exams')]);
      if (sr.ok && er.ok) { setSubmissions(await sr.json()); setExams(await er.json()); }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [refreshTrigger]);

  const filtered = useMemo(() => {
    let list = submissions.filter(s => {
      const q = search.toLowerCase();
      return s.studentName.toLowerCase().includes(q) ||
             (s.studentId ?? '').toLowerCase().includes(q) ||
             (s.exam?.title ?? '').toLowerCase().includes(q);
    });
    if (examFilter !== 'all')   list = list.filter(s => s.examId === examFilter);
    if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter);
    return [...list].sort((a, b) =>
      sortKey === 'name'  ? a.studentName.localeCompare(b.studentName) :
      sortKey === 'score' ? (b.percentage ?? 0) - (a.percentage ?? 0) :
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }, [submissions, search, examFilter, statusFilter, sortKey]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/submissions/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubmissions(p => p.filter(s => s.id !== deleteTarget.id));
        if (detailSub?.id === deleteTarget.id) setDetailSub(null);
        setDeleteTarget(null);
      }
    } finally { setDeleting(false); }
  };

  const handleRegrade = async (id: string) => {
    try {
      await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: id }),
      });
      await fetchAll();
    } catch (e) { console.error(e); }
  };

  const handleSaveOverride = async () => {
    if (!overrideId) return;
    setSavingOv(true);
    try {
      const res = await fetch(`/api/answers/${overrideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherScore: parseFloat(oScore), teacherComment: oComment }),
      });
      if (res.ok) {
        setOverrideId(null); setOScore(''); setOComment('');
        await fetchAll();
        if (detailSub) {
          const sr = await fetch('/api/submissions');
          if (sr.ok) setDetailSub((await sr.json()).find((s: Submission) => s.id === detailSub.id) ?? null);
        }
      }
    } finally { setSavingOv(false); }
  };

  const exportCSV = () => {
    const rows = [
      ['Name','ID','Exam','Score','Max','%','Status','Date'],
      ...filtered.map(s => [
        s.studentName, s.studentId ?? '', s.exam?.title ?? '',
        s.totalScore?.toFixed(1) ?? '', s.maxScore?.toFixed(0) ?? '',
        `${(s.percentage ?? 0).toFixed(1)}%`, s.status,
        new Date(s.submittedAt).toLocaleDateString(),
      ]),
    ];
    const blob = new Blob([rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'results.csv' });
    a.click(); URL.revokeObjectURL(a.href);
  };

  // ── Answer row ────────────────────────────────────────────────────
  const AnswerRow = ({ ans }: { ans: Answer }) => {
    const finalScore = ans.teacherScore ?? ans.finalScore ?? 0;
    const pct = ans.maxMarks > 0 ? (finalScore / ans.maxMarks) * 100 : 0;
    const isEditing = overrideId === ans.id;

    return (
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded">Q{ans.questionNumber}</span>
            {ans.confidenceLevel && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                ans.confidenceLevel === 'high'   ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                ans.confidenceLevel === 'medium' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                'bg-red-400/10 text-red-400 border-red-400/20'
              }`}>OCR {ans.confidenceLevel}</span>
            )}
            {ans.needsReview && <span className="text-[10px] bg-orange-400/10 text-orange-400 border border-orange-400/20 px-1.5 py-0.5 rounded font-mono">⚠ Review</span>}
            {ans.teacherScore != null && <span className="text-[10px] bg-blue-400/10 text-blue-400 border border-blue-400/20 px-1.5 py-0.5 rounded font-mono">✓ Overridden</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold ${scoreColor(pct)}`}>{finalScore.toFixed(1)}/{ans.maxMarks}</span>
            <Button variant="ghost" size="sm" onClick={() => {
              if (isEditing) { setOverrideId(null); return; }
              setOverrideId(ans.id); setOScore(String(ans.teacherScore ?? ans.finalScore ?? '')); setOComment(ans.teacherComment ?? '');
            }} className="h-6 w-6 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50">
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Score bars */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Similarity', val: (ans.similarityScore ?? 0) * 100, color: 'bg-blue-400/60' },
              { label: 'Keywords',   val: (ans.keywordScore ?? 0) * 100,    color: 'bg-purple-400/60' },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>{label}</span><span>{val.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.05]">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
                </div>
              </div>
            ))}
          </div>

          {ans.recognizedText && (
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Student Answer</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-28 overflow-y-auto">
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{ans.recognizedText}</p>
              </div>
            </div>
          )}

          {ans.modelAnswer && (
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Model Answer</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 max-h-24 overflow-y-auto">
                <p className="text-xs text-emerald-700 leading-relaxed whitespace-pre-wrap">{ans.modelAnswer}</p>
              </div>
            </div>
          )}

          {/* Key points */}
          {(ans.keyPointsFound || ans.keyPointsMissed) && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { json: ans.keyPointsFound,  icon: CheckCircle, color: 'text-emerald-400', mark: '✓', label: 'Found' },
                { json: ans.keyPointsMissed, icon: XCircle,     color: 'text-red-400',     mark: '✗', label: 'Missed' },
              ].map(({ json, color, mark, label }) => {
                if (!json) return null;
                try {
                  const pts: string[] = JSON.parse(json);
                  if (!pts.length) return null;
                  return (
                    <div key={label}>
                      <p className={`text-[10px] font-mono mb-1.5 ${color}`}>{label} ({pts.length})</p>
                      <ul className="space-y-0.5">
                        {pts.map((p, i) => (
                          <li key={i} className="text-[11px] text-gray-600 flex gap-1.5">
                            <span className={color + ' flex-shrink-0'}>{mark}</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                } catch { return null; }
              })}
            </div>
          )}

          {ans.feedback && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-[10px] font-mono text-blue-600 mb-1">AI Feedback</p>
              <p className="text-xs text-gray-700 leading-relaxed">{ans.feedback}</p>
            </div>
          )}

          {isEditing && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-mono text-amber-600 uppercase tracking-widest">Manual Score Override</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-gray-500">Score (max {ans.maxMarks})</Label>
                  <Input type="number" value={oScore} onChange={e => setOScore(e.target.value)}
                    min={0} max={ans.maxMarks} step={0.5}
                    className="h-7 text-xs bg-white border-gray-300 text-gray-800 mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500">Teacher Comment</Label>
                  <Input value={oComment} onChange={e => setOComment(e.target.value)} placeholder="Optional…"
                    className="h-7 text-xs bg-white border-gray-300 text-gray-800 mt-1" />
                </div>
              </div>
              <div className="flex gap-1.5 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setOverrideId(null)} className="h-6 text-[11px] text-gray-500">Cancel</Button>
                <Button size="sm" onClick={handleSaveOverride} disabled={savingOv || !oScore}
                  className="h-6 text-[11px] bg-amber-400 hover:bg-amber-300 text-black font-semibold gap-1">
                  {savingOv ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />} Save
                </Button>
              </div>
            </div>
          )}

          {ans.teacherComment && !isEditing && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-[10px] text-amber-600 font-mono mb-0.5">Teacher Note</p>
              <p className="text-xs text-gray-700">{ans.teacherComment}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Results</h2>
          <p className="text-sm text-gray-600 mt-0.5">Review graded submissions · override scores · export data</p>
        </div>
        <Button onClick={exportCSV} disabled={!filtered.length} variant="outline"
          className="h-9 text-sm border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 gap-1.5 self-start sm:self-auto">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, ID, exam…"
            className="pl-8 h-9 bg-white border-gray-300 text-gray-800 text-sm focus:border-amber-400/40 placeholder:text-gray-400" />
        </div>
        {[
          { val: examFilter, set: setExamFilter, items: [{ v: 'all', l: 'All Exams' }, ...exams.map(e => ({ v: e.id, l: e.title }))], w: 'w-44' },
          { val: statusFilter, set: setStatus, items: [{ v: 'all', l: 'All Status' }, { v: 'pending', l: 'Pending' }, { v: 'processing', l: 'Processing' }, { v: 'graded', l: 'Graded' }], w: 'w-36' },
        ].map(({ val, set, items, w }, idx) => (
          <Select key={idx} value={val} onValueChange={set}>
            <SelectTrigger className={`h-9 ${w} bg-white border-gray-300 text-gray-700 text-sm`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              {items.map(i => <SelectItem key={i.v} value={i.v} className="text-gray-700">{i.l}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        <Select value={sortKey} onValueChange={(v: SortKey) => setSortKey(v)}>
          <SelectTrigger className="h-9 w-36 bg-white border-gray-300 text-gray-700 text-sm">
            <SortAsc className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200">
            <SelectItem value="date" className="text-gray-700">Newest</SelectItem>
            <SelectItem value="score" className="text-gray-700">Highest score</SelectItem>
            <SelectItem value="name"  className="text-gray-700">A → Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary bar */}
      {!loading && filtered.length > 0 && (
        <div className="flex gap-4 text-[11px] font-mono text-gray-500">
          <span>{filtered.length} total</span>
          <span className="text-emerald-400">{filtered.filter(s => s.status === 'graded').length} graded</span>
          {filtered.filter(s => s.status === 'graded').length > 0 && (
            <span className="text-amber-400">
              avg {(filtered.filter(s => s.status === 'graded').reduce((a, s) => a + (s.percentage ?? 0), 0) /
                filtered.filter(s => s.status === 'graded').length).toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 h-44 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
            <Award className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">
            {search || examFilter !== 'all' ? 'No results match filters' : 'No submissions yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(sub => {
            const pct = sub.percentage ?? 0;
            const isGraded = sub.status === 'graded';
            return (
              <div key={sub.id} className="group rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all flex flex-col overflow-hidden">
                <div className="p-4 pb-3 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">{sub.studentName}</p>
                      <p className="text-xs text-gray-600 truncate">{sub.exam?.title}</p>
                    </div>
                    <Badge className={`text-[10px] border flex-shrink-0 capitalize ${
                      sub.status === 'graded'     ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                      sub.status === 'processing' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                      'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full mr-1 inline-block ${
                        sub.status === 'graded' ? 'bg-emerald-400' : sub.status === 'processing' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'
                      }`} />
                      {sub.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    {sub.studentId && <span className="flex items-center gap-1"><User className="h-3 w-3" />{sub.studentId}</span>}
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(sub.submittedAt).toLocaleDateString()}</span>
                  </div>

                  {isGraded && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-gray-500 font-mono">Score</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-sm font-bold ${scoreColor(pct)}`}>{sub.totalScore?.toFixed(1)}</span>
                          <span className="text-xs text-gray-500">/ {sub.maxScore?.toFixed(0)}</span>
                          <span className={`text-[10px] font-mono ml-1 px-1 py-0.5 rounded ${scoreColor(pct)}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200">
                        <div className={`h-full rounded-full ${scoreBarColor(pct)} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      {(sub.answers?.filter(a => a.needsReview).length ?? 0) > 0 && (
                        <p className="text-[10px] text-orange-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {sub.answers.filter(a => a.needsReview).length} need review
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 px-3 py-2 flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDetailSub(sub)} className="h-7 px-2 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1">
                    <Eye className="h-3 w-3" /> View
                  </Button>
                  {isGraded && (
                    <Button variant="ghost" size="sm" onClick={() => handleRegrade(sub.id)} className="h-7 px-2 text-[11px] text-gray-500 hover:text-amber-600 hover:bg-amber-50 gap-1">
                      <RotateCcw className="h-3 w-3" /> Re-grade
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(sub)} className="h-7 w-7 p-0 ml-auto text-gray-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <ResultDetailDialog
        open={!!detailSub}
        submission={detailSub}
        onClose={() => {
          setDetailSub(null);
          setOverrideId(null);
        }}
      />

      {/* Delete Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-white border-gray-200 text-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Delete submission?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Permanently remove <strong className="text-gray-900">{deleteTarget?.studentName}</strong>'s submission. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="border-gray-300 text-gray-600 hover:bg-gray-100">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-500 hover:bg-red-600 text-white">
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}