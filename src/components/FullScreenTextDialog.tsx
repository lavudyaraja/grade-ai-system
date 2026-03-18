'use client';

/**
 * FullScreenTextDialog
 *
 * Features:
 *  • All text in white / slate-200 on dark background
 *  • Copy all content to clipboard
 *  • Print extracted content
 *  • True browser fullscreen (F11-style via Fullscreen API)
 *  • Font-size controls  (decrease / reset / increase)
 *  • Keyboard shortcuts panel (? key)
 *  • Escape to close
 *  • Body scroll lock while open
 *  • Animated open / slide-up
 *  • Tab key trapped inside panel (accessibility)
 *  • Footer with meta info slot
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X, Copy, Check, Printer, Maximize2, Minimize2,
  ZoomIn, ZoomOut, RotateCcw, HelpCircle, ChevronRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FullScreenTextDialogProps {
  open:        boolean;
  onClose:     () => void;
  title:       string;
  /** Short subtitle shown below the title */
  description?: string;
  /** Optional breadcrumb items, e.g. ['Grade AI', 'Upload', 'Q3'] */
  breadcrumb?:  string[];
  /** Optional footer text / node */
  footer?:      React.ReactNode;
  children:     React.ReactNode;
}

// ── Keyboard shortcut map ──────────────────────────────────────────────────────

const SHORTCUTS = [
  { key: 'Esc',   action: 'Close dialog'        },
  { key: 'F',     action: 'Toggle fullscreen'    },
  { key: 'C',     action: 'Copy all content'     },
  { key: 'P',     action: 'Print'                },
  { key: '+',     action: 'Increase font size'   },
  { key: '−',     action: 'Decrease font size'   },
  { key: '0',     action: 'Reset font size'      },
  { key: '?',     action: 'Toggle this panel'    },
];

// ── Icon button helper ────────────────────────────────────────────────────────

function IconBtn({
  onClick, title, children, active = false, danger = false,
}: {
  onClick: () => void;
  title:   string;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const base  = active  ? 'rgba(251,191,36,0.15)' : danger ? 'transparent'          : 'rgba(0,0,0,0.08)';
  const hov   = danger  ? 'rgba(239,68,68,0.12)'  : active ? 'rgba(251,191,36,0.25)': 'rgba(0,0,0,0.15)';
  const col   = active  ? '#fbbf24'               : danger && hover ? '#f87171'      : '#000000';
  const hcol  = active  ? '#fcd34d'               : '#000000';

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? hov : base,
        color:      hover ? hcol : col,
        border:     active ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(0,0,0,0.1)',
        borderRadius: '8px',
        width: '30px',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FullScreenTextDialog({
  open,
  onClose,
  title,
  description,
  breadcrumb,
  footer,
  children,
}: FullScreenTextDialogProps) {
  const panelRef    = useRef<HTMLDivElement>(null);
  const contentRef  = useRef<HTMLDivElement>(null);

  const [copied,      setCopied]     = useState(false);
  const [fontSize,    setFontSize]   = useState(14);   // px
  const [isFullscreen, setFullscreen] = useState(false);
  const [showShortcuts, setShortcuts] = useState(false);

  const MIN_FONT = 10;
  const MAX_FONT = 22;

  // ── Copy all ────────────────────────────────────────────────────────────────
  const copyAll = useCallback(() => {
    const text = contentRef.current?.innerText ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, []);

  // ── Print ───────────────────────────────────────────────────────────────────
  const print = useCallback(() => {
    const content = contentRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'DM Sans', system-ui, sans-serif; font-size: 14px; color: #000; padding: 2rem; }
            pre, code { font-family: monospace; background: #f5f5f5; padding: 0.25rem 0.5rem; border-radius: 4px; }
            h1 { font-size: 18px; margin-bottom: 0.5rem; }
            p  { margin: 0.25rem 0 0.5rem; font-size: 12px; color: #666; }
            hr { margin: 1rem 0; border: none; border-top: 1px solid #e5e5e5; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          ${description ? `<p>${description}</p>` : ''}
          <hr />
          ${content}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }, [title, description]);

  // ── Browser fullscreen ───────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!panelRef.current) return;
    if (!document.fullscreenElement) {
      panelRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  }, []);

  // Sync fullscreen state if user presses Esc while in browser fullscreen
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      // Don't fire when user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (e.key === 'Escape') { onClose(); return; }
      if (isInput) return;

      switch (e.key) {
        case 'f': case 'F': toggleFullscreen(); break;
        case 'c': case 'C': copyAll(); break;
        case 'p': case 'P': e.preventDefault(); print(); break;
        case '+': case '=': setFontSize(s => Math.min(MAX_FONT, s + 1)); break;
        case '-': case '_': setFontSize(s => Math.max(MIN_FONT, s - 1)); break;
        case '0': setFontSize(14); break;
        case '?': setShortcuts(v => !v); break;
        default: break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, copyAll, print, toggleFullscreen]);

  // ── Body scroll lock ──────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ── Focus trap (accessibility) ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [open]);

  if (!open) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-white"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative z-10 flex flex-col w-full max-w-7xl mx-2 my-2 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background:  '#ffffff',
          border:      '1px solid rgba(0,0,0,0.15)',
          animation:   'dialogSlideUp 0.18s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0 gap-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.15)', background: 'rgba(0,0,0,0.05)' }}
        >
          {/* Left: breadcrumb + title */}
          <div className="min-w-0 flex-1">
            {/* Breadcrumb */}
            {breadcrumb && breadcrumb.length > 0 && (
              <div className="flex items-center gap-1 mb-1 flex-wrap">
                {breadcrumb.map((crumb, i) => (
                  <React.Fragment key={i}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {crumb}
                    </span>
                    {i < breadcrumb.length - 1 && (
                      <ChevronRight style={{ width: '10px', height: '10px', color: '#000000', flexShrink: 0 }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Title */}
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#000000', lineHeight: 1.3 }} className="truncate">
              {title}
            </h2>

            {/* Description */}
            {description && (
              <p style={{ fontSize: '11px', color: '#000000', fontFamily: 'monospace', marginTop: '2px' }}>
                {description}
              </p>
            )}
          </div>

          {/* Right: toolbar */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Font size */}
            <div className="flex items-center gap-1 mr-1">
              <IconBtn onClick={() => setFontSize(s => Math.max(MIN_FONT, s - 1))} title="Decrease font size (−)">
                <ZoomOut style={{ width: '13px', height: '13px' }} />
              </IconBtn>
              <span
                title="Reset font size (0)"
                onClick={() => setFontSize(14)}
                style={{
                  fontSize: '10px', fontFamily: 'monospace', color: '#000000',
                  minWidth: '28px', textAlign: 'center', cursor: 'pointer',
                  padding: '2px 4px', borderRadius: '4px',
                  userSelect: 'none',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.color = '#000000'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.color = '#000000'; }}
              >
                {fontSize}px
              </span>
              <IconBtn onClick={() => setFontSize(s => Math.min(MAX_FONT, s + 1))} title="Increase font size (+)">
                <ZoomIn style={{ width: '13px', height: '13px' }} />
              </IconBtn>
              <IconBtn onClick={() => setFontSize(14)} title="Reset font size (0)">
                <RotateCcw style={{ width: '13px', height: '13px' }} />
              </IconBtn>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.15)' }} />

            {/* Copy */}
            <IconBtn onClick={copyAll} title="Copy all content (C)" active={copied}>
              {copied
                ? <Check   style={{ width: '13px', height: '13px' }} />
                : <Copy    style={{ width: '13px', height: '13px' }} />
              }
            </IconBtn>

            {/* Print */}
            <IconBtn onClick={print} title="Print (P)">
              <Printer style={{ width: '13px', height: '13px' }} />
            </IconBtn>

            {/* Fullscreen */}
            <IconBtn onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} active={isFullscreen}>
              {isFullscreen
                ? <Minimize2 style={{ width: '13px', height: '13px' }} />
                : <Maximize2 style={{ width: '13px', height: '13px' }} />
              }
            </IconBtn>

            {/* Shortcuts */}
            <IconBtn onClick={() => setShortcuts(v => !v)} title="Keyboard shortcuts (?)" active={showShortcuts}>
              <HelpCircle style={{ width: '13px', height: '13px' }} />
            </IconBtn>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.15)' }} />

            {/* Close */}
            <IconBtn onClick={onClose} title="Close (Esc)" danger>
              <X style={{ width: '13px', height: '13px' }} />
            </IconBtn>
          </div>
        </div>

        {/* ── Keyboard shortcut panel (collapsible) ─────────────────── */}
        {showShortcuts && (
          <div
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(251,191,36,0.04)',
              padding: '12px 20px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 24px',
            }}
          >
            <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.12em', width: '100%', marginBottom: '4px' }}>
              Keyboard Shortcuts
            </p>
            {SHORTCUTS.map(({ key, action }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <kbd style={{
                  fontSize: '10px', fontFamily: 'monospace',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px', padding: '1px 6px',
                  color: '#e2e8f0',
                  minWidth: '20px', textAlign: 'center',
                }}>
                  {key}
                </kbd>
                <span style={{ fontSize: '11px', color: '#000000' }}>{action}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Scrollable content body ────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ '--dialog-font-size': `${fontSize}px` } as React.CSSProperties}
        >
          {/* Copy success toast */}
          {copied && (
            <div
              style={{
                position: 'sticky', top: '12px', zIndex: 10,
                display: 'flex', justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(52,211,153,0.15)',
                border: '1px solid rgba(52,211,153,0.3)',
                borderRadius: '999px', padding: '4px 14px',
                fontSize: '11px', fontFamily: 'monospace',
                color: '#34d399',
              }}>
                <Check style={{ width: '12px', height: '12px' }} />
                Copied to clipboard
              </div>
            </div>
          )}

          {/* Content wrapper — applies font size var */}
          <div
            ref={contentRef}
            style={{
              padding: '20px',
              fontSize: 'var(--dialog-font-size)',
              color: '#000000',    /* black — all text inherits this */
              lineHeight: 1.65,
            }}
          >
            {children}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        {footer && (
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.01)',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '11px', color: '#000000', fontFamily: 'monospace' }}>
              {footer}
            </div>
            <div style={{ fontSize: '10px', color: '#000000', fontFamily: 'monospace' }}>
              Press <kbd style={{ background: 'rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.2)', borderRadius: '3px', padding: '0 4px', color: '#000000' }}>?</kbd> for shortcuts
            </div>
          </div>
        )}
      </div>

      {/* ── Slide-up animation ─────────────────────────────────────── */}
      <style>{`
        @keyframes dialogSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        /* Force all text inside the content area to be white/light */
        [data-dialog-content] *,
        .dialog-content-area * {
          color: inherit;
        }

        /* Scrollbar styling */
        [role="dialog"] ::-webkit-scrollbar       { width: 5px; height: 5px; }
        [role="dialog"] ::-webkit-scrollbar-track { background: transparent; }
        [role="dialog"] ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 9999px; }
        [role="dialog"] ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      `}</style>
    </div>
  );
}