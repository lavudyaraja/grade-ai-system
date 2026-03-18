'use client';

import { useMemo } from 'react';
import type { Submission } from '@/lib/types';
import { C, GRADE_BANDS } from './constants';
import type { QuestionStat } from './constants';
import {
  Card,
  GradeBandRow,
  InsightAlert,
  SummaryStat,
  TendencyBar,
} from './components';

interface Props {
  graded: Submission[];           // real array so we can count bands accurately
  avg: number;
  median: number;
  stdDev: number;
  passRate: number;
  highScore: number;
  lowScore: number;
  needReview: number;
  questionDifficulty: QuestionStat[];
}

type InsightType = 'good' | 'warn' | 'bad';
interface Insight { type: InsightType; msg: string; }

export default function InsightsTab({
  graded, avg, median, stdDev, passRate,
  highScore, lowScore, needReview, questionDifficulty,
}: Props) {

  // ── Grade bands with real counts ─────────────────────────────────────────
  const gradeBands = useMemo(() =>
    GRADE_BANDS.map(b => ({
      ...b,
      count: graded.filter(s => (s.percentage ?? 0) >= b.min && (s.percentage ?? 0) < b.max).length,
    })),
    [graded],
  );

  // ── Auto-insights ────────────────────────────────────────────────────────
  const insights = useMemo((): Insight[] => {
    if (!graded.length) return [];
    const list: Insight[] = [];

    if (avg >= 75)
      list.push({ type: 'good', msg: `Strong class average of ${avg.toFixed(1)}% — students are performing well.` });
    else if (avg < 50)
      list.push({ type: 'bad',  msg: `Class average is ${avg.toFixed(1)}% — consider reviewing core concepts.` });

    const hardQs = questionDifficulty.filter(q => q.difficulty === 'Hard');
    if (hardQs.length) list.push({ type: 'warn', msg: `${hardQs.map(q => q.name).join(', ')} ${hardQs.length === 1 ? 'is' : 'are'} difficult — average below 40%.` });
    
    return list;
  }, [avg, passRate, stdDev, needReview, highScore, questionDifficulty, graded.length]);

  return (
    <div className="space-y-4">

      {/* ── Summary banner ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gray-900 text-white p-6 grid sm:grid-cols-4 gap-6">
        <SummaryStat label="Average" value={`${avg.toFixed(1)}%`} sub="class mean" />
        <SummaryStat label="Std Dev" value={`σ ${stdDev.toFixed(1)}`} sub="score spread" />
        <SummaryStat label="Median" value={`${median.toFixed(1)}%`} sub="50th percentile" />
        <SummaryStat label="Range" value={`${lowScore.toFixed(0)}–${highScore.toFixed(0)}%`} sub="min to max" />
      </div>

      {/* ── Auto‑insights ─────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Automated Insights</p>
        {insights.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-xs">
            No insights available yet — grade more submissions for patterns.
          </div>
        ) : (
          insights.map((ins, i) => <InsightAlert key={i} type={ins.type} message={ins.msg} />)
        )}
      </div>

      {/* ── Central tendency ─────────────────────────────────────────────────────── */}
      <Card title="Central Tendency" sub="Mean vs median — detect skew">
        <div className="space-y-3 mt-2">
          <TendencyBar label="Mean" value={avg} color={C.amber} />
          <TendencyBar label="Median" value={median} color={C.purple} />
          <TendencyBar label="Pass Threshold" value={40} color={C.red} />
        </div>
        {Math.abs(avg - median) > 10 && (
          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3">
            ⚠ Mean and median differ by {Math.abs(avg - median).toFixed(1)}% — the score distribution is skewed.
          </p>
        )}
      </Card>

      {/* ── Grade band detail ─────────────────────────────────────────────────────── */}
      <Card title="Grade Band Detail" sub="Performance bracket analysis">
        <div className="space-y-3">
          {gradeBands.map(b => (
            <GradeBandRow key={b.label} band={b} total={graded.length} />
          ))}
        </div>
      </Card>

    </div>
  );
}