// ── Colour palette ────────────────────────────────────────────────────────────
export const C = {
  emerald: '#10b981',
  amber:   '#f59e0b',
  orange:  '#f97316',
  red:     '#ef4444',
  blue:    '#3b82f6',
  purple:  '#8b5cf6',
  cyan:    '#06b6d4',
  pink:    '#ec4899',
  indigo:  '#6366f1',
  teal:    '#14b8a6',
  lime:    '#84cc16',
  rose:    '#f43f5e',
} as const;

// ── Grade bands ───────────────────────────────────────────────────────────────
export const GRADE_BANDS = [
  { range: 'A  80–100%', label: 'A', min: 80,  max: 101, color: C.emerald, bg: '#d1fae5', text: '#065f46' },
  { range: 'B  60–79%',  label: 'B', min: 60,  max: 80,  color: C.amber,   bg: '#fef3c7', text: '#92400e' },
  { range: 'C  40–59%',  label: 'C', min: 40,  max: 60,  color: C.orange,  bg: '#ffedd5', text: '#9a3412' },
  { range: 'F  0–39%',   label: 'F', min: 0,   max: 40,  color: C.red,     bg: '#fee2e2', text: '#991b1b' },
] as const;

export type GradeBand = (typeof GRADE_BANDS)[number];

export const bandFor = (pct: number): GradeBand =>
  (GRADE_BANDS as readonly GradeBand[]).find(b => pct >= b.min && pct < b.max) ?? GRADE_BANDS[3];

// ── Derived types ─────────────────────────────────────────────────────────────
export interface QuestionStat {
  name: string;
  fullName: string;
  avgScore: number;
  maxMarks: number;
  percentage: number;
  similarity: number;
  keyword: number;
  attempts: number;
  perfect: number;
  zero: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface TrendPoint {
  date: string;
  avg: number;
  high: number;
  low: number;
  count: number;
}

export interface ExamCompareStat {
  name: string;
  avg: number;
  pass: number;
  count: number;
}