'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Upload, BarChart3, FileText,
  Brain, Zap, GraduationCap, Activity,
  ChevronRight, ClipboardCheck,
} from 'lucide-react';
import ExamsTab from '@/components/tabs/ExamsTab';
import UploadTab from '@/components/tabs/UploadTab';
import ResultsTab from '@/components/tabs/ResultsTab';
import AnalyticsTab from '@/components/tabs/AnalyticsTab';
import ReviewTab from '@/components/tabs/ReviewTab';

type TabId = 'exams' | 'upload' | 'results' | 'analytics' | 'review';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'exams',     label: 'Exams',     icon: BookOpen,      description: 'Manage exam papers'   },
  { id: 'upload',    label: 'Upload',    icon: Upload,       description: 'Submit answer sheets'  },
  { id: 'results',   label: 'Results',   icon: FileText,     description: 'View graded results'   },
  { id: 'review',    label: 'Review',    icon: ClipboardCheck, description: 'Grade review queue'   },
  { id: 'analytics', label: 'Analytics', icon: BarChart3,    description: 'Performance insights'  },
];

export default function Home() {
  const [activeTab, setActiveTab]     = useState<TabId>('exams');
  const [teacherId, setTeacherId]     = useState('default-teacher');
  const [refreshTrigger, setRefresh]  = useState(0);
  const [isReady, setIsReady]         = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/teachers');
        if (res.ok) {
          const list = await res.json();
          if (list.length > 0) {
            setTeacherId(list[0].id);
          } else {
            const cr = await fetch('/api/teachers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Default Teacher', email: 'teacher@example.com' }),
            });
            if (cr.ok) setTeacherId((await cr.json()).id);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const refresh = () => setRefresh(p => p + 1);
  const current = NAV_ITEMS.find(n => n.id === activeTab)!;

  return (
    <div
      className="min-h-screen bg-white text-gray-800 flex flex-col"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="h-14 border-b border-gray-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 flex items-center px-5 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Brain className="h-4 w-4 text-black" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-gray-900 leading-none">Grade AI</p>
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-500 leading-none mt-0.5">
              Assessment System
            </p>
          </div>
        </div>

        {/* Desktop tab pills */}
        <div className="flex-1 flex justify-center">
          <nav className="hidden md:flex items-center gap-0.5 border border-gray-200 rounded-lg p-1 bg-gray-50">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  active
                    ? 'bg-amber-400 text-black shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        </div>

        {/* Right badges */}
        <div className="ml-auto flex items-center gap-2">
          <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/20 text-[10px] font-mono hidden sm:flex gap-1">
            <Zap className="h-2.5 w-2.5" />
            Llama 4 Vision
          </Badge>
          <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-[10px] font-mono hidden sm:flex gap-1">
            <Activity className="h-2.5 w-2.5 animate-pulse" />
            Live
          </Badge>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — lg+ */}
        <aside className="hidden lg:flex w-56 flex-col border-r border-gray-200 bg-gray-50 sticky top-14 h-[calc(100vh-3.5rem)] p-3 gap-0.5 flex-shrink-0">
          <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-500 px-2 py-2">
            Navigation
          </p>

          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
                  active
                    ? 'bg-amber-400/10 text-amber-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                  active ? 'bg-amber-400/20' : 'bg-gray-100 group-hover:bg-gray-200'
                }`}>
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-amber-400' : ''}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{item.label}</p>
                  <p className="text-[10px] text-gray-500 truncate leading-tight">{item.description}</p>
                </div>
                {active && <ChevronRight className="h-3 w-3 text-amber-400 flex-shrink-0" />}
              </button>
            );
          })}

          <div className="mt-auto pt-3 border-t border-gray-200">
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-[10px] text-gray-500 font-mono">Teacher Session</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-600">System active</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {/* Breadcrumb strip */}
          <div className="h-10 px-6 border-b border-gray-200 flex items-center gap-2 bg-gray-50 flex-shrink-0">
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Grade AI</span>
            <span className="text-gray-400 text-xs">/</span>
            <div className="flex items-center gap-1.5">
              {(() => { const I = current.icon; return <I className="h-3 w-3 text-amber-400" />; })()}
              <span className="text-[10px] text-amber-600 font-mono uppercase tracking-widest">
                {current.label}
              </span>
            </div>
          </div>

          {!isReady ? (
            <div className="flex flex-col items-center justify-center h-80 gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-400/10 flex items-center justify-center ring-1 ring-amber-400/20">
                <Brain className="h-6 w-6 text-amber-400 animate-pulse" />
              </div>
              <p className="text-sm text-gray-600 font-medium">Initialising…</p>
              <p className="text-xs text-gray-500">Connecting to PostgreSQL</p>
            </div>
          ) : (
            <div className="p-6">
              {activeTab === 'exams'     && <ExamsTab     teacherId={teacherId} onExamCreated={refresh} />}
              {activeTab === 'upload'    && <UploadTab    teacherId={teacherId} onSubmissionCreated={refresh} />}
              {activeTab === 'results'   && <ResultsTab   refreshTrigger={refreshTrigger} />}
              {activeTab === 'review'    && <ReviewTab    refreshTrigger={refreshTrigger} />}
              {activeTab === 'analytics' && <AnalyticsTab refreshTrigger={refreshTrigger} />}
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="md:hidden flex border-t border-gray-200 bg-gray-50 sticky bottom-0 z-50">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                active ? 'text-amber-600' : 'text-gray-500'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}