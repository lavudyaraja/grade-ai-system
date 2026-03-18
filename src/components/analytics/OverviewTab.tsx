'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, LineChart, Line,
  ComposedChart, ReferenceLine, ScatterChart, Scatter, Legend,
} from 'recharts';
import {
  TrendingUp, Users, Award, Activity, Zap, Target,
  BarChart3,
} from 'lucide-react';
import type { Submission, Exam } from '@/lib/types';
import { C, GRADE_BANDS, bandFor } from './constants';
import { Tip, StatCard, Card } from './components';

interface Props {
  graded: Submission[];
  exams: Exam[];
  avg: number;
  passRate: number;
  highScore: number;
  lowScore: number;
  median: number;
  stdDev: number;
  needReview: number;
  recentScores: number[];
}

export default function OverviewTab({
  graded, exams, avg, passRate, highScore, lowScore,
  median, stdDev, needReview, recentScores,
}: Props) {
  const [showHistogram, setShowHistogram] = useState<'bar' | 'area'>('bar');

  // ── Grade bands ─────────────────────────────────────────────────────────────
  const gradeBands = GRADE_BANDS.map(b => ({
    ...b,
    count: graded.filter(s => (s.percentage ?? 0) >= b.min && (s.percentage ?? 0) < b.max).length,
  }));

  // ── Trend ────────────────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const byDate: Record<string, number[]> = {};
    graded.forEach(s => {
      const d = new Date(s.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      (byDate[d] ??= []).push(s.percentage ?? 0);
    });
    return Object.entries(byDate).slice(-14).map(([date, vals]) => ({
      date,
      avg:   parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
      high:  parseFloat(Math.max(...vals).toFixed(1)),
      low:   parseFloat(Math.min(...vals).toFixed(1)),
      count: vals.length,
    }));
  }, [graded]);

  // ── Histogram ────────────────────────────────────────────────────────────────
  const histogramData = Array.from({ length: 10 }, (_, i) => {
    const lo = i * 10, hi = lo + 10;
    return {
      range: `${lo}–${hi}`,
      count: graded.filter(s => (s.percentage ?? 0) >= lo && (s.percentage ?? 0) < hi).length,
      color: lo >= 80 ? C.emerald : lo >= 60 ? C.amber : lo >= 40 ? C.orange : C.red,
    };
  });

  // ── Exam comparison ──────────────────────────────────────────────────────────
  const examComparison = useMemo(() => {
    return exams.map(e => {
      const subs = graded.filter(s => s.examId === e.id);
      const a    = subs.length ? subs.reduce((x, s) => x + (s.percentage ?? 0), 0) / subs.length : 0;
      const p    = subs.length ? (subs.filter(s => (s.percentage ?? 0) >= 40).length / subs.length) * 100 : 0;
      return { name: e.title?.slice(0, 18) ?? 'Exam', avg: parseFloat(a.toFixed(1)), pass: parseFloat(p.toFixed(1)), count: subs.length };
    }).filter(e => e.count > 0);
  }, [exams, graded]);

  // ── Heatmap ──────────────────────────────────────────────────────────────────
  const hourHeatmap = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, label: `${h}:00` }));
    graded.forEach(s => { hours[new Date(s.submittedAt).getHours()].count++; });
    return hours;
  }, [graded]);
  const maxHourCount = Math.max(...hourHeatmap.map(h => h.count), 1);

  // ── Percentile ───────────────────────────────────────────────────────────────
  const percentileCurve = Array.from({ length: 11 }, (_, i) => {
    const score = i * 10;
    const pct = graded.length
      ? (graded.filter(s => (s.percentage ?? 0) <= score).length / graded.length) * 100
      : 0;
    return { score, percentile: parseFloat(pct.toFixed(1)) };
  });

  // ── Scatter ──────────────────────────────────────────────────────────────────
  const scatterData = graded.map(s => ({
    score:   s.percentage ?? 0,
    answers: s.answers?.length ?? 0,
    name:    s.studentName,
  }));

  return (
    <div className="space-y-6">

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Submissions" value={graded.length} icon={Users}
          accent={{ bg: '#eff6ff', icon: C.blue, text: C.blue }}
          sub={`${exams.filter(e => e.status === 'active').length} active exams`}
          sparkData={recentScores} />
        <StatCard label="Average" value={avg} suffix="%" icon={TrendingUp}
          accent={{ bg: '#fffbeb', icon: C.amber, text: C.amber }}
          sub="class average" sparkData={recentScores} delta={avg - 60} />
        <StatCard label="Pass Rate" value={passRate} suffix="%" icon={Award}
          accent={{ bg: '#ecfdf5', icon: C.emerald, text: C.emerald }}
          sub="≥ 40% threshold" />
        <StatCard label="Median" value={median} suffix="%" icon={Activity}
          accent={{ bg: '#f5f3ff', icon: C.purple, text: C.purple }}
          sub={`σ = ${stdDev.toFixed(1)}`} />
        <StatCard label="High Score" value={highScore} suffix="%" icon={Zap}
          accent={{ bg: '#fdf4ff', icon: C.pink, text: C.pink }}
          sub={`Low: ${lowScore.toFixed(0)}%`} />
        <StatCard label="Need Review" value={needReview} icon={Target}
          accent={{ bg: '#fff7ed', icon: C.orange, text: C.orange }}
          sub="flagged answers" />
      </div>

      {/* ── Grade band pills ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {gradeBands.map(b => (
          <div key={b.label} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: b.bg }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: b.text }}>{b.range}</span>
            <span className="text-3xl font-black" style={{ color: b.color }}>{b.count}</span>
            <span className="text-[10px]" style={{ color: b.text }}>
              {graded.length ? ((b.count / graded.length) * 100).toFixed(0) : 0}% of class
            </span>
          </div>
        ))}
      </div>

      {/* ── Band distribution + trend ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Grade Band Distribution" sub="Students per score range">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gradeBands} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
                {gradeBands.map((b, i) => <Cell key={i} fill={b.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="Score Trend"
          sub="Daily average ± range"
          actions={
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              {[{ label: 'Avg', color: 'bg-amber-400' }, { label: 'High', color: 'bg-emerald-400' }, { label: 'Low', color: 'bg-red-400' }]
                .map(l => (
                  <span key={l.label} className="flex items-center gap-1">
                    <span className={`w-2 h-0.5 ${l.color} rounded inline-block`} />{l.label}
                  </span>
                ))}
            </div>
          }
        >
          {trendData.length < 2 ? (
            <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-gray-400">
              <TrendingUp className="w-8 h-8 text-gray-200" />
              <span className="text-xs">Need submissions on multiple dates</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={trendData} margin={{ left: -20, right: 4 }}>
                <defs>
                  <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.amber} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={C.amber} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="avg" name="Avg %" stroke={C.amber} fill="url(#avgGrad)" strokeWidth={2} dot={{ fill: C.amber, r: 3, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="high" name="High" stroke={C.emerald} strokeWidth={1} strokeDasharray="3 3" dot={false} />
                <Line type="monotone" dataKey="low"  name="Low"  stroke={C.red}     strokeWidth={1} strokeDasharray="3 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Histogram ─────────────────────────────────────────────────────────── */}
      <Card
        title="Score Distribution"
        sub="Number of students per 10-point bucket"
        actions={
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['bar', 'area'] as const).map(v => (
              <button key={v} onClick={() => setShowHistogram(v)}
                className={`px-2.5 py-1 transition ${showHistogram === v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {v === 'bar' ? <BarChart3 className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
              </button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={180}>
          {showHistogram === 'bar' ? (
            <BarChart data={histogramData} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="count" name="Students" radius={[5, 5, 0, 0]}>
                {histogramData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.75} />)}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={histogramData} margin={{ left: -20, right: 4 }}>
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="count" name="Students" stroke={C.blue} fill="url(#histGrad)" strokeWidth={2} dot={{ fill: C.blue, r: 3, strokeWidth: 0 }} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </Card>

      {/* ── Exam comparison + heatmap ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {examComparison.length > 1 && (
          <Card title="Exam Comparison" sub="Average and pass rate by exam">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={examComparison} margin={{ left: -20, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
                <Bar dataKey="avg"  name="Avg %"  fill={C.blue}    radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                <Bar dataKey="pass" name="Pass %"  fill={C.emerald} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card title="Submission Time Heatmap" sub="When students submit (by hour of day)">
          <div className="grid grid-cols-12 gap-1 mt-1">
            {hourHeatmap.map(h => (
              <div key={h.hour} className="flex flex-col items-center gap-1">
                <div
                  className="w-full aspect-square rounded-md transition-all"
                  style={{
                    background: h.count === 0
                      ? '#f9fafb'
                      : `rgba(59,130,246,${0.15 + (h.count / maxHourCount) * 0.85})`,
                  }}
                  title={`${h.label}: ${h.count} submissions`}
                />
                {h.hour % 6 === 0 && (
                  <span className="text-[8px] text-gray-400 font-mono">{h.hour}h</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-[10px] text-gray-400">Midnight</span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-gray-400">Few</span>
              {[0.15, 0.35, 0.55, 0.75, 1].map(o => (
                <div key={o} className="w-3 h-2 rounded-sm" style={{ background: `rgba(59,130,246,${o})` }} />
              ))}
              <span className="text-[9px] text-gray-400">Many</span>
            </div>
            <span className="text-[10px] text-gray-400">11 PM</span>
          </div>
        </Card>

        <Card title="Score Percentile Curve" sub="Cumulative distribution of scores">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={percentileCurve} margin={{ left: -20, right: 4 }}>
              <defs>
                <linearGradient id="percGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.purple} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={C.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="score" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="percentile" name="Percentile" stroke={C.purple} fill="url(#percGrad)" strokeWidth={2} dot={{ fill: C.purple, r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Score vs Answers Scatter" sub="Each point is one student">
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="score"   name="Score %"  domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis dataKey="answers" name="Answers"              tick={{ fill: '#9ca3af', fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} cursor={{ strokeDasharray: '3 3', stroke: '#e5e7eb' }} />
              <Scatter data={scatterData} fill={C.cyan} fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Top performers + missed keywords ─────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Top 8 Performers" sub="Highest scoring students">
          <div className="space-y-2.5">
            {[...graded]
              .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
              .slice(0, 8)
              .map((s, i) => {
                const pct = s.percentage ?? 0;
                const b = bandFor(pct);
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                      i === 0 ? 'bg-amber-400 text-white'
                      : i === 1 ? 'bg-gray-300 text-gray-700'
                      : i === 2 ? 'bg-orange-300 text-white'
                      : 'bg-gray-100 text-gray-500'
                    }`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold text-gray-800 truncate">{s.studentName}</p>
                        <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: b.color }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: b.color }} />
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: b.bg, color: b.text }}>{b.label}</span>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Missed keywords passed via memo in parent — rendered inline here */}
        <Card title="Commonly Missed Topics" sub="Keywords students most frequently omit">
          <_MissedKeywords graded={graded} />
        </Card>
      </div>
    </div>
  );
}

// ── Internal: missed keywords ─────────────────────────────────────────────────
function _MissedKeywords({ graded }: { graded: Submission[] }) {
  const missedKeywords = useMemo(() => {
    const counts: Record<string, number> = {};
    graded.forEach(s =>
      s.answers?.forEach(a => {
        if (a.keyPointsMissed) {
          try { (JSON.parse(a.keyPointsMissed) as string[]).forEach(kw => { counts[kw] = (counts[kw] ?? 0) + 1; }); } catch {}
        }
      })
    );
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([kw, count]) => ({ kw, count }));
  }, [graded]);

  if (!missedKeywords.length)
    return <div className="h-24 flex items-center justify-center text-gray-400 text-xs">No keyword data yet</div>;

  return (
    <div className="space-y-2">
      {missedKeywords.map(({ kw, count }, i) => {
        const pct = (count / graded.length) * 100;
        return (
          <div key={i} className="flex items-center gap-2.5">
            <span className="text-[9px] font-mono text-gray-400 w-4 text-right flex-shrink-0">{i + 1}</span>
            <span className="text-xs text-gray-700 flex-1 truncate">{kw}</span>
            <div className="w-20 h-1.5 rounded-full bg-gray-100 flex-shrink-0">
              <div className="h-full rounded-full bg-red-400/70" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-[9px] font-mono tabular-nums text-red-500 w-6 text-right flex-shrink-0">{count}×</span>
          </div>
        );
      })}
    </div>
  );
}