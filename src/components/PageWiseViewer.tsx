'use client';

/**
 * PageWiseViewer
 * Displays page-structured OCR extraction results inside the dialog.
 * Works for both single images (1 page) and PDFs (N pages).
 */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Calculator,
  Code2,
  Table2,
  Image as ImageIcon,
  MessageSquare,
  List,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import type { PageExtraction } from '@/app/api/ocr/route';

interface PageWiseViewerProps {
  pages: PageExtraction[];
  /** Total pages reported by the server (may differ from pages.length if truncated) */
  totalPages?: number;
  /** Optional metadata to show in header */
  metadata?: {
    fileName?: string;
    fileSize?: string;
    processingMs?: number;
  };
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  if (confidence === 'high')
    return (
      <Badge className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300/50">
        <CheckCircle className="h-3 w-3" /> High
      </Badge>
    );
  if (confidence === 'medium')
    return (
      <Badge className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300/50">
        <AlertTriangle className="h-3 w-3" /> Medium
      </Badge>
    );
  return (
    <Badge className="gap-1 bg-red-500/10 text-red-700 dark:text-red-400 border-red-300/50">
      <AlertCircle className="h-3 w-3" /> Low
    </Badge>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-[11px] gap-1">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

// ── Section block ─────────────────────────────────────────────────────────────

function SectionBlock({
  label,
  icon,
  colorClass,
  children,
  empty,
}: {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  if (empty) return null;
  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

// ── Table renderer ────────────────────────────────────────────────────────────

function TableRenderer({ table }: { table: PageExtraction['sections']['tables'][number] }) {
  return (
    <div className="overflow-x-auto rounded-lg">
      {table.title && (
        <p className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">{table.title}</p>
      )}
      <table className="w-full text-xs border-collapse">
        {table.headers.length > 0 && (
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className="border border-current/20 px-3 py-1.5 text-left font-semibold bg-black/5 dark:bg-white/5"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className="even:bg-black/[0.02] dark:even:bg-white/[0.02]">
              {row.map((cell, ci) => (
                <td key={ci} className="border border-current/20 px-3 py-1.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Single page view ──────────────────────────────────────────────────────────

function PageView({ page }: { page: PageExtraction }) {
  const { sections } = page;
  const hasContent =
    sections.mainText.length ||
    sections.mathematics.length ||
    sections.code.length ||
    sections.tables.length ||
    sections.diagrams.length ||
    sections.annotations.length ||
    sections.lists.length;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <ConfidenceBadge confidence={page.confidence} />
        <span className="text-xs text-muted-foreground">{page.wordCount} words extracted</span>
      </div>

      {!hasContent && (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
          <AlertCircle className="h-8 w-8 opacity-30" />
          <p className="text-sm">No content could be extracted from this page.</p>
        </div>
      )}

      {/* Main text */}
      <SectionBlock
        label="Text Content"
        icon={<FileText className="h-4 w-4 text-blue-600" />}
        colorClass="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
        empty={!sections.mainText.length}
      >
        <div className="flex justify-end mb-1">
          <CopyButton text={sections.mainText.join('\n\n')} />
        </div>
        <div className="space-y-2">
          {sections.mainText.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
              {para}
            </p>
          ))}
        </div>
      </SectionBlock>

      {/* Mathematics */}
      <SectionBlock
        label="Mathematics & Formulas"
        icon={<Calculator className="h-4 w-4 text-purple-600" />}
        colorClass="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20"
        empty={!sections.mathematics.length}
      >
        <div className="flex justify-end mb-1">
          <CopyButton text={sections.mathematics.join('\n')} />
        </div>
        <div className="space-y-1.5">
          {sections.mathematics.map((m, i) => (
            <div
              key={i}
              className="font-mono text-sm px-3 py-2 rounded-lg bg-purple-100/60 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-700"
            >
              {m}
            </div>
          ))}
        </div>
      </SectionBlock>

      {/* Code */}
      <SectionBlock
        label="Code Blocks"
        icon={<Code2 className="h-4 w-4 text-gray-600" />}
        colorClass="border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/20"
        empty={!sections.code.length}
      >
        {sections.code.map((block, i) => (
          <div key={i} className="relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={block} />
            </div>
            <pre className="text-xs leading-relaxed overflow-x-auto rounded-lg bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 border border-gray-700">
              {block}
            </pre>
          </div>
        ))}
      </SectionBlock>

      {/* Tables */}
      <SectionBlock
        label="Tables"
        icon={<Table2 className="h-4 w-4 text-green-600" />}
        colorClass="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
        empty={!sections.tables.length}
      >
        <div className="space-y-4">
          {sections.tables.map((t, i) => (
            <TableRenderer key={i} table={t} />
          ))}
        </div>
      </SectionBlock>

      {/* Diagrams */}
      <SectionBlock
        label="Diagrams & Visual Elements"
        icon={<ImageIcon className="h-4 w-4 text-orange-600" />}
        colorClass="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
        empty={!sections.diagrams.length}
      >
        <div className="space-y-3">
          {sections.diagrams.map((d, i) => (
            <div
              key={i}
              className="rounded-lg border border-orange-200 dark:border-orange-700 bg-orange-100/40 dark:bg-orange-900/20 p-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 capitalize border-orange-400 text-orange-700 dark:text-orange-300">
                  {d.type}
                </Badge>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{d.description}</p>
              {d.labels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.labels.map((l, li) => (
                    <span key={li} className="text-[10px] bg-orange-200 dark:bg-orange-800 px-2 py-0.5 rounded-full text-orange-800 dark:text-orange-200">
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionBlock>

      {/* Lists */}
      <SectionBlock
        label="Lists"
        icon={<List className="h-4 w-4 text-cyan-600" />}
        colorClass="border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/20"
        empty={!sections.lists.length}
      >
        <ul className="space-y-1">
          {sections.lists.map((item, i) => (
            <li key={i} className="text-sm flex gap-2 text-gray-800 dark:text-gray-200">
              <span className="text-cyan-500 flex-shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      </SectionBlock>

      {/* Annotations */}
      <SectionBlock
        label="Annotations & Notes"
        icon={<MessageSquare className="h-4 w-4 text-amber-600" />}
        colorClass="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
        empty={!sections.annotations.length}
      >
        <div className="space-y-1.5">
          {sections.annotations.map((note, i) => (
            <div
              key={i}
              className="text-sm italic text-amber-900 dark:text-amber-200 border-l-2 border-amber-400 pl-3"
            >
              {note}
            </div>
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PageWiseViewer({ pages, totalPages, metadata }: PageWiseViewerProps) {
  const [currentPage, setCurrentPage] = useState(0); // 0-based index
  const [view, setView] = useState<'structured' | 'raw'>('structured');

  const page = pages[currentPage];
  const total = totalPages ?? pages.length;

  if (!pages.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <AlertCircle className="h-8 w-8 opacity-30" />
        <p className="text-sm">No extraction data available.</p>
      </div>
    );
  }

  // Summary stats
  const totalTables = pages.reduce((s, p) => s + p.sections.tables.length, 0);
  const totalMath = pages.reduce((s, p) => s + p.sections.mathematics.length, 0);
  const totalDiagrams = pages.reduce((s, p) => s + p.sections.diagrams.length, 0);
  const totalWords = pages.reduce((s, p) => s + p.wordCount, 0);

  return (
    <div className="space-y-4">
      {/* ── Summary bar ─────────────────────────────────────────────────── */}
      {(metadata || total > 1) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {metadata?.fileName && (
            <span className="font-medium text-foreground">{metadata.fileName}</span>
          )}
          {metadata?.fileSize && <span>{metadata.fileSize}</span>}
          <span className="ml-auto flex gap-3">
            <span><strong className="text-foreground">{total}</strong> pages</span>
            <span><strong className="text-foreground">{totalWords}</strong> words</span>
            {totalTables > 0 && <span><strong className="text-foreground">{totalTables}</strong> tables</span>}
            {totalMath > 0 && <span><strong className="text-foreground">{totalMath}</strong> math</span>}
            {totalDiagrams > 0 && <span><strong className="text-foreground">{totalDiagrams}</strong> diagrams</span>}
            {metadata?.processingMs && (
              <span>{(metadata.processingMs / 1000).toFixed(1)}s</span>
            )}
          </span>
        </div>
      )}

      {/* ── Navigation + view toggle ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        {/* Page navigation */}
        {pages.length > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {/* Page pills */}
            <div className="flex gap-0.5">
              {pages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                    i === currentPage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
              disabled={currentPage === pages.length - 1}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div />
        )}

        {/* View toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView('structured')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              view === 'structured'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            Structured
          </button>
          <button
            onClick={() => setView('raw')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              view === 'raw'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            Raw Text
          </button>
        </div>
      </div>

      {/* ── Page heading ─────────────────────────────────────────────────── */}
      {pages.length > 1 && (
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <span className="text-sm font-semibold text-foreground">
            Page {page.pageNumber}
          </span>
          <span className="text-xs text-muted-foreground">of {total}</span>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {view === 'structured' ? (
        <PageView page={page} />
      ) : (
        <div className="relative">
          <div className="absolute top-2 right-2">
            <CopyButton text={page.rawText} />
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono text-foreground bg-muted/40 rounded-xl border border-border p-4 overflow-x-auto max-h-[70vh] overflow-y-auto">
            {page.rawText || '(no text extracted)'}
          </pre>
        </div>
      )}
    </div>
  );
}