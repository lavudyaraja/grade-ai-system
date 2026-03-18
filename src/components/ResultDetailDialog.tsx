'use client';

/**
 * ResultDetailDialog
 *
 * Features:
 *  • White background, no shadows or glow effects
 *  • Grade letter + performance band
 *  • Circular score ring (SVG, no glow)
 *  • Per-question expandable cards
 *  • Answer image viewer (handwritten image)
 *  • Similarity + keyword progress bars
 *  • Key points found / missed
 *  • AI feedback
 *  • Teacher override display
 *  • Copy all results to clipboard
 *  • Print report
 *  • Export to CSV
 *  • Tab: Summary / Answers / Feedback
 *  • Answer status chips
 */

import { useState, useCallback }   from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import {
  X, Copy, Check, Printer, Download, ChevronDown, ChevronUp,
  FileText, Target, User, Calendar, CheckCircle, AlertTriangle,
  TrendingUp, Award, Eye, EyeOff, Image as ImgIcon,
  BarChart3, MessageSquare, BookOpen,
} from 'lucide-react';
import type { Submission } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResultDetailDialogProps {
  open:       boolean;
  submission: Submission | null;
  onClose:    () => void;
}

type ActiveTab = 'summary' | 'answers' | 'feedback';

// ── Grade helpers ─────────────────────────────────────────────────────────────

function getGrade(p: number): string {
  if (p >= 90) return 'A+';
  if (p >= 85) return 'A';
  if (p >= 80) return 'A−';
  if (p >= 75) return 'B+';
  if (p >= 70) return 'B';
  if (p >= 65) return 'B−';
  if (p >= 60) return 'C+';
  if (p >= 55) return 'C';
  if (p >= 50) return 'C−';
  if (p >= 45) return 'D';
  return 'F';
}

function getBand(p: number): string {
  if (p >= 80) return 'Excellent';
  if (p >= 60) return 'Good';
  if (p >= 40) return 'Average';
  return 'Needs Improvement';
}

function scoreTextColor(p: number): string {
  if (p >= 80) return '#059669'; // emerald-600
  if (p >= 60) return '#d97706'; // amber-600
  if (p >= 40) return '#ea580c'; // orange-600
  return '#dc2626';              // red-600
}

function scoreBgBorder(p: number): { bg: string; border: string; text: string } {
  if (p >= 80) return { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' };
  if (p >= 60) return { bg: '#fffbeb', border: '#fde68a', text: '#92400e' };
  if (p >= 40) return { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' };
  return              { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
}

// ── Section divider ───────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: '1px', background: '#f3f4f6', margin: '0' }} />;
}

// ── Metric row (label + bar + value) ─────────────────────────────────────────
function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{value.toFixed(0)}%</span>
      </div>
      <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResultDetailDialog({ open, submission, onClose }: ResultDetailDialogProps) {
  const [activeTab, setActiveTab]           = useState<ActiveTab>('summary');
  const [expandedAnswers, setExpanded]       = useState<Set<string>>(new Set());
  const [showImages, setShowImages]          = useState<Set<string>>(new Set());
  const [copied, setCopied]                  = useState(false);

  const copyAll = useCallback(() => {
    if (!submission) return;
    const lines: string[] = [
      `RESULT REPORT`,
      `=============`,
      `Student:  ${submission.studentName}`,
      `ID:       ${submission.studentId ?? '—'}`,
      `Exam:     ${submission.exam?.title ?? '—'}`,
      `Subject:  ${submission.exam?.subject ?? '—'}`,
      `Score:    ${submission.totalScore?.toFixed(1)} / ${submission.maxScore} (${submission.percentage?.toFixed(1)}%) — ${getGrade(submission.percentage ?? 0)}`,
      `Status:   ${submission.status}`,
      `Date:     ${new Date(submission.submittedAt).toLocaleDateString()}`,
      ``,
      `ANSWERS`,
      `-------`,
      ...submission.answers?.map(a => [
        `Q${a.questionNumber}: ${a.question?.questionText ?? ''}`,
        `  Score:       ${(a.teacherScore ?? a.finalScore ?? 0).toFixed(1)} / ${a.maxMarks}`,
        `  Similarity:  ${((a.similarityScore ?? 0) * 100).toFixed(0)}%`,
        `  Keywords:    ${((a.keywordScore ?? 0) * 100).toFixed(0)}%`,
        a.feedback ? `  Feedback:    ${a.feedback}` : '',
        ``,
      ].filter(Boolean).join('\n')) ?? [],
      submission.feedback ? `\nOVERALL FEEDBACK\n----------------\n${submission.feedback}` : '',
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [submission]);

  const printReport = useCallback(() => {
    if (!submission) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html>
      <head><title>Result — ${submission.studentName}</title>
      <style>
        body { font-family: system-ui, sans-serif; font-size: 13px; color: #111; padding: 2rem; max-width: 800px; margin: auto; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
        .score { font-size: 28px; font-weight: 700; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
        .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
        .feedback { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 12px; margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th,td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
        th { background: #f9fafb; }
      </style></head><body>
      <h1>${submission.studentName}</h1>
      <p class="meta">${submission.exam?.title} · ${submission.exam?.subject} · ${new Date(submission.submittedAt).toLocaleDateString()}</p>
      <p class="score">${submission.totalScore?.toFixed(1)} / ${submission.maxScore} <span style="font-size:18px;color:#6b7280">(${submission.percentage?.toFixed(1)}%)</span></p>
      <p style="margin:4px 0 20px;font-size:14px;font-weight:600">${getGrade(submission.percentage ?? 0)} — ${getBand(submission.percentage ?? 0)}</p>
      <h2>Answer Breakdown</h2>
      <table>
        <tr><th>Q</th><th>Score</th><th>/ Max</th><th>Similarity</th><th>Keywords</th><th>Status</th></tr>
        ${submission.answers?.map(a => `
          <tr>
            <td>Q${a.questionNumber}</td>
            <td>${(a.teacherScore ?? a.finalScore ?? 0).toFixed(1)}</td>
            <td>${a.maxMarks}</td>
            <td>${((a.similarityScore ?? 0) * 100).toFixed(0)}%</td>
            <td>${((a.keywordScore ?? 0) * 100).toFixed(0)}%</td>
            <td>${a.needsReview ? 'Review' : 'OK'}</td>
          </tr>`).join('') ?? ''}
      </table>
      ${submission.feedback ? `<h2>Overall Feedback</h2><div class="feedback">${submission.feedback}</div>` : ''}
      </body></html>
    `);
    win.document.close();
    win.print();
    win.close();
  }, [submission]);

  const exportCSV = useCallback(() => {
    if (!submission) return;
    const rows = [
      ['Q#','Question','Score','Max','Similarity%','Keywords%','Needs Review','Overridden','Feedback'],
      ...submission.answers?.map(a => [
        `Q${a.questionNumber}`,
        `"${(a.question?.questionText ?? '').replace(/"/g, '""')}"`,
        (a.teacherScore ?? a.finalScore ?? 0).toFixed(1),
        a.maxMarks,
        ((a.similarityScore ?? 0) * 100).toFixed(0),
        ((a.keywordScore ?? 0) * 100).toFixed(0),
        a.needsReview ? 'Yes' : 'No',
        a.teacherScore != null ? 'Yes' : 'No',
        `"${(a.feedback ?? '').replace(/"/g, '""')}"`,
      ]) ?? [],
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `result-${submission.studentName.replace(/\s+/g, '-')}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  }, [submission]);

  if (!submission) return null;

  const pct      = submission.percentage   ?? 0;
  const total    = submission.totalScore   ?? 0;
  const maxScore = submission.maxScore     ?? 0;
  const grade    = getGrade(pct);
  const band     = getBand(pct);
  const isGraded = submission.status === 'graded';
  const answers  = submission.answers ?? [];
  const { bg: scoreBg, border: scoreBorder, text: scoreText } = scoreBgBorder(pct);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const flaggedCount   = answers.filter(a => a.needsReview).length;
  const overriddenCount = answers.filter(a => a.teacherScore != null).length;
  const avgSimilarity  = answers.length
    ? (answers.reduce((s, a) => s + (a.similarityScore ?? 0), 0) / answers.length) * 100
    : 0;
  const avgKeyword     = answers.length
    ? (answers.reduce((s, a) => s + (a.keywordScore ?? 0), 0) / answers.length) * 100
    : 0;

  // ── Expand / image toggle ──────────────────────────────────────────────────
  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleImage  = (id: string) =>
    setShowImages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{
          maxWidth: '900px',
          width:    '95vw',
          maxHeight: '94vh',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <DialogHeader style={{ padding: '20px 24px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', paddingBottom: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DialogTitle style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                {submission.studentName}
              </DialogTitle>
              <DialogDescription asChild>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
                  {[
                    { icon: FileText, text: submission.exam?.title ?? '—' },
                    { icon: Target,   text: submission.exam?.subject ?? '—' },
                    ...(submission.studentId ? [{ icon: User, text: `ID: ${submission.studentId}` }] : []),
                    { icon: Calendar, text: new Date(submission.submittedAt).toLocaleDateString() },
                  ].map(({ icon: Icon, text }, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                      {text}
                    </span>
                  ))}
                </div>
              </DialogDescription>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* Close */}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0', marginTop: '4px' }}>
            {([
              { id: 'summary',  label: 'Summary',   icon: BarChart3 },
              { id: 'answers',  label: 'Answers',   icon: BookOpen },
              { id: 'feedback', label: 'Feedback',  icon: MessageSquare },
            ] as { id: ActiveTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', fontSize: '13px', fontWeight: 500,
                  borderBottom: activeTab === id ? '2px solid #111827' : '2px solid transparent',
                  color:        activeTab === id ? '#111827' : '#9ca3af',
                  background: 'transparent',
                  borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.12s',
                }}
              >
                <Icon style={{ width: '13px', height: '13px' }} />
                {label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* ══ SUMMARY TAB ════════════════════════════════════════════ */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Score card */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Ring */}
                  <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
                    <svg viewBox="0 0 110 110" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle cx="55" cy="55" r="46" fill="none" stroke="#f3f4f6" strokeWidth="9" />
                      <circle
                        cx="55" cy="55" r="46"
                        fill="none" stroke={scoreTextColor(pct)} strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={`${pct * 2.89} 289`}
                      />
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: scoreTextColor(pct), lineHeight: 1 }}>
                        {pct.toFixed(0)}%
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: scoreTextColor(pct), marginTop: '2px' }}>
                        {grade}
                      </span>
                    </div>
                  </div>

                  {/* Score details */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <p style={{ fontSize: '32px', fontWeight: 700, color: scoreTextColor(pct), lineHeight: 1, margin: '0 0 8px' }}>
                      {total.toFixed(1)}
                      <span style={{ fontSize: '16px', fontWeight: 400, color: '#9ca3af', marginLeft: '6px' }}>
                        / {maxScore}
                      </span>
                    </p>

                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', borderRadius: '999px',
                      background: scoreBg, border: `1px solid ${scoreBorder}`,
                      fontSize: '12px', fontWeight: 600, color: scoreText,
                      marginBottom: '16px',
                    }}>
                      <TrendingUp style={{ width: '12px', height: '12px' }} />
                      {band} · {grade} Grade
                    </div>

                    {/* Quick stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                      {[
                        { label: 'Questions',  value: answers.length,           color: '#374151' },
                        { label: 'Flagged',    value: flaggedCount,              color: flaggedCount   > 0 ? '#d97706' : '#374151' },
                        { label: 'Overridden', value: overriddenCount,           color: overriddenCount > 0 ? '#2563eb' : '#374151' },
                        { label: 'Status',     value: isGraded ? 'Graded' : submission.status, color: isGraded ? '#059669' : '#374151' },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{
                          border: '1px solid #f3f4f6', borderRadius: '8px',
                          padding: '10px 12px', textAlign: 'center',
                          background: '#fafafa',
                        }}>
                          <p style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</p>
                          <p style={{ fontSize: '15px', fontWeight: 700, color }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Divider />

                {/* Avg metrics */}
                <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <MetricBar label="Avg Similarity Score" value={avgSimilarity} color="#3b82f6" />
                  <MetricBar label="Avg Keyword Coverage" value={avgKeyword}    color="#8b5cf6" />
                </div>
              </div>

              {/* Per-question score table */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Question Score Summary</p>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                      {['Question','Score','Max','Similarity','Keywords','Status'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {answers.map((a, idx) => {
                      const finalScore = a.teacherScore ?? a.finalScore ?? 0;
                      const qPct       = a.maxMarks > 0 ? (finalScore / a.maxMarks) * 100 : 0;
                      return (
                        <tr
                          key={a.id}
                          style={{ borderBottom: idx < answers.length - 1 ? '1px solid #f9fafb' : 'none', cursor: 'pointer' }}
                          onClick={() => { setActiveTab('answers'); toggleExpand(a.id); }}
                        >
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{
                              fontSize: '11px', fontFamily: 'monospace', fontWeight: 600,
                              background: '#fef3c7', color: '#92400e',
                              border: '1px solid #fde68a', borderRadius: '4px',
                              padding: '2px 7px',
                            }}>Q{a.questionNumber}</span>
                          </td>
                          <td style={{ padding: '9px 14px', fontWeight: 700, color: scoreTextColor(qPct) }}>
                            {finalScore.toFixed(1)}
                          </td>
                          <td style={{ padding: '9px 14px', color: '#6b7280' }}>{a.maxMarks}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '5px', background: '#f3f4f6', borderRadius: '999px', minWidth: '60px' }}>
                                <div style={{ height: '100%', width: `${(a.similarityScore ?? 0) * 100}%`, background: '#3b82f6', borderRadius: '999px' }} />
                              </div>
                              <span style={{ fontSize: '11px', color: '#6b7280', minWidth: '30px' }}>{((a.similarityScore ?? 0) * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '9px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '5px', background: '#f3f4f6', borderRadius: '999px', minWidth: '60px' }}>
                                <div style={{ height: '100%', width: `${(a.keywordScore ?? 0) * 100}%`, background: '#8b5cf6', borderRadius: '999px' }} />
                              </div>
                              <span style={{ fontSize: '11px', color: '#6b7280', minWidth: '30px' }}>{((a.keywordScore ?? 0) * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '9px 14px' }}>
                            {a.needsReview ? (
                              <span style={{ fontSize: '11px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '2px 7px', borderRadius: '4px' }}>Review</span>
                            ) : (
                              <span style={{ fontSize: '11px', background: '#f0fdf4', border: '1px solid #a7f3d0', color: '#065f46', padding: '2px 7px', borderRadius: '4px' }}>OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ ANSWERS TAB ════════════════════════════════════════════ */}
          {activeTab === 'answers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {answers.map(a => {
                const finalScore  = a.teacherScore ?? a.finalScore ?? 0;
                const qPct        = a.maxMarks > 0 ? (finalScore / a.maxMarks) * 100 : 0;
                const isExpanded  = expandedAnswers.has(a.id);
                const imgVisible  = showImages.has(a.id);
                const hasImage    = !!a.handwrittenImagePath;

                let kpFound: string[]  = [];
                let kpMissed: string[] = [];
                try { kpFound  = JSON.parse(a.keyPointsFound  ?? '[]'); } catch {}
                try { kpMissed = JSON.parse(a.keyPointsMissed ?? '[]'); } catch {}

                return (
                  <div key={a.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                    {/* Row header — always visible, click to expand */}
                    <div
                      onClick={() => toggleExpand(a.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', cursor: 'pointer',
                        background: isExpanded ? '#fafafa' : '#fff',
                        borderBottom: isExpanded ? '1px solid #f3f4f6' : 'none',
                        userSelect: 'none',
                      }}
                    >
                      {/* Q badge */}
                      <span style={{
                        fontSize: '11px', fontFamily: 'monospace', fontWeight: 700,
                        background: '#fef3c7', color: '#92400e',
                        border: '1px solid #fde68a', borderRadius: '5px',
                        padding: '3px 8px', flexShrink: 0,
                      }}>Q{a.questionNumber}</span>

                      {/* Question text */}
                      <p style={{ flex: 1, fontSize: '13px', color: '#374151', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>
                        {a.question?.questionText ?? `Question ${a.questionNumber}`}
                      </p>

                      {/* Score pill */}
                      <span style={{
                        fontSize: '13px', fontWeight: 700, color: scoreTextColor(qPct),
                        background: scoreBgBorder(qPct).bg,
                        border: `1px solid ${scoreBgBorder(qPct).border}`,
                        borderRadius: '999px', padding: '2px 10px',
                        flexShrink: 0,
                      }}>
                        {finalScore.toFixed(1)}/{a.maxMarks}
                      </span>

                      {/* Status chips */}
                      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                        {a.needsReview && (
                          <span style={{ fontSize: '10px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '2px 6px', borderRadius: '4px' }}>
                            ⚠ Review
                          </span>
                        )}
                        {a.teacherScore != null && (
                          <span style={{ fontSize: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px' }}>
                            ✓ Override
                          </span>
                        )}
                        {a.confidenceLevel && (
                          <span style={{
                            fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                            ...(a.confidenceLevel === 'high'
                              ? { background: '#f0fdf4', border: '1px solid #a7f3d0', color: '#065f46' }
                              : a.confidenceLevel === 'medium'
                              ? { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }
                              : { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }),
                          }}>
                            OCR: {a.confidenceLevel}
                          </span>
                        )}
                      </div>

                      {isExpanded
                        ? <ChevronUp  style={{ width: '15px', height: '15px', color: '#9ca3af', flexShrink: 0 }} />
                        : <ChevronDown style={{ width: '15px', height: '15px', color: '#9ca3af', flexShrink: 0 }} />
                      }
                    </div>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '400px', overflowY: 'auto' }}>
                        {/* Score bars */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                          <MetricBar label="Similarity Score" value={(a.similarityScore ?? 0) * 100} color="#3b82f6" />
                          <MetricBar label="Keyword Coverage" value={(a.keywordScore ?? 0) * 100}   color="#8b5cf6" />
                        </div>

                        {/* Image viewer */}
                        {hasImage && (
                          <div style={{ border: '1px solid #f3f4f6', borderRadius: '8px', overflow: 'hidden' }}>
                            <div
                              onClick={() => toggleImage(a.id)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 12px', background: '#fafafa', cursor: 'pointer',
                                borderBottom: imgVisible ? '1px solid #f3f4f6' : 'none',
                              }}
                            >
                              <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <ImgIcon style={{ width: '13px', height: '13px' }} />
                                Handwritten Image
                              </span>
                              <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                {imgVisible ? 'Hide' : 'Show'}
                              </span>
                            </div>
                            {imgVisible && (
                              <div style={{ padding: '12px', textAlign: 'center' }}>
                                <img
                                  src={`/api/files/${a.handwrittenImagePath}`}
                                  alt={`Q${a.questionNumber} answer`}
                                  style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain', borderRadius: '4px' }}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Student answer + model answer */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {[
                            { label: 'Student Answer', text: a.recognizedText || 'No text detected', bg: '#f9fafb', border: '#e5e7eb', color: '#374151' },
                            { label: 'Model Answer',   text: a.modelAnswer    || 'Not provided',    bg: '#f0fdf4', border: '#a7f3d0', color: '#065f46' },
                          ].map(({ label, text, bg, border, color }) => (
                            <div key={label} style={{ display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
                              <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</p>
                              <div style={{ 
                                background: bg, 
                                border: `1px solid ${border}`, 
                                borderRadius: '7px', 
                                padding: '12px', 
                                height: '100%',
                                overflowY: 'auto',
                                flex: 1
                              }}>
                                <p style={{ fontSize: '13px', color, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{text}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Key points */}
                        {(kpFound.length > 0 || kpMissed.length > 0) && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {[
                              { pts: kpFound,  label: `Found (${kpFound.length})`,  bg: '#f0fdf4', border: '#a7f3d0', mark: '✓', markColor: '#059669', textColor: '#374151' },
                              { pts: kpMissed, label: `Missed (${kpMissed.length})`, bg: '#fef2f2', border: '#fecaca', mark: '✗', markColor: '#dc2626', textColor: '#374151' },
                            ].map(({ pts, label, bg, border, mark, markColor, textColor }) =>
                              pts.length > 0 ? (
                                <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '7px', padding: '12px' }}>
                                  <p style={{ fontSize: '11px', fontWeight: 600, color: markColor, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {pts.map((pt, i) => (
                                      <li key={i} style={{ fontSize: '12px', color: textColor, display: 'flex', gap: '6px', lineHeight: 1.5 }}>
                                        <span style={{ color: markColor, flexShrink: 0, fontWeight: 700 }}>{mark}</span>{pt}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null
                            )}
                          </div>
                        )}

                        {/* AI feedback */}
                        {a.feedback && (
                          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '7px', padding: '12px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>AI Feedback</p>
                            <p style={{ fontSize: '13px', color: '#1e3a8a', lineHeight: 1.6, margin: 0 }}>{a.feedback}</p>
                          </div>
                        )}

                        {/* Teacher override */}
                        {a.teacherScore != null && (
                          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '7px', padding: '12px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Manual Score Override</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '16px', alignItems: 'start' }}>
                              <div>
                                <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '3px' }}>Teacher Score</p>
                                <p style={{ fontSize: '22px', fontWeight: 700, color: '#92400e', margin: 0 }}>
                                  {a.teacherScore.toFixed(1)}
                                  <span style={{ fontSize: '13px', fontWeight: 400, color: '#d97706', marginLeft: '4px' }}>/ {a.maxMarks}</span>
                                </p>
                              </div>
                              {a.teacherComment && (
                                <div>
                                  <p style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '3px' }}>Comment</p>
                                  <p style={{ fontSize: '13px', color: '#374151', margin: 0, lineHeight: 1.5 }}>{a.teacherComment}</p>
                                </div>
                              )}
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

          {/* ══ FEEDBACK TAB ═══════════════════════════════════════════ */}
          {activeTab === 'feedback' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Overall feedback */}
              {submission.feedback ? (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: 0 }}>Overall AI Feedback</p>
                  </div>
                  <div style={{ padding: '16px' }}>
                    <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
                      "{submission.feedback}"
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                  No overall feedback available.
                </div>
              )}

              {/* Per-question feedback list */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: 0 }}>Per-Question Feedback</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {answers.map((a, idx) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '14px 16px',
                        borderBottom: idx < answers.length - 1 ? '1px solid #f9fafb' : 'none',
                        display: 'flex', gap: '12px', alignItems: 'flex-start',
                      }}
                    >
                      <span style={{
                        fontSize: '11px', fontFamily: 'monospace', fontWeight: 700,
                        background: '#fef3c7', color: '#92400e',
                        border: '1px solid #fde68a', borderRadius: '4px',
                        padding: '2px 7px', flexShrink: 0, marginTop: '1px',
                      }}>Q{a.questionNumber}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 4px', fontWeight: 500 }}>
                          {a.question?.questionText?.substring(0, 80)}{(a.question?.questionText?.length ?? 0) > 80 ? '…' : ''}
                        </p>
                        <p style={{ fontSize: '13px', color: '#374151', margin: 0, lineHeight: 1.55 }}>
                          {a.feedback ?? <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>No feedback for this question.</span>}
                        </p>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: scoreTextColor(a.maxMarks > 0 ? ((a.teacherScore ?? a.finalScore ?? 0) / a.maxMarks) * 100 : 0), flexShrink: 0 }}>
                        {(a.teacherScore ?? a.finalScore ?? 0).toFixed(1)}/{a.maxMarks}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}