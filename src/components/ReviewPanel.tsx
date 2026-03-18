'use client';

/**
 * ReviewPanel
 * Full-screen review interface for a single student submission.
 *
 * Features:
 *  • Side-by-side student answer vs model answer
 *  • Per-answer: Accept / Reject+Override / Dispute
 *  • Score slider with live preview
 *  • Handwritten image viewer
 *  • Keyword hit/miss visualization
 *  • Review note (internal) + teacher comment (shown to student)
 *  • Batch: Accept All / Accept Unflagged / Reject Flagged
 *  • Progress tracker (N of M reviewed)
 *  • Finalize & lock button with confirmation
 *  • Audit trail of review decisions
 *  • Export single-submission report
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle, XCircle, AlertTriangle, ArrowLeft, ArrowRight,
  Loader2, Lock, Download, Eye, EyeOff, RotateCcw, Flag,
  MessageSquare, Sliders, FileText, Image as ImgIcon, ChevronDown,
  ChevronUp, Check, X, HelpCircle, ThumbsUp, ThumbsDown, Minus,
  ZoomIn, ZoomOut, RotateCw, Maximize2,
} from 'lucide-react';
import type { Submission, Answer } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type Decision = 'accepted' | 'rejected' | 'disputed' | 'pending' | null;

interface ReviewState {
  [answerId: string]: {
    decision:       Decision;
    teacherScore:   number | string;
    teacherComment: string;
    reviewNote:     string;
    dirty:          boolean;
    saving:         boolean;
  };
}

interface ReviewPanelProps {
  submission: Submission;
  onClose:    () => void;
  onFinalized?: (id: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(pct: number) {
  if (pct >= 80) return 'text-emerald-400';
  if (pct >= 60) return 'text-amber-400';
  if (pct >= 40) return 'text-orange-400';
  return 'text-red-400';
}
function scoreBar(pct: number) {
  if (pct >= 80) return 'bg-emerald-400';
  if (pct >= 60) return 'bg-amber-400';
  if (pct >= 40) return 'bg-orange-400';
  return 'bg-red-400';
}
function decisionConfig(d: Decision) {
  switch (d) {
    case 'accepted': return { label: 'Accepted',  icon: ThumbsUp,   bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', text: 'text-emerald-400' };
    case 'rejected': return { label: 'Rejected',  icon: ThumbsDown, bg: 'bg-red-400/10',     border: 'border-red-400/30',     text: 'text-red-400'     };
    case 'disputed': return { label: 'Disputed',  icon: HelpCircle, bg: 'bg-purple-400/10',  border: 'border-purple-400/30',  text: 'text-purple-400'  };
    default:         return { label: 'Pending',   icon: Minus,      bg: 'bg-white/[0.03]',   border: 'border-white/[0.08]',   text: 'text-slate-500'   };
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReviewPanel({ submission, onClose, onFinalized }: ReviewPanelProps) {
  // Init review state from existing data
  const [state, setState] = useState<ReviewState>(() => {
    const init: ReviewState = {};
    for (const a of submission.answers ?? []) {
      init[a.id] = {
        decision:       (a.reviewDecision as Decision) ?? null,
        teacherScore:   a.teacherScore ?? a.finalScore ?? 0,
        teacherComment: a.teacherComment ?? '',
        reviewNote:     (a as any).reviewNote ?? '',
        dirty:          false,
        saving:         false,
      };
    }
    return init;
  });

  const [activeIndex, setActiveIndex]   = useState(0);
  const [showImage, setShowImage]       = useState(true);
  const [showModel, setShowModel]       = useState(true);
  const [showAudit, setShowAudit]       = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalNote, setFinalNote]       = useState('');
  const [finalizing, setFinalizing]     = useState(false);
  const [bulkLoading, setBulkLoading]   = useState<'accept_all' | 'reject_flagged' | 'accept_unflagged' | null>(null);
  const [imgZoom, setImgZoom]           = useState(1);
  const [imgRotate, setImgRotate]       = useState(0);
  const [imgFullscreen, setImgFullscreen] = useState(false);
  const [auditTrail, setAuditTrail]     = useState<
    { ts: string; action: string; answerId: string; detail: string }[]
  >([]);

  const answers = submission.answers ?? [];
  const currentAnswer: Answer | undefined = answers[activeIndex];

  // ── Derived stats ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total    = answers.length;
    const accepted = Object.values(state).filter(s => s.decision === 'accepted').length;
    const rejected = Object.values(state).filter(s => s.decision === 'rejected').length;
    const disputed = Object.values(state).filter(s => s.decision === 'disputed').length;
    const pending  = total - accepted - rejected - disputed;
    const flagged  = answers.filter(a => a.needsReview).length;

    // Live total with overrides
    const liveScore = answers.reduce((acc, a) => {
      const s = state[a.id];
      return acc + (s ? Number(s.teacherScore) || 0 : (a.finalScore ?? 0));
    }, 0);
    const maxScore  = answers.reduce((acc, a) => acc + a.maxMarks, 0);
    const livePct   = maxScore > 0 ? (liveScore / maxScore) * 100 : 0;

    return { total, accepted, rejected, disputed, pending, flagged, liveScore, maxScore, livePct };
  }, [state, answers]);

  // ── Update one field in review state ─────────────────────────────
  const update = useCallback((id: string, patch: Partial<ReviewState[string]>) =>
    setState(prev => ({ ...prev, [id]: { ...prev[id], ...patch, dirty: true } })),
    []
  );

  // ── Save decision to server ───────────────────────────────────────
  const saveDecision = useCallback(async (answerId: string, decision: Decision) => {
    const s = state[answerId];
    if (!s) return;
    update(answerId, { saving: true, dirty: false });

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:         'decision',
          submissionId:   submission.id,
          answerId,
          decision,
          teacherScore:   s.teacherScore !== '' ? Number(s.teacherScore) : null,
          teacherComment: s.teacherComment || null,
          reviewNote:     s.reviewNote    || null,
        }),
      });

      if (res.ok) {
        update(answerId, { decision, saving: false });
        setAuditTrail(p => [
          {
            ts:       new Date().toLocaleTimeString(),
            action:   decision ?? 'pending',
            answerId,
            detail:   `Q${answers.find(a => a.id === answerId)?.questionNumber} → ${decision}${
              s.teacherScore !== '' ? `, score: ${s.teacherScore}` : ''
            }`,
          },
          ...p,
        ]);
      } else {
        update(answerId, { saving: false, dirty: true });
      }
    } catch {
      update(answerId, { saving: false, dirty: true });
    }
  }, [state, submission.id, answers, update]);

  // Quick-decision helpers
  const accept  = (id: string) => saveDecision(id, 'accepted');
  const reject  = (id: string) => saveDecision(id, 'rejected');
  const dispute = (id: string) => saveDecision(id, 'disputed');

  // ── Bulk actions ──────────────────────────────────────────────────
  const bulk = async (mode: 'accept_all' | 'reject_flagged' | 'accept_unflagged') => {
    setBulkLoading(mode);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk', submissionId: submission.id, mode }),
      });
      if (res.ok) {
        const { affected } = await res.json();
        // Update local state to reflect bulk change
        setState(prev => {
          const next = { ...prev };
          for (const a of answers) {
            const shouldUpdate =
              mode === 'accept_all'       ? (!next[a.id]?.decision || next[a.id]?.decision === 'pending') :
              mode === 'reject_flagged'   ? a.needsReview :
              /* accept_unflagged */        !a.needsReview;
            if (shouldUpdate) {
              next[a.id] = {
                ...next[a.id],
                decision: mode === 'reject_flagged' ? 'rejected' : 'accepted',
                dirty: false,
              };
            }
          }
          return next;
        });
        setAuditTrail(p => [{
          ts: new Date().toLocaleTimeString(),
          action: mode,
          answerId: 'bulk',
          detail: `Bulk: ${mode.replace('_', ' ')} — ${affected} answer(s)`,
        }, ...p]);
      }
    } finally { setBulkLoading(null); }
  };

  // ── Finalize ──────────────────────────────────────────────────────
  const finalize = async () => {
    setFinalizing(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          submissionId: submission.id,
          reviewerNote: finalNote || null,
        }),
      });
      if (res.ok) {
        onFinalized?.(submission.id);
        onClose();
      }
    } finally { setFinalizing(false); setFinalizeOpen(false); }
  };

  // ── Export report ─────────────────────────────────────────────────
  const exportReport = () => {
    const lines: string[] = [
      `GRADE AI — REVIEW REPORT`,
      `================================`,
      `Student:  ${submission.studentName}`,
      `ID:       ${submission.studentId ?? '—'}`,
      `Exam:     ${submission.exam?.title ?? '—'}`,
      `Subject:  ${submission.exam?.subject ?? '—'}`,
      `Date:     ${new Date(submission.submittedAt).toLocaleDateString()}`,
      `Score:    ${stats.liveScore.toFixed(1)} / ${stats.maxScore} (${stats.livePct.toFixed(1)}%)`,
      ``,
      `ANSWER BREAKDOWN`,
      `----------------`,
      ...answers.map(a => {
        const s = state[a.id];
        return [
          `Q${a.questionNumber}: ${a.question?.questionText ?? ''}`,
          `  AI Score:       ${(a.finalScore ?? 0).toFixed(1)} / ${a.maxMarks}`,
          `  Teacher Score:  ${s?.teacherScore ?? a.finalScore ?? 0}`,
          `  Decision:       ${s?.decision ?? 'pending'}`,
          s?.teacherComment ? `  Comment:        ${s.teacherComment}` : '',
          s?.reviewNote     ? `  Internal Note:  ${s.reviewNote}` : '',
          ``,
        ].filter(Boolean).join('\n');
      }),
      ``,
      `AUDIT TRAIL`,
      `-----------`,
      ...auditTrail.map(e => `${e.ts}  ${e.detail}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a    = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `review-${submission.studentName.replace(/\s+/g, '-')}.txt`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  // ── Keyboard navigation ───────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && activeIndex < answers.length - 1) setActiveIndex(p => p + 1);
      if (e.key === 'ArrowLeft'  && activeIndex > 0)                  setActiveIndex(p => p - 1);
      if (e.key === 'a' && currentAnswer) accept(currentAnswer.id);
      if (e.key === 'r' && currentAnswer) reject(currentAnswer.id);
      if (e.key === 'd' && currentAnswer) dispute(currentAnswer.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, answers.length, currentAnswer]);

  if (!currentAnswer) return null;

  const cur    = state[currentAnswer.id];
  const dcfg   = decisionConfig(cur?.decision ?? null);
  const aiPct  = currentAnswer.maxMarks > 0 ? ((currentAnswer.finalScore ?? 0) / currentAnswer.maxMarks) * 100 : 0;
  const nowPct = currentAnswer.maxMarks > 0 ? (Number(cur?.teacherScore ?? 0) / currentAnswer.maxMarks) * 100 : 0;

  let keywordsFound: string[] = [];
  let keywordsMissed: string[] = [];
  try { keywordsFound  = JSON.parse(currentAnswer.keyPointsFound  ?? '[]'); } catch {}
  try { keywordsMissed = JSON.parse(currentAnswer.keyPointsMissed ?? '[]'); } catch {}

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="h-14 border-b border-gray-200 bg-white flex items-center px-5 gap-4 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-gray-600 hover:text-black transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-black truncate">{submission.studentName}</span>
          <span className="text-gray-500 text-sm">/</span>
          <span className="text-sm text-gray-600 truncate">{submission.exam?.title}</span>
          {submission.studentId && (
            <span className="text-[10px] font-mono text-gray-500">#{submission.studentId}</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex-1 hidden md:flex items-center gap-3 max-w-xs">
          <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400/70 transition-all duration-300"
              style={{ width: `${(stats.total > 0 ? (stats.total - stats.pending) / stats.total : 0) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">
            {stats.total - stats.pending}/{stats.total}
          </span>
        </div>

        {/* Live score */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50">
          <span className="text-[10px] text-gray-500 font-mono">LIVE</span>
          <span className={`text-sm font-bold ${scoreColor(stats.livePct)}`}>
            {stats.liveScore.toFixed(1)}/{stats.maxScore}
          </span>
          <span className={`text-[10px] font-mono ${scoreColor(stats.livePct)}`}>
            {stats.livePct.toFixed(0)}%
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={exportReport}
            className="h-8 px-2.5 text-xs text-gray-600 hover:text-black hover:bg-gray-100 gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button
            onClick={() => setFinalizeOpen(true)}
            disabled={stats.pending > 0}
            className={`h-8 px-3 text-xs font-semibold gap-1.5 ${
              stats.pending === 0
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Lock className="h-3 w-3" />
            {stats.pending === 0 ? 'Finalise Review' : `${stats.pending} pending`}
          </Button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ══ LEFT SIDEBAR: Answer navigation ══════════════════════════ */}
        <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col hidden md:flex">
          {/* Bulk actions */}
          <div className="p-3 border-b border-gray-200 space-y-1.5">
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-500 mb-2">Bulk Actions</p>
            {[
              { label: 'Accept All',       mode: 'accept_all'      as const, color: 'text-emerald-400 hover:bg-emerald-400/10' },
              { label: 'Accept Unflagged', mode: 'accept_unflagged' as const, color: 'text-blue-400 hover:bg-blue-400/10'     },
              { label: 'Reject Flagged',   mode: 'reject_flagged'  as const, color: 'text-red-400 hover:bg-red-400/10'        },
            ].map(({ label, mode, color }) => (
              <button
                key={mode}
                onClick={() => bulk(mode)}
                disabled={bulkLoading === mode}
                className={`w-full text-left text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors ${color} disabled:opacity-50`}
              >
                {bulkLoading === mode ? '…' : label}
              </button>
            ))}
          </div>

          {/* Answer list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-500 px-2 pb-1">Questions</p>
            {answers.map((a, i) => {
              const s   = state[a.id];
              const cfg = decisionConfig(s?.decision ?? null);
              const isActive = i === activeIndex;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                    isActive ? 'bg-white border border-gray-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <span className={`text-[10px] font-mono flex-shrink-0 ${isActive ? 'text-black' : 'text-gray-600'}`}>
                    Q{a.questionNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${isActive ? 'text-black' : 'text-gray-600'}`}>
                      {a.question?.questionText?.substring(0, 28) ?? `Question ${a.questionNumber}`}…
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[10px] font-mono ${cfg.text}`}>{cfg.label}</span>
                      {a.needsReview && <Flag className="h-2.5 w-2.5 text-orange-400" />}
                      {a.confidenceLevel === 'low' && (
                        <span className="text-[9px] text-red-400/60 font-mono">low OCR</span>
                      )}
                    </div>
                  </div>
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                    s?.decision === 'accepted' ? 'bg-emerald-400' :
                    s?.decision === 'rejected' ? 'bg-red-400' :
                    s?.decision === 'disputed' ? 'bg-purple-400' : 'bg-gray-300'
                  }`} />
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="p-3 border-t border-gray-200 space-y-1">
            <p className="text-[9px] font-mono text-gray-500 mb-1.5">Keyboard shortcuts</p>
            {[
              { key: 'A', label: 'Accept' },
              { key: 'R', label: 'Reject' },
              { key: 'D', label: 'Dispute' },
              { key: '← →', label: 'Navigate' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">{label}</span>
                <kbd className="text-[9px] font-mono bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded text-gray-600">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* ══ MAIN PANEL: Current answer review ════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Answer header */}
          <div className="flex-shrink-0 px-5 py-3 border-b border-gray-200 flex items-center gap-4">
            {/* Prev / Next */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setActiveIndex(p => Math.max(0, p - 1))}
                disabled={activeIndex === 0}
                className="h-7 w-7 p-0 text-gray-500 hover:text-black hover:bg-gray-100">
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-mono text-gray-500">{activeIndex + 1}/{answers.length}</span>
              <Button variant="ghost" size="sm" onClick={() => setActiveIndex(p => Math.min(answers.length - 1, p + 1))}
                disabled={activeIndex === answers.length - 1}
                className="h-7 w-7 p-0 text-gray-500 hover:text-black hover:bg-gray-100">
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <span className="text-[10px] font-mono bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded">
              Q{currentAnswer.questionNumber}
            </span>

            <p className="text-sm text-gray-700 flex-1 min-w-0 truncate">
              {currentAnswer.question?.questionText ?? `Question ${currentAnswer.questionNumber}`}
            </p>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {currentAnswer.needsReview && (
                <Badge className="bg-orange-400/10 text-orange-400 border-orange-400/20 text-[10px] gap-1">
                  <Flag className="h-2.5 w-2.5" /> Flagged
                </Badge>
              )}
              {currentAnswer.confidenceLevel && (
                <Badge className={`text-[10px] border ${
                  currentAnswer.confidenceLevel === 'high'   ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                  currentAnswer.confidenceLevel === 'medium' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                  'bg-red-400/10 text-red-400 border-red-400/20'
                }`}>
                  OCR: {currentAnswer.confidenceLevel}
                </Badge>
              )}
              <span className="text-[11px] font-mono text-slate-500">{currentAnswer.maxMarks}m</span>
            </div>
          </div>

          {/* Answer body — scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* ── Decision buttons ─────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mr-2">Decision:</p>

              {(
                [
                  { d: 'accepted' as Decision, label: 'Accept',  icon: ThumbsUp,   color: 'bg-emerald-400/10 hover:bg-emerald-400/20 border-emerald-400/30 text-emerald-400', active: 'bg-emerald-400 text-black border-emerald-400' },
                  { d: 'rejected' as Decision, label: 'Reject',  icon: ThumbsDown, color: 'bg-red-400/10 hover:bg-red-400/20 border-red-400/30 text-red-400',               active: 'bg-red-400 text-black border-red-400' },
                  { d: 'disputed' as Decision, label: 'Dispute', icon: HelpCircle, color: 'bg-purple-400/10 hover:bg-purple-400/20 border-purple-400/30 text-purple-400',    active: 'bg-purple-400 text-black border-purple-400' },
                ] as const
              ).map(({ d, label, icon: Icon, color, active }) => {
                const isActive = cur?.decision === d;
                return (
                  <button
                    key={d}
                    onClick={() => isActive ? saveDecision(currentAnswer.id, 'pending') : saveDecision(currentAnswer.id, d)}
                    disabled={cur?.saving}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      isActive ? active : color
                    } disabled:opacity-50`}
                  >
                    {cur?.saving && isActive
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Icon className="h-3.5 w-3.5" />
                    }
                    {label}
                    {isActive && <Check className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}

              {/* Current state pill */}
              <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${dcfg.bg} ${dcfg.border} ${dcfg.text}`}>
                <dcfg.icon className="h-3 w-3" />
                {dcfg.label}
              </div>
            </div>

            {/* ── Score override ───────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-amber-400" />
                  Score Override
                </p>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-slate-500">AI: <span className="text-amber-400">{(currentAnswer.finalScore ?? 0).toFixed(1)}</span></span>
                  <span className="text-slate-500">Teacher: <span className={scoreColor(nowPct)}>{cur?.teacherScore ?? '—'}</span></span>
                  <span className="text-slate-500">Max: {currentAnswer.maxMarks}</span>
                </div>
              </div>

              {/* Slider */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={currentAnswer.maxMarks}
                  step={0.5}
                  value={Number(cur?.teacherScore) || 0}
                  onChange={e => update(currentAnswer.id, { teacherScore: e.target.value })}
                  className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer accent-amber-400"
                  style={{ background: `linear-gradient(to right, #fbbf24 ${nowPct}%, #e5e7eb ${nowPct}%)` }}
                />
                <Input
                  type="number"
                  value={cur?.teacherScore ?? ''}
                  onChange={e => update(currentAnswer.id, { teacherScore: e.target.value })}
                  min={0}
                  max={currentAnswer.maxMarks}
                  step={0.5}
                  className="w-16 h-7 text-center text-xs bg-white border border-gray-300 text-amber-600 font-mono"
                />
              </div>

              {/* AI vs teacher visual diff */}
              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div className="text-center">
                  <div className="flex justify-between text-gray-500 mb-2">
                    <span>AI Score</span>
                  </div>
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle 
                        cx="32" 
                        cy="32" 
                        r="24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="6" 
                        className="text-gray-200" 
                      />
                      <circle 
                        cx="32" 
                        cy="32" 
                        r="24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="6"
                        strokeLinecap="round"
                        className={`${scoreBar(aiPct).replace('bg-', 'text-')}`}
                        style={{
                          strokeDasharray: `${(aiPct / 100) * 150.8} 150.8`,
                          transition: 'stroke-dasharray 0.3s ease'
                        }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-sm font-bold ${scoreBar(aiPct).replace('bg-', 'text-')}`}>
                        {aiPct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex justify-between text-gray-500 mb-2">
                    <span>Teacher Score</span>
                  </div>
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle 
                        cx="32" 
                        cy="32" 
                        r="24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="6" 
                        className="text-gray-200" 
                      />
                      <circle 
                        cx="32" 
                        cy="32" 
                        r="24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="6"
                        strokeLinecap="round"
                        className={`${scoreBar(nowPct).replace('bg-', 'text-')}`}
                        style={{
                          strokeDasharray: `${(nowPct / 100) * 150.8} 150.8`,
                          transition: 'stroke-dasharray 0.3s ease'
                        }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-sm font-bold ${scoreBar(nowPct).replace('bg-', 'text-')}`}>
                        {nowPct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Score metrics */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { label: 'Similarity', val: `${((currentAnswer.similarityScore ?? 0) * 100).toFixed(0)}%`, bar: (currentAnswer.similarityScore ?? 0) * 100, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
                  { label: 'Keywords',   val: `${((currentAnswer.keywordScore   ?? 0) * 100).toFixed(0)}%`, bar: (currentAnswer.keywordScore   ?? 0) * 100, color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
                  { label: 'Final',      val: `${aiPct.toFixed(0)}%`,                                        bar: aiPct,                                     color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
                ].map(({ label, val, bar, color, bgColor }) => (
                  <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <p className="text-[9px] text-gray-500 font-mono mb-2">{label}</p>
                    <div className="relative w-12 h-12 mx-auto mb-2">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                        <circle 
                          cx="24" 
                          cy="24" 
                          r="18" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="4" 
                          className="text-gray-200" 
                        />
                        <circle 
                          cx="24" 
                          cy="24" 
                          r="18" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="4"
                          strokeLinecap="round"
                          className={`${color}`}
                          style={{
                            strokeDasharray: `${(bar / 100) * 113.1} 113.1`,
                            transition: 'stroke-dasharray 0.3s ease'
                          }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-xs font-bold ${color}`}>
                          {Math.round(bar)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-700">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Texts: Student Answer + Model Answer ─────────────── */}
            <div className="grid gap-3" style={{ gridTemplateColumns: showModel ? '1fr 1fr' : '1fr' }}>
              {/* Student answer */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                  <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Student Answer</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
                    {currentAnswer.recognizedText?.split(/\s+/).filter(Boolean).length ?? 0} words
                  </div>
                </div>
                <div className="p-3 max-h-52 overflow-y-auto">
                  {currentAnswer.recognizedText ? (
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {currentAnswer.recognizedText}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No text extracted</p>
                  )}
                </div>
              </div>

              {/* Model answer */}
              {showModel && (
                <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-400/[0.08]">
                    <p className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest">Model Answer</p>
                    <button onClick={() => setShowModel(false)} className="text-gray-600 hover:text-gray-400">
                      <EyeOff className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="p-3 max-h-52 overflow-y-auto">
                    <p className="text-xs text-green-700 leading-relaxed whitespace-pre-wrap">
                      {currentAnswer.modelAnswer ?? 'No model answer provided'}
                    </p>
                  </div>
                </div>
              )}
              {!showModel && (
                <button onClick={() => setShowModel(true)} className="text-xs text-gray-600 hover:text-gray-400 text-left flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Show model answer
                </button>
              )}
            </div>

            {/* ── Keywords ─────────────────────────────────────────── */}
            {(keywordsFound.length > 0 || keywordsMissed.length > 0) && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs font-semibold text-slate-300 mb-3">Keyword Analysis</p>
                <div className="flex flex-wrap gap-1.5">
                  {keywordsFound.map((kw, i) => (
                    <span key={`f${i}`} className="flex items-center gap-1 text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-2 py-0.5 rounded-full font-mono">
                      <CheckCircle className="h-2.5 w-2.5" />{kw}
                    </span>
                  ))}
                  {keywordsMissed.map((kw, i) => (
                    <span key={`m${i}`} className="flex items-center gap-1 text-[10px] bg-red-400/10 text-red-400 border border-red-400/20 px-2 py-0.5 rounded-full font-mono">
                      <XCircle className="h-2.5 w-2.5" />{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── AI Feedback ──────────────────────────────────────── */}
            {currentAnswer.feedback && (
              <div className="rounded-xl border border-blue-400/10 bg-blue-400/[0.03] p-4">
                <p className="text-[10px] font-mono text-blue-400/60 uppercase tracking-widest mb-2">AI Feedback</p>
                <p className="text-xs text-black leading-relaxed">{currentAnswer.feedback}</p>
              </div>
            )}

            {/* ── Handwritten image viewer ──────────────────────────── */}
            {currentAnswer.handwrittenImagePath && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                  <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                    <ImgIcon className="h-3 w-3" /> Handwritten Image
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setImgZoom(p => Math.max(0.5, p - 0.25))} className="h-6 w-6 flex items-center justify-center rounded text-gray-500">
                      <ZoomOut className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] font-mono text-gray-500 w-8 text-center">{Math.round(imgZoom * 100)}%</span>
                    <button onClick={() => setImgZoom(p => Math.min(3, p + 0.25))} className="h-6 w-6 flex items-center justify-center rounded text-gray-500">
                      <ZoomIn className="h-3 w-3" />
                    </button>
                    <button onClick={() => setImgRotate(p => (p + 90) % 360)} className="h-6 w-6 flex items-center justify-center rounded text-gray-500">
                      <RotateCw className="h-3 w-3" />
                    </button>
                    <button onClick={() => setImgFullscreen(p => !p)} className="h-6 w-6 flex items-center justify-center rounded text-gray-500">
                      <Maximize2 className="h-3 w-3" />
                    </button>
                    <button onClick={() => setShowImage(p => !p)} className="h-6 w-6 flex items-center justify-center rounded text-gray-500">
                      {showImage ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
                {showImage && (
                  <div className={`overflow-auto ${imgFullscreen ? 'fixed inset-4 z-50 bg-[#060709] rounded-xl border border-white/[0.1] p-4' : 'max-h-80'}`}>
                    {imgFullscreen && (
                      <button onClick={() => setImgFullscreen(false)} className="absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <img
                      src={`/api/files/${currentAnswer.handwrittenImagePath}`}
                      alt="Handwritten answer"
                      style={{
                        transform: `scale(${imgZoom}) rotate(${imgRotate}deg)`,
                        transformOrigin: 'top left',
                        transition: 'transform 0.2s ease',
                      }}
                      className="max-w-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Teacher comment & review note ─────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.02] p-4 space-y-2">
                <Label className="text-[10px] font-mono text-amber-400/60 uppercase tracking-widest flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" /> Teacher Comment
                  <span className="text-slate-600 normal-case tracking-normal ml-0.5">(visible to student)</span>
                </Label>
                <Textarea
                  value={cur?.teacherComment ?? ''}
                  onChange={e => update(currentAnswer.id, { teacherComment: e.target.value })}
                  placeholder="Write feedback for the student…"
                  rows={3}
                  className="bg-white/[0.03] border-white/[0.08] text-slate-200 text-xs resize-none focus:border-amber-400/40 leading-relaxed"
                />
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-white/[0.01] p-4 space-y-2">
                <Label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> Internal Note
                  <span className="normal-case tracking-normal ml-0.5">(private)</span>
                </Label>
                <Textarea
                  value={cur?.reviewNote ?? ''}
                  onChange={e => update(currentAnswer.id, { reviewNote: e.target.value })}
                  placeholder="Private notes for this review…"
                  rows={3}
                  className="bg-white/[0.03] border-white/[0.08] text-slate-400 text-xs resize-none focus:border-slate-600 leading-relaxed"
                />
              </div>
            </div>

            {/* Save button if unsaved changes */}
            {cur?.dirty && (
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => saveDecision(currentAnswer.id, cur?.decision ?? null)}
                  disabled={cur?.saving}
                  size="sm"
                  className="h-8 px-4 bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold gap-1.5"
                >
                  {cur?.saving
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                    : <><Check className="h-3 w-3" /> Save Changes</>
                  }
                </Button>
              </div>
            )}

            {/* ── Audit trail ──────────────────────────────────────── */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
              <button
                onClick={() => setShowAudit(p => !p)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <RotateCcw className="h-3 w-3" /> Review Audit Trail
                  {auditTrail.length > 0 && (
                    <span className="bg-white/[0.06] text-slate-500 px-1.5 py-0.5 rounded-full text-[10px] font-mono">
                      {auditTrail.length}
                    </span>
                  )}
                </span>
                {showAudit ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showAudit && (
                <div className="border-t border-white/[0.05] p-3 max-h-36 overflow-y-auto space-y-1">
                  {auditTrail.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">No review actions recorded yet.</p>
                  ) : (
                    auditTrail.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px]">
                        <span className="text-slate-600 font-mono flex-shrink-0">{e.ts}</span>
                        <span className={`font-mono flex-shrink-0 ${
                          e.action === 'accepted'        ? 'text-emerald-400' :
                          e.action === 'rejected'        ? 'text-red-400' :
                          e.action === 'disputed'        ? 'text-purple-400' :
                          e.action.startsWith('accept_') ? 'text-emerald-400/60' :
                          e.action.startsWith('reject_') ? 'text-red-400/60' :
                          'text-slate-500'
                        }`}>{e.action}</span>
                        <span className="text-slate-500 truncate">{e.detail}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ RIGHT SIDEBAR: Summary ════════════════════════════════════ */}
        <div className="w-48 flex-shrink-0 border-l border-gray-200 bg-white p-4 flex flex-col gap-4 hidden lg:flex overflow-y-auto">
          {/* Score ring */}
          <div className="text-center">
            <div className="relative h-20 w-20 mx-auto">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="7" className="text-gray-200" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${stats.livePct * 2.136} 213.6`}
                  className={scoreColor(stats.livePct)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-sm font-bold ${scoreColor(stats.livePct)}`}>{stats.livePct.toFixed(0)}%</span>
              </div>
            </div>
            <p className={`text-xs font-bold mt-1 ${scoreColor(stats.livePct)}`}>
              {stats.liveScore.toFixed(1)}/{stats.maxScore}
            </p>
            <p className="text-[10px] text-gray-500 font-mono">live score</p>
          </div>

          {/* Decision counts */}
          <div className="space-y-2">
            <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-gray-500">Review Progress</p>
            {[
              { label: 'Accepted', count: stats.accepted, color: 'text-emerald-400', dot: 'bg-emerald-400' },
              { label: 'Rejected', count: stats.rejected, color: 'text-red-400',     dot: 'bg-red-400'     },
              { label: 'Disputed', count: stats.disputed, color: 'text-purple-400',  dot: 'bg-purple-400'  },
              { label: 'Pending',  count: stats.pending,  color: 'text-slate-500',   dot: 'bg-slate-600'   },
            ].map(({ label, count, color, dot }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                  <span className="text-[11px] text-gray-500">{label}</span>
                </div>
                <span className={`text-xs font-bold font-mono ${color}`}>{count}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200" />

          {/* Flags */}
          <div className="space-y-2">
            <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-gray-500">Flags</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 flex items-center gap-1"><Flag className="h-3 w-3 text-orange-400" /> Flagged</span>
              <span className="text-xs font-bold font-mono text-orange-400">{stats.flagged}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Low OCR</span>
              <span className="text-xs font-bold font-mono text-red-400">
                {answers.filter(a => a.confidenceLevel === 'low').length}
              </span>
            </div>
          </div>

          <div className="mt-auto">
            <Button
              onClick={() => setFinalizeOpen(true)}
              disabled={stats.pending > 0}
              className={`w-full h-8 text-xs font-semibold gap-1.5 ${
                stats.pending === 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                  : 'bg-white/[0.05] text-slate-600 cursor-not-allowed'
              }`}
            >
              <Lock className="h-3 w-3" />
              {stats.pending === 0 ? 'Finalise' : `${stats.pending} left`}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Finalize dialog ──────────────────────────────────────────── */}
      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent className="bg-white border-gray-200 text-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400" /> Finalise Review
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This locks the review for{' '}
              <strong className="text-black">{submission.studentName}</strong>.
              All pending answers will be auto-accepted. Final score:{' '}
              <strong className={scoreColor(stats.livePct)}>{stats.liveScore.toFixed(1)}/{stats.maxScore} ({stats.livePct.toFixed(0)}%)</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="px-1 py-2 space-y-1.5">
            <Label className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              Reviewer Note (optional)
            </Label>
            <Textarea
              value={finalNote}
              onChange={e => setFinalNote(e.target.value)}
              placeholder="Add a note about this review…"
              rows={2}
              className="bg-gray-50 border-gray-300 text-black text-xs resize-none"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizing} className="border-gray-300 text-gray-600 hover:bg-gray-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={finalize}
              disabled={finalizing}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold gap-1.5"
            >
              {finalizing
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finalising…</>
                : <><Lock className="h-3.5 w-3.5" /> Confirm & Lock</>
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}