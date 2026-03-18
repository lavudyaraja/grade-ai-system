'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BarChart3, Users, BookOpen, Brain, Download } from 'lucide-react';
import type { Submission, Exam } from '@/lib/types';

// ── Internal modules ──────────────────────────────────────────────────────────
import { bandFor }      from '../analytics/constants';
import type { QuestionStat } from '../analytics/constants';
import OverviewTab      from '../analytics/OverviewTab';
import StudentsTab      from '../analytics/StudentsTab';
import QuestionsTab     from '../analytics/QuestionsTab';
import InsightsTab      from '../analytics/InsightsTab';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalyticsTabProps { refreshTrigger?: number; }

type TabId = 'overview' | 'students' | 'questions' | 'insights';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',  icon: BarChart3 },
  { id: 'students',  label: 'Students',  icon: Users     },
  { id: 'questions', label: 'Questions', icon: BookOpen  },
  { id: 'insights',  label: 'Insights',  icon: Brain     },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function AnalyticsTab({ refreshTrigger }: AnalyticsTabProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams]             = useState<Exam[]>([]);
  const [loading, setLoading]         = useState(true);
  const [examFilter, setExamFilter]   = useState('all');
  const [activeTab, setActiveTab]     = useState<TabId>('overview');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sr, er] = await Promise.all([
          fetch('/api/submissions?status=graded'),
          fetch('/api/exams'),
        ]);
        if (sr.ok && er.ok) {
          setSubmissions(await sr.json());
          setExams(await er.json());
        }
      } finally { setLoading(false); }
    })();
  }, [refreshTrigger]);

  // ── Filtered graded submissions ────────────────────────────────────────────
  const graded = useMemo(
    () => (examFilter === 'all' ? submissions : submissions.filter(s => s.examId === examFilter))
            .filter(s => s.status === 'graded'),
    [submissions, examFilter],
  );

  // ── Core stats (shared across tabs) ───────────────────────────────────────
  const avg = graded.length
    ? graded.reduce((a, s) => a + (s.percentage ?? 0), 0) / graded.length
    : 0;

  const passRate = graded.length
    ? (graded.filter(s => (s.percentage ?? 0) >= 40).length / graded.length) * 100
    : 0;

  const highScore = graded.length ? Math.max(...graded.map(s => s.percentage ?? 0)) : 0;
  const lowScore  = graded.length ? Math.min(...graded.map(s => s.percentage ?? 0)) : 0;

  const median = useMemo(() => {
    if (!graded.length) return 0;
    const sorted = [...graded].map(s => s.percentage ?? 0).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }, [graded]);

  const stdDev = useMemo(() => {
    if (graded.length < 2) return 0;
    const variance = graded.reduce((sum, s) => sum + Math.pow((s.percentage ?? 0) - avg, 2), 0) / graded.length;
    return Math.sqrt(variance);
  }, [graded, avg]);

  const needReview = graded.reduce(
    (a, s) => a + (s.answers?.filter(x => x.needsReview).length ?? 0), 0,
  );

  // ── Spark / trend series ───────────────────────────────────────────────────
  const recentScores = useMemo(() => {
    const byDate: Record<string, number[]> = {};
    [...graded]
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
      .forEach(s => {
        const d = new Date(s.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        (byDate[d] ??= []).push(s.percentage ?? 0);
      });
    return Object.values(byDate).slice(-8).map(vals => vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [graded]);

  // ── Question difficulty (used by Questions + Insights tabs) ───────────────
  const questionDifficulty = useMemo((): QuestionStat[] => {
    if (examFilter === 'all' || !graded.length) return [];
    const exam = exams.find(e => e.id === examFilter);
    if (!exam) return [];
    return exam.questions.map(q => {
      const answers  = graded.flatMap(s => s.answers?.filter(a => a.questionId === q.id) ?? []);
      const avgScore = answers.length ? answers.reduce((a, x) => a + (x.finalScore ?? 0), 0)         / answers.length : 0;
      const avgSim   = answers.length ? answers.reduce((a, x) => a + (x.similarityScore ?? 0), 0)    / answers.length : 0;
      const avgKw    = answers.length ? answers.reduce((a, x) => a + (x.keywordScore ?? 0), 0)        / answers.length : 0;
      const pct      = q.maxMarks > 0 ? (avgScore / q.maxMarks) * 100 : 0;
      return {
        name:       `Q${q.questionNumber}`,
        fullName:   q.questionText?.slice(0, 50) ?? `Q${q.questionNumber}`,
        avgScore:   parseFloat(avgScore.toFixed(1)),
        maxMarks:   q.maxMarks,
        percentage: parseFloat(pct.toFixed(1)),
        similarity: parseFloat((avgSim * 100).toFixed(1)),
        keyword:    parseFloat((avgKw  * 100).toFixed(1)),
        attempts:   answers.length,
        perfect:    answers.filter(x => (x.finalScore ?? 0) >= q.maxMarks).length,
        zero:       answers.filter(x => (x.finalScore ?? 0) === 0).length,
        difficulty: pct < 40 ? 'Hard' : pct < 70 ? 'Medium' : 'Easy',
      };
    });
  }, [graded, exams, examFilter]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-5 animate-pulse">
      <div className="flex justify-between">
        <div className="h-8 w-40 bg-gray-100 rounded-xl" />
        <div className="h-9 w-48 bg-gray-100 rounded-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-50 rounded-2xl border border-gray-100" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 bg-gray-50 rounded-2xl border border-gray-100" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {graded.length} graded submission{graded.length !== 1 ? 's' : ''}
            {examFilter !== 'all' && ` · ${exams.find(e => e.id === examFilter)?.title}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={examFilter} onValueChange={setExamFilter}>
            <SelectTrigger className="h-9 w-52 bg-white border-gray-200 text-sm font-medium text-gray-700 rounded-xl shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-100 rounded-xl shadow-xl">
              <SelectItem value="all" className="text-gray-700">All Exams</SelectItem>
              {exams.map(e => (
                <SelectItem key={e.id} value={e.id} className="text-gray-700">{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
            title="Export data"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeTab === t.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {graded.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="h-20 w-20 rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center">
            <BarChart3 className="h-9 w-9 text-gray-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-600">No data yet</p>
            <p className="text-xs text-gray-400 mt-1">Upload and grade submissions to see analytics</p>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <OverviewTab
              graded={graded}
              exams={exams}
              avg={avg}
              passRate={passRate}
              highScore={highScore}
              lowScore={lowScore}
              median={median}
              stdDev={stdDev}
              needReview={needReview}
              recentScores={recentScores}
            />
          )}

          {activeTab === 'students' && (
            <StudentsTab graded={graded} />
          )}

          {activeTab === 'questions' && (
            <QuestionsTab
              examFilter={examFilter}
              questionDifficulty={questionDifficulty}
            />
          )}

          {activeTab === 'insights' && (
            <InsightsTab
              graded={graded}
              avg={avg}
              median={median}
              stdDev={stdDev}
              passRate={passRate}
              highScore={highScore}
              lowScore={lowScore}
              needReview={needReview}
              questionDifficulty={questionDifficulty}
            />
          )}
        </>
      )}
    </div>
  );
}