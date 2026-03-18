'use client';

import { useMemo, useState } from 'react';
import { Search, AlertCircle, CheckCircle } from 'lucide-react';
import type { Submission } from '@/lib/types';
import { bandFor } from './constants';
import { SortIcon } from './components';

interface Props {
  graded: Submission[];
}

const TABLE_COLS = [
  { key: 'name',        label: 'Student',   sortable: true  },
  { key: 'exam',        label: 'Exam',      sortable: false },
  { key: 'percentage',  label: 'Score',     sortable: true  },
  { key: 'grade',       label: 'Grade',     sortable: false },
  { key: 'submittedAt', label: 'Submitted', sortable: true  },
  { key: 'review',      label: 'Flags',     sortable: false },
] as const;

export default function StudentsTab({ graded }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'percentage', dir: 'desc' });

  const toggleSort = (col: string) =>
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });

  const filteredStudents = useMemo(() => {
    let list = [...graded];
    if (search) list = list.filter(s => s.studentName?.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.col === 'percentage') return ((a.percentage ?? 0) - (b.percentage ?? 0)) * dir;
      if (sort.col === 'name')       return (a.studentName ?? '').localeCompare(b.studentName ?? '') * dir;
      if (sort.col === 'submittedAt') return (new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()) * dir;
      return 0;
    });
    return list;
  }, [graded, search, sort]);

  return (
    <div className="space-y-4">

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full pl-8 pr-4 h-9 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 text-gray-700 placeholder:text-gray-300"
          />
        </div>
        <span className="text-xs text-gray-400">
          {filteredStudents.length} result{filteredStudents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {TABLE_COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && toggleSort(col.key)}
                  className={`text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px] select-none ${
                    col.sortable ? 'cursor-pointer hover:text-gray-700' : ''
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && <SortIcon col={col.key} sort={sort} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {filteredStudents.map(s => {
              const pct   = s.percentage ?? 0;
              const b     = bandFor(pct);
              const flags = s.answers?.filter(a => a.needsReview).length ?? 0;
              return (
                <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                        {s.studentName?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <span className="font-medium text-gray-800 truncate max-w-[120px]">{s.studentName}</span>
                    </div>
                  </td>
                  {/* Exam */}
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[120px]">{s.exam?.title ?? '—'}</td>
                  {/* Score */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.color }} />
                      </div>
                      <span className="font-bold tabular-nums" style={{ color: b.color }}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  {/* Grade */}
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: b.bg, color: b.text }}>{b.label}</span>
                  </td>
                  {/* Date */}
                  <td className="px-4 py-3 text-gray-400 font-mono tabular-nums">
                    {new Date(s.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  {/* Flags */}
                  <td className="px-4 py-3">
                    {flags > 0
                      ? <span className="flex items-center gap-1 text-orange-500"><AlertCircle className="w-3 h-3" />{flags}</span>
                      : <CheckCircle className="w-3 h-3 text-gray-200" />}
                  </td>
                </tr>
              );
            })}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-xs">
                  No students match your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}