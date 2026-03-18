'use client';

/**
 * ReviewTab
 * The main review queue. Shows all graded submissions with review
 * status, priority scoring, progress bars, and filters.
 * Clicking a submission launches the full ReviewPanel.
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle, XCircle, HelpCircle, Clock, Flag, AlertTriangle,
  Search, SortAsc, Eye, RotateCcw, Filter, Zap, Lock, Users,
  TrendingUp, Loader2, ChevronRight, ThumbsUp, ThumbsDown, Minus,
} from 'lucide-react';
import ReviewPanel from '@/components/ReviewPanel';
import type { Submission, Exam } from '@/lib/types';

interface ReviewTabProps {
  refreshTrigger?: number;
}

type SortKey = 'priority' | 'date' | 'score' | 'progress';
type ReviewStatus = 'all' | 'pending' | 'in_review' | 'reviewed' | 'disputed';

// ── Enriched submission type ──────────────────────────────────────────────────
interface EnrichedSubmission extends Submission {
  _review: {
    total:         number;
    accepted:      number;
    rejected:      number;
    disputed:      number;
    flagged:       number;
    pending:       number;
    lowOcr:        number;
    hasOverride:   boolean;
    progress:      number;
    priorityScore: number;
    isComplete:    boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
function priorityLabel(score: number): { label: string; color: string } {
  if (score >= 8)  return { label: 'High',   color: 'bg-red-400/10 text-red-400 border-red-400/20'           };
  if (score >= 4)  return { label: 'Medium', color: 'bg-amber-400/10 text-amber-400 border-amber-400/20'     };
  if (score >= 1)  return { label: 'Low',    color: 'bg-blue-400/10 text-blue-400 border-blue-400/20'         };
  return               { label: 'Done',   color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' };
}

// ── Stat mini-card ────────────────────────────────────────────────────────────
const StatMini = ({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon: React.ElementType; accent: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-3.5 flex items-center gap-3">
    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
    <div>
      <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReviewTab({ refreshTrigger }: ReviewTabProps) {
  const [submissions, setSubmissions]       = useState<EnrichedSubmission[]>([]);
  const [exams, setExams]                   = useState<Exam[]>([]);
  const [loading, setLoading]               = useState(true);
  const [reviewTarget, setReviewTarget]     = useState<Submission | null>(null);

  // Filters
  const [search, setSearch]                 = useState('');
  const [examFilter, setExamFilter]         = useState('all');
  const [statusFilter, setStatusFilter]     = useState<ReviewStatus>('all');
  const [sortKey, setSortKey]               = useState<SortKey>('priority');
  const [showOnlyFlagged, setFlagged]       = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sr, er] = await Promise.all([
        fetch('/api/reviews?priority=true'),
        fetch('/api/exams'),
      ]);
      if (sr.ok && er.ok) {
        setSubmissions(await sr.json());
        setExams(await er.json());
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [refreshTrigger]);

  // ── Derived list ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = submissions.filter(s => {
      const q = search.toLowerCase();
      return (
        s.studentName.toLowerCase().includes(q) ||
        (s.studentId ?? '').toLowerCase().includes(q) ||
        (s.exam?.title ?? '').toLowerCase().includes(q)
      );
    });
    if (examFilter !== 'all')  list = list.filter(s => s.examId === examFilter);
    if (statusFilter !== 'all') {
      list = list.filter(s => {
        const rev = s._review;
        if (statusFilter === 'reviewed') return rev.isComplete;
        if (statusFilter === 'pending')  return rev.pending === rev.total;
        if (statusFilter === 'in_review')return rev.pending < rev.total && !rev.isComplete;
        if (statusFilter === 'disputed') return rev.disputed > 0;
        return true;
      });
    }
    if (showOnlyFlagged) list = list.filter(s => s._review.flagged > 0);

    return [...list].sort((a, b) => {
      if (sortKey === 'priority') return b._review.priorityScore - a._review.priorityScore;
      if (sortKey === 'date')     return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      if (sortKey === 'score')    return (b.percentage ?? 0) - (a.percentage ?? 0);
      if (sortKey === 'progress') return a._review.progress - b._review.progress; // least reviewed first
      return 0;
    });
  }, [submissions, search, examFilter, statusFilter, sortKey, showOnlyFlagged]);

  // ── Summary stats ──────────────────────────────────────────────────
  const summaryStats = useMemo(() => ({
    total:      submissions.length,
    reviewed:   submissions.filter(s => s._review.isComplete).length,
    disputed:   submissions.filter(s => s._review.disputed > 0).length,
    flagged:    submissions.filter(s => s._review.flagged > 0).length,
    highPri:    submissions.filter(s => s._review.priorityScore >= 8).length,
    avgScore:   submissions.length
      ? submissions.reduce((a, s) => a + (s.percentage ?? 0), 0) / submissions.length
      : 0,
  }), [submissions]);

  // ── If a review panel is open ──────────────────────────────────────
  if (reviewTarget) {
    return (
      <ReviewPanel
        submission={reviewTarget}
        onClose={() => { setReviewTarget(null); fetchAll(); }}
        onFinalized={() => { setReviewTarget(null); fetchAll(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Review Queue</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Accept, reject or dispute AI grades · override scores · finalise submissions
          </p>
        </div>
        <Button
          onClick={fetchAll}
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1.5 self-start"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <StatMini label="Total"      value={summaryStats.total}                              icon={Users}        accent="bg-blue-400/10 text-blue-400" />
          <StatMini label="Reviewed"   value={summaryStats.reviewed}                           icon={Lock}         accent="bg-emerald-400/10 text-emerald-400" />
          <StatMini label="Disputed"   value={summaryStats.disputed}                           icon={HelpCircle}   accent="bg-purple-400/10 text-purple-400" />
          <StatMini label="Flagged"    value={summaryStats.flagged}                            icon={Flag}         accent="bg-orange-400/10 text-orange-400" />
          <StatMini label="High Pri"   value={summaryStats.highPri}                            icon={Zap}          accent="bg-red-400/10 text-red-400" />
          <StatMini label="Avg Score"  value={`${summaryStats.avgScore.toFixed(1)}%`}          icon={TrendingUp}   accent="bg-amber-400/10 text-amber-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student, ID or exam…"
            className="pl-8 h-9 bg-white border-gray-300 text-gray-800 text-sm focus:border-amber-400/40 placeholder:text-gray-400"
          />
        </div>

        {/* Exam */}
        <Select value={examFilter} onValueChange={setExamFilter}>
          <SelectTrigger className="h-9 w-44 bg-white border-gray-300 text-gray-700 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200">
            <SelectItem value="all" className="text-gray-700">All Exams</SelectItem>
            {exams.map(e => <SelectItem key={e.id} value={e.id} className="text-gray-700">{e.title}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Review status */}
        <Select value={statusFilter} onValueChange={(v: ReviewStatus) => setStatusFilter(v)}>
          <SelectTrigger className="h-9 w-36 bg-white border-gray-300 text-gray-700 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200">
            <SelectItem value="all"       className="text-gray-700">All Status</SelectItem>
            <SelectItem value="pending"   className="text-gray-700">Pending</SelectItem>
            <SelectItem value="in_review" className="text-gray-700">In Review</SelectItem>
            <SelectItem value="reviewed"  className="text-gray-700">Reviewed</SelectItem>
            <SelectItem value="disputed"  className="text-gray-700">Disputed</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortKey} onValueChange={(v: SortKey) => setSortKey(v)}>
          <SelectTrigger className="h-9 w-36 bg-white border-gray-300 text-gray-700 text-sm">
            <SortAsc className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200">
            <SelectItem value="priority" className="text-gray-700">Priority</SelectItem>
            <SelectItem value="date"     className="text-gray-700">Newest</SelectItem>
            <SelectItem value="score"    className="text-gray-700">Score</SelectItem>
            <SelectItem value="progress" className="text-gray-700">Least reviewed</SelectItem>
          </SelectContent>
        </Select>

        {/* Flagged toggle */}
        <button
          onClick={() => setFlagged(p => !p)}
          className={`h-9 px-3 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
            showOnlyFlagged
              ? 'bg-orange-400/10 border-orange-400/30 text-orange-400'
              : 'border-gray-300 bg-white text-gray-500 hover:text-gray-700'
          }`}
        >
          <Flag className="h-3.5 w-3.5" />
          Flagged only
        </button>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-[11px] font-mono text-gray-500">
          {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
          {showOnlyFlagged && ' · flagged only'}
        </p>
      )}

      {/* Queue */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 h-28 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 font-medium">
              {search || examFilter !== 'all' || statusFilter !== 'all' || showOnlyFlagged
                ? 'No submissions match your filters'
                : 'No graded submissions to review'
              }
            </p>
            <p className="text-xs text-gray-500 mt-1">Grade some submissions first</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(sub => {
            const rev  = sub._review;
            const pct  = sub.percentage ?? 0;
            const pri  = priorityLabel(rev.priorityScore);

            return (
              <div
                key={sub.id}
                className="group rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 overflow-hidden"
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Priority badge + indicator */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
                    <Badge className={`text-[10px] border px-1.5 py-0.5 ${pri.color}`}>
                      {pri.label}
                    </Badge>
                    {rev.isComplete && (
                      <Lock className="h-3 w-3 text-emerald-400/50" />
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0 grid md:grid-cols-3 gap-3">
                    {/* Student + exam */}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{sub.studentName}</p>
                      <p className="text-xs text-gray-600 truncate">{sub.exam?.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {sub.studentId && (
                          <span className="text-[10px] font-mono text-gray-500">#{sub.studentId}</span>
                        )}
                        <span className="text-[10px] text-gray-500">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </span>
                        {rev.hasOverride && (
                          <span className="text-[10px] bg-blue-400/10 text-blue-400 border border-blue-400/20 px-1 py-0.5 rounded font-mono">
                            Overridden
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score + progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-mono">Score</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-sm font-bold ${scoreColor(pct)}`}>
                            {sub.totalScore?.toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-500">/{sub.maxScore?.toFixed(0)}</span>
                          <span className={`text-[10px] font-mono ml-1 ${scoreColor(pct)}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-1 rounded-full bg-gray-200">
                        <div className={`h-full rounded-full ${scoreBarColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-mono">Review</span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {rev.total - rev.pending}/{rev.total}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full transition-all ${
                            rev.isComplete ? 'bg-emerald-400' : 'bg-amber-400/50'
                          }`}
                          style={{ width: `${rev.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Decision breakdown + flags */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-gray-500">Decisions</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { icon: ThumbsUp,   count: rev.accepted, color: 'text-emerald-400' },
                          { icon: ThumbsDown, count: rev.rejected, color: 'text-red-400'     },
                          { icon: HelpCircle, count: rev.disputed, color: 'text-purple-400'  },
                          { icon: Clock,      count: rev.pending,  color: 'text-gray-400'   },
                        ].map(({ icon: Icon, count, color }, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <Icon className={`h-3 w-3 ${color}`} />
                            <span className={`text-xs font-bold font-mono ${color}`}>{count}</span>
                          </div>
                        ))}
                      </div>

                      {/* Flags row */}
                      <div className="flex gap-2 flex-wrap">
                        {rev.flagged > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-full font-mono">
                            <Flag className="h-2.5 w-2.5" />{rev.flagged} flagged
                          </span>
                        )}
                        {rev.lowOcr > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-red-400/70 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded-full font-mono">
                            <AlertTriangle className="h-2.5 w-2.5" />{rev.lowOcr} low OCR
                          </span>
                        )}
                        {rev.isComplete && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full font-mono">
                            <CheckCircle className="h-2.5 w-2.5" /> Complete
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
                    <Button
                      onClick={() => setReviewTarget(sub)}
                      className={`h-9 px-4 text-xs font-semibold gap-1.5 ${
                        rev.isComplete
                          ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                          : 'bg-amber-400 hover:bg-amber-300 text-black'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {rev.isComplete ? 'View' : rev.pending === rev.total ? 'Start Review' : 'Continue'}
                      <ChevronRight className="h-3 w-3 opacity-60" />
                    </Button>
                    {!rev.isComplete && rev.pending === 0 && (
                      <p className="text-[10px] text-emerald-400 font-mono">Ready to finalise</p>
                    )}
                  </div>
                </div>

                {/* Bottom progress strip */}
                <div className="h-0.5 bg-gray-200">
                  <div
                    className={`h-full transition-all duration-500 ${
                      rev.isComplete ? 'bg-emerald-400/50' : 'bg-amber-400/30'
                    }`}
                    style={{ width: `${rev.progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}