'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend, ReferenceLine,
} from 'recharts';
import { BookOpen, Hash } from 'lucide-react';
import type { Submission, Exam } from '@/lib/types';
import { C, bandFor } from './constants';
import type { QuestionStat } from './constants';
import { Tip, Card } from './components';

interface Props {
  examFilter: string;
  questionDifficulty: QuestionStat[];
}

export default function QuestionsTab({ examFilter, questionDifficulty }: Props) {
  const radarData = questionDifficulty.map(q => ({
    subject:    q.name,
    'Avg %':      q.percentage,
    'Similarity': q.similarity,
    'Keywords':   q.keyword,
  }));

  if (examFilter === 'all') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <BookOpen className="w-10 h-10 text-gray-200" />
        <p className="text-sm font-medium text-gray-500">Select a specific exam to see question-level analytics</p>
      </div>
    );
  }

  if (!questionDifficulty.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Hash className="w-10 h-10 text-gray-200" />
        <p className="text-sm font-medium text-gray-500">No question data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Question summary cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {questionDifficulty.map(q => {
          const b = bandFor(q.percentage);
          return (
            <div key={q.name} className="rounded-2xl border p-4 text-center space-y-1.5"
              style={{ borderColor: b.color + '40', background: b.bg + '80' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: b.text }}>{q.name}</p>
              <p className="text-3xl font-black" style={{ color: b.color }}>{q.percentage.toFixed(0)}%</p>
              <p className="text-[10px] text-gray-500">{q.avgScore}/{q.maxMarks} avg marks</p>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold inline-block" style={{ background: b.bg, color: b.text }}>
                {q.difficulty}
              </span>
              <div className="grid grid-cols-2 gap-1 pt-1">
                <div className="rounded-lg bg-white/60 p-1.5">
                  <p className="text-[8px] text-gray-400">Perfect</p>
                  <p className="text-xs font-bold text-emerald-500">{q.perfect}</p>
                </div>
                <div className="rounded-lg bg-white/60 p-1.5">
                  <p className="text-[8px] text-gray-400">Zero</p>
                  <p className="text-xs font-bold text-red-400">{q.zero}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Question Performance" sub="Avg score % per question">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={questionDifficulty} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<Tip />} />
              <ReferenceLine y={40} stroke={C.red} strokeDasharray="3 3"
                label={{ value: 'Pass', fill: C.red, fontSize: 9 }} />
              <Bar dataKey="percentage" name="Avg %" radius={[6, 6, 0, 0]}>
                {questionDifficulty.map((q, i) => (
                  <Cell key={i} fill={bandFor(q.percentage).color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Scoring Components" sub="Similarity vs keyword score per question">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={questionDifficulty} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
              <Bar dataKey="similarity" name="Similarity %" fill={C.blue}   radius={[4, 4, 0, 0]} fillOpacity={0.8} />
              <Bar dataKey="keyword"    name="Keyword %"    fill={C.purple} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Radar ──────────────────────────────────────────────────────────── */}
      <Card title="Question Radar" sub="Multi-dimensional performance breakdown">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData} margin={{ top: 10, right: 50, bottom: 10, left: 50 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Radar name="Avg %"      dataKey="Avg %"      stroke={C.amber}  fill={C.amber}  fillOpacity={0.15} strokeWidth={2} />
            <Radar name="Similarity" dataKey="Similarity" stroke={C.blue}   fill={C.blue}   fillOpacity={0.1}  strokeWidth={2} />
            <Radar name="Keywords"   dataKey="Keywords"   stroke={C.purple} fill={C.purple} fillOpacity={0.1}  strokeWidth={2} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
            <Tooltip content={<Tip />} />
          </RadarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Difficulty table ─────────────────────────────────────────────────── */}
      <Card title="Question Difficulty Table" sub="Detailed per-question statistics">
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Q', 'Avg Score', 'Max', 'Avg %', 'Similarity', 'Keywords', 'Perfect', 'Zero', 'Difficulty'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-400 uppercase tracking-wider text-[9px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {questionDifficulty.map(q => {
                const b = bandFor(q.percentage);
                return (
                  <tr key={q.name} className="hover:bg-gray-50/60">
                    <td className="px-3 py-2.5 font-bold text-gray-700">{q.name}</td>
                    <td className="px-3 py-2.5 tabular-nums text-gray-600">{q.avgScore}</td>
                    <td className="px-3 py-2.5 tabular-nums text-gray-400">{q.maxMarks}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold tabular-nums" style={{ color: b.color }}>{q.percentage.toFixed(1)}%</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-blue-500">{q.similarity.toFixed(1)}%</td>
                    <td className="px-3 py-2.5 tabular-nums text-purple-500">{q.keyword.toFixed(1)}%</td>
                    <td className="px-3 py-2.5 tabular-nums text-emerald-500">{q.perfect}</td>
                    <td className="px-3 py-2.5 tabular-nums text-red-400">{q.zero}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: b.bg, color: b.text }}>
                        {q.difficulty}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}