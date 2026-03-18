'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight, ArrowDownRight,
  ChevronUp, ChevronDown, Minus,
  BarChart3,
} from 'lucide-react';
import type { GradeBand } from './constants';

// ── Custom recharts tooltip ───────────────────────────────────────────────────
export const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3.5 py-2.5 text-xs shadow-xl shadow-black/10">
      {label && (
        <p className="text-gray-400 mb-1.5 font-medium tracking-wide uppercase text-[10px]">
          {label}
        </p>
      )}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? '#111' }} className="font-semibold flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: p.color ?? '#111' }} />
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Animated counter hook ─────────────────────────────────────────────────────
export function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(target * ease);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return val;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
export const Spark = ({ data, color }: { data: number[]; color: string }) => (
  <svg viewBox="0 0 80 28" className="w-20 h-7" preserveAspectRatio="none">
    <polyline
      points={data.map((v, i) => {
        const max = Math.max(...data, 1);
        const min = Math.min(...data);
        const range = max - min || 1;
        const x = (i / (data.length - 1)) * 80;
        const y = 28 - ((v - min) / range) * 22 - 3;
        return `${x},${y}`;
      }).join(' ')}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  icon: React.ElementType;
  accent: { bg: string; icon: string; text: string };
  sparkData?: number[];
  delta?: number;
  deltaLabel?: string;
}

export const StatCard = ({
  label, value, suffix = '', sub, icon: Icon, accent, sparkData, delta, deltaLabel,
}: StatCardProps) => {
  const animated = useCountUp(value);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 flex flex-col gap-3 hover:shadow-md hover:shadow-black/5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: accent.bg }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: accent.icon }} />
        </div>
        {delta !== undefined && (
          <span className={`text-[10px] font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
            delta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          }`}>
            {delta >= 0
              ? <ArrowUpRight className="w-2.5 h-2.5" />
              : <ArrowDownRight className="w-2.5 h-2.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-black text-gray-900 mt-1 tabular-nums">
          {animated.toFixed(suffix === '%' ? 1 : 0)}{suffix}
        </p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {sparkData && sparkData.length > 2 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-300">{deltaLabel ?? 'trend'}</span>
          <Spark data={sparkData} color={accent.icon} />
        </div>
      )}
    </div>
  );
};

// ── Chart card wrapper ────────────────────────────────────────────────────────
interface CardProps {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export const Card = ({ title, sub, children, className = '', actions }: CardProps) => (
  <div className={`rounded-2xl border border-gray-100 bg-white p-6 ${className}`}>
    <div className="flex items-start justify-between mb-1">
      <div>
        <p className="text-sm font-bold text-gray-900 tracking-tight">{title}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-1.5">{actions}</div>}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

// ── Section heading ───────────────────────────────────────────────────────────
export const SectionHead = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2 mt-2">
    <div className="h-5 w-5 rounded-md bg-gray-900 flex items-center justify-center">
      <Icon className="h-3 w-3 text-white" />
    </div>
    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</h3>
    <div className="flex-1 h-px bg-gray-100" />
  </div>
);

// ── Sort icon ─────────────────────────────────────────────────────────────────
export const SortIcon = ({
  col,
  sort,
}: {
  col: string;
  sort: { col: string; dir: 'asc' | 'desc' };
}) =>
  sort.col !== col
    ? <Minus className="w-3 h-3 text-gray-300" />
    : sort.dir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-gray-700" />
      : <ChevronDown className="w-3 h-3 text-gray-700" />;

// ── Empty state ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  className?: string;
}

export const EmptyState = ({
  icon: Icon = BarChart3,
  title,
  description,
  className = '',
}: EmptyStateProps) => (
  <div className={`flex flex-col items-center justify-center py-24 gap-3 ${className}`}>
    <div className="h-16 w-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
      <Icon className="h-8 w-8 text-gray-300" />
    </div>
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  </div>
);

// ── Loading skeleton ──────────────────────────────────────────────────────────
export const LoadingSkeleton = () => (
  <div className="space-y-5 animate-pulse">
    {/* Header row */}
    <div className="flex justify-between">
      <div className="h-8 w-40 bg-gray-100 rounded-xl" />
      <div className="h-9 w-48 bg-gray-100 rounded-xl" />
    </div>
    {/* Stat cards */}
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-32 bg-gray-50 rounded-2xl border border-gray-100" />
      ))}
    </div>
    {/* Chart grid */}
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-64 bg-gray-50 rounded-2xl border border-gray-100" />
      ))}
    </div>
  </div>
);

// ── Progress bar ──────────────────────────────────────────────────────────────
interface ProgressBarProps {
  value: number;        // 0–100
  max?: number;         // defaults to 100
  color?: string;       // hex / tailwind-compatible colour string
  height?: string;      // tailwind height class, e.g. "h-1.5"
  background?: string;  // tailwind bg class for the track
  className?: string;
}

export const ProgressBar = ({
  value,
  max = 100,
  color = '#10b981',
  height = 'h-1.5',
  background = 'bg-gray-100',
  className = '',
}: ProgressBarProps) => (
  <div className={`w-full ${height} rounded-full ${background} overflow-hidden ${className}`}>
    <div
      className="h-full rounded-full transition-all duration-500"
      style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }}
    />
  </div>
);

// ── Grade badge ───────────────────────────────────────────────────────────────
interface GradeBadgeProps {
  band: GradeBand;
  size?: 'sm' | 'md';
}

export const GradeBadge = ({ band, size = 'sm' }: GradeBadgeProps) => (
  <span
    className={`font-bold rounded-full inline-flex items-center justify-center ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
    }`}
    style={{ background: band.bg, color: band.text }}
  >
    {band.label}
  </span>
);

// ── Grade band row (used in Insights tab) ─────────────────────────────────────
interface GradeBandRowProps {
  band: GradeBand & { count: number };
  total: number;
}

export const GradeBandRow = ({ band, total }: GradeBandRowProps) => {
  const pct = total > 0 ? (band.count / total) * 100 : 0;
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{ background: band.bg + '80' }}
    >
      {/* Grade letter */}
      <span
        className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0"
        style={{ background: band.bg, color: band.color }}
      >
        {band.label}
      </span>

      {/* Label + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium truncate" style={{ color: band.text }}>
            {band.range}
          </span>
          <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: band.color }}>
            {band.count} student{band.count !== 1 ? 's' : ''}
          </span>
        </div>
        <ProgressBar
          value={pct}
          color={band.color}
          height="h-1.5"
          background="bg-white/60"
        />
      </div>

      {/* Percentage */}
      <span
        className="text-xs font-bold tabular-nums w-8 text-right flex-shrink-0"
        style={{ color: band.text }}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
};

// ── Insight alert card ────────────────────────────────────────────────────────
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

type InsightType = 'good' | 'warn' | 'bad';

interface InsightAlertProps {
  type: InsightType;
  message: string;
}

const INSIGHT_STYLES: Record<InsightType, { wrapper: string; text: string; Icon: React.ElementType; iconClass: string }> = {
  good: { wrapper: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-800', Icon: CheckCircle, iconClass: 'text-emerald-500' },
  warn: { wrapper: 'bg-amber-50  border-amber-100',   text: 'text-amber-800',   Icon: AlertCircle, iconClass: 'text-amber-500'  },
  bad:  { wrapper: 'bg-red-50    border-red-100',     text: 'text-red-800',     Icon: XCircle,     iconClass: 'text-red-500'    },
};

export const InsightAlert = ({ type, message }: InsightAlertProps) => {
  const s = INSIGHT_STYLES[type];
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${s.wrapper}`}>
      <s.Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${s.iconClass}`} />
      <p className={`text-sm font-medium ${s.text}`}>{message}</p>
    </div>
  );
};

// ── Stat summary row (dark banner item) ───────────────────────────────────────
interface SummaryStatProps {
  label: string;
  value: string;
  sub: string;
}

export const SummaryStat = ({ label, value, sub }: SummaryStatProps) => (
  <div className="text-center">
    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{label}</p>
    <p className="text-2xl font-black text-white mt-1">{value}</p>
    <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>
  </div>
);

// ── Central tendency bar ──────────────────────────────────────────────────────
interface TendencyBarProps {
  label: string;
  value: number;
  color: string;
}

export const TendencyBar = ({ label, value, color }: TendencyBarProps) => (
  <div className="flex items-center gap-3">
    <span className="text-[10px] font-semibold text-gray-500 w-28 text-right flex-shrink-0">
      {label}
    </span>
    <div className="flex-1 h-2 rounded-full bg-gray-100 relative overflow-hidden">
      <div
        className="absolute h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(value, 100)}%`, background: color }}
      />
    </div>
    <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color }}>
      {value.toFixed(1)}%
    </span>
  </div>
);