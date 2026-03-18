'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

interface PDFPreviewProps {
  /** The original File object (preferred — works offline, no round-trip) */
  file?: File;
  /** Server-relative path, e.g. "submissionId/q1-123.pdf" */
  filePath?: string;
  className?: string;
  /** Height of the embed area in pixels (default: 420) */
  height?: number;
}

export default function PDFPreview({
  file,
  filePath,
  className = '',
  height = 420,
}: PDFPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Build the URL to embed
  useEffect(() => {
    let url = '';
    if (file) {
      url = URL.createObjectURL(file);
    } else if (filePath) {
      url = `/api/files/${filePath}`;
    }
    setObjectUrl(url);
    setLoading(true);
    setError(false);

    return () => {
      if (file && url) URL.revokeObjectURL(url);
    };
  }, [file, filePath]);

  const handleDownload = () => {
    if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (filePath) {
      window.open(`/api/files/${filePath}?download=true`, '_blank');
    }
  };

  const handleOpenNewTab = () => {
    if (objectUrl) window.open(objectUrl, '_blank');
  };

  const displayName = file?.name ?? (filePath ? filePath.split('/').pop() : 'Document');
  const displaySize = file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : null;

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden shadow-sm ${className}`}>
      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 flex-shrink-0">
            <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate text-foreground">{displayName}</p>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">PDF</Badge>
              {displaySize && (
                <span className="text-[11px] text-muted-foreground">{displaySize}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenNewTab}
            className="h-7 px-2 text-xs gap-1"
            title="Open in new tab"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Open</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 text-xs gap-1"
            title="Download"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      </div>

      {/* ── Embed area ───────────────────────────────────────────────────── */}
      <div className="relative bg-gray-50 dark:bg-gray-900" style={{ height }}>
        {/* Loading overlay */}
        {loading && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-gray-50/90 dark:bg-gray-900/90">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading PDF…</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center bg-gray-50 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Preview unavailable</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your browser couldn't render this PDF inline.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button size="sm" variant="outline" onClick={handleOpenNewTab} className="gap-1.5">
                <ExternalLink className="h-3 w-3" />
                Open in new tab
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5">
                <Download className="h-3 w-3" />
                Download
              </Button>
            </div>
          </div>
        )}

        {/* PDF iframe */}
        {objectUrl && !error && (
          <iframe
            key={objectUrl}
            src={`${objectUrl}#toolbar=1&navpanes=1&view=FitH`}
            className="h-full w-full border-0"
            title="PDF preview"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        )}
      </div>

      {/* ── Footer tip ───────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-border bg-muted/20">
        <p className="text-[11px] text-muted-foreground">
          Scroll or use the toolbar inside the preview to navigate pages.
        </p>
      </div>
    </div>
  );
}