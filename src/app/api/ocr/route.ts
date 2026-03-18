/**
 * OCR API — Advanced handwriting & document text recognition
 * POST /api/ocr
 *
 * Supports:
 *  • JPEG / PNG / WebP / TIFF  — direct Groq Vision OCR
 *  • PDF (up to 50 pages)      — dual-strategy: native text layer + vision OCR per page
 *                                processed in concurrent batches of 5
 *
 * Worker fix:
 *  pdfjs-dist must be listed in next.config.ts → serverExternalPackages
 *  so webpack does NOT bundle it. That keeps the relative ./pdf.worker.js
 *  path intact and eliminates the "Setting up fake worker failed" error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, access, mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { constants } from 'fs';
import path from 'path';
import Groq from 'groq-sdk';

// ── Config ────────────────────────────────────────────────────────────────────
const GROQ_API_KEY  = process.env.GROQ_API_KEY;
const GROQ_MODEL    = process.env.GROQ_OCR_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const UPLOAD_DIR    = process.env.UPLOAD_DIR  || 'uploads';
const TEMP_DIR      = process.env.TEMP_DIR    || 'temp';
const MAX_PDF_PAGES = 50;   // maximum pages to process
const BATCH_SIZE    = 5;    // concurrent pages per batch (controls memory/API rate)

if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY environment variable is not set');

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageExtraction {
  pageNumber: number;
  rawText:    string;
  sections: {
    mainText:     string[];
    mathematics:  string[];
    code:         string[];
    tables:       TableBlock[];
    diagrams:     DiagramBlock[];
    annotations:  string[];
    lists:        string[];
  };
  confidence: 'high' | 'medium' | 'low';
  wordCount:  number;
}

interface TableBlock {
  title?:   string;
  headers:  string[];
  rows:     string[][];
}

interface DiagramBlock {
  type:        string;
  description: string;
  labels:      string[];
}

// ── Lazy pdfjs loader (singleton) ────────────────────────────────────────────
// Must be lazy so the module is NOT imported at build time (which would trigger
// webpack bundling). The serverExternalPackages config keeps it out of bundles,
// but require() at module-top-level can still cause issues in some Next.js
// versions — lazy loading is the safest pattern.

let _pdfjsLib: any = null;

function getPdfjs(): any {
  if (_pdfjsLib) return _pdfjsLib;

  // Load legacy build — designed for non-browser (Node.js) environments
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

  // For Node.js server-side, set workerSrc to empty string.
  // This activates pdfjs "fake worker" mode which runs synchronously in-process.
  // It works correctly ONLY when pdfjs-dist is loaded from node_modules directly
  // (i.e. not bundled by webpack) — which is guaranteed by serverExternalPackages.
  _pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  return _pdfjsLib;
}

// ── OCR prompt ────────────────────────────────────────────────────────────────

function buildOCRPrompt(questionText?: string, pageNum?: number, totalPages?: number): string {
  const pageCtx  = totalPages && totalPages > 1 ? `This is page ${pageNum} of ${totalPages}.\n` : '';
  const qCtx     = questionText ? `The student is answering: "${questionText}"\n\n` : '';

  return `${pageCtx}${qCtx}You are an expert academic document OCR engine. Extract EVERY piece of content from this image with maximum fidelity.

EXTRACTION RULES:
1. TEXT        — Extract every word verbatim. Preserve paragraphs and line breaks.
2. MATHEMATICS — Capture all formulas/symbols exactly (∫, ∑, √, ±, ≤, ≥, ≠, π, α, β, γ, θ, λ, μ, σ, ∂, ∇, ∞, ∈, ∉, ⊂, ⊃, ∪, ∩, →, ⇒, ↔). Use $inline$ and $$block$$ notation.
3. CODE        — Preserve code blocks with exact indentation. Wrap in \`\`\`language\\n...\\n\`\`\`.
4. TABLES      — Reproduce every row and column accurately.
5. DIAGRAMS    — Describe every visual element inside [DIAGRAM: ...] tags including all labels, arrows, axis names, data points, and relationships.
6. LISTS       — Preserve numbered and bulleted lists exactly.
7. ANNOTATIONS — Capture margin notes, underlines, circled text, footnotes.
8. UNCLEAR     — Mark illegible portions with [?unclear?] but extract surrounding context.

RESPOND WITH VALID JSON ONLY (no markdown fences, no preamble):

{
  "rawText": "complete verbatim extracted text with newlines preserved",
  "sections": {
    "mainText":    ["paragraph 1", "paragraph 2"],
    "mathematics": ["$x^2 + y^2 = r^2$", "$$\\\\int_0^\\\\infty e^{-x}dx = 1$$"],
    "code":        ["\`\`\`python\\nprint('hello')\\n\`\`\`"],
    "tables":      [{ "title": "optional", "headers": ["col1","col2"], "rows": [["v1","v2"]] }],
    "diagrams":    [{ "type": "flowchart|graph|circuit|ER|UML|bar|pie|tree|drawing|other", "description": "detailed description", "labels": ["label1"] }],
    "annotations": ["margin note or footnote"],
    "lists":       ["item 1", "item 2"]
  },
  "confidence": "high|medium|low"
}`;
}

// ── Vision OCR for a single image ─────────────────────────────────────────────

async function ocrImage(
  imagePath: string,
  mimeType:  string,
  questionText?: string,
  pageNum?:      number,
  totalPages?:   number,
): Promise<PageExtraction> {
  const buf    = await readFile(imagePath);
  const base64 = buf.toString('base64');
  const prompt = buildOCRPrompt(questionText, pageNum, totalPages);

  try {
    const completion = await groq.chat.completions.create({
      model:              GROQ_MODEL,
      temperature:        0.05,
      max_completion_tokens: 4096,
      top_p:              0.95,
      stream:             false,
      messages: [{
        role:    'user',
        content: [
          { type: 'text',      text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      }],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    return parseOCRResponse(raw, pageNum ?? 1);
  } catch (err) {
    console.error(`[OCR] Groq error page ${pageNum}:`, err);
    return emptyPage(pageNum ?? 1);
  }
}

// ── Parse Groq JSON response ──────────────────────────────────────────────────

function parseOCRResponse(raw: string, pageNum: number): PageExtraction {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed   = JSON.parse(cleaned);
    const sections = parsed.sections ?? {};

    return {
      pageNumber: pageNum,
      rawText:    parsed.rawText ?? cleaned,
      sections: {
        mainText:    toStringArray(sections.mainText),
        mathematics: toStringArray(sections.mathematics),
        code:        toStringArray(sections.code),
        tables:      toTableArray(sections.tables),
        diagrams:    toDiagramArray(sections.diagrams),
        annotations: toStringArray(sections.annotations),
        lists:       toStringArray(sections.lists),
      },
      confidence: (['high','medium','low'] as const).includes(parsed.confidence)
        ? parsed.confidence
        : estimateConfidence(parsed.rawText ?? ''),
      wordCount: wordCount(parsed.rawText ?? ''),
    };
  } catch {
    return {
      pageNumber: pageNum,
      rawText:    cleaned,
      sections: {
        mainText:    cleaned ? [cleaned] : [],
        mathematics: [],
        code:        [],
        tables:      [],
        diagrams:    [],
        annotations: [],
        lists:       [],
      },
      confidence: estimateConfidence(cleaned),
      wordCount:  wordCount(cleaned),
    };
  }
}

// ── Process a single PDF page ─────────────────────────────────────────────────

async function processPDFPage(
  pdf:          any,
  pageNum:      number,
  totalPages:   number,
  tempDir:      string,
  questionText?: string,
): Promise<PageExtraction> {
  const page = await pdf.getPage(pageNum);

  // ── Strategy 1: native text layer (fast, no API call needed) ─────────────
  let nativeText = '';
  try {
    const tc = await page.getTextContent({ normalizeWhitespace: true });
    nativeText = tc.items
      .map((item: { str: string }) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch { /* page has no text layer */ }

  // ── Strategy 2: vision OCR on high-res render ─────────────────────────────
  let visionExtraction: PageExtraction = emptyPage(pageNum);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require('canvas');
    const scale    = 3.0; // 3× for crisp OCR
    const viewport = page.getViewport({ scale });
    const canvas   = createCanvas(viewport.width, viewport.height);
    const ctx      = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const imgPath = path.join(tempDir, `p${pageNum}.png`);
    await writeFile(imgPath, canvas.toBuffer('image/png', { compressionLevel: 1 }));

    visionExtraction = await ocrImage(imgPath, 'image/png', questionText, pageNum, totalPages);

    // Clean up immediately to save disk
    try { await rm(imgPath, { force: true }); } catch { /* ignore */ }
  } catch (err) {
    console.warn(`[OCR] Vision render failed for page ${pageNum}:`, (err as Error).message);
  }

  // ── Merge: use whichever gives richer content ─────────────────────────────
  // Prefer vision extraction (structured) but supplement with native text if longer
  if (nativeText.length > visionExtraction.rawText.length * 1.2) {
    // Native text is significantly longer → override rawText but keep sections
    visionExtraction.rawText = nativeText;
    if (!visionExtraction.sections.mainText.length) {
      visionExtraction.sections.mainText = [nativeText];
    }
    // Upgrade confidence if native text is good quality
    if (nativeText.length > 100 && visionExtraction.confidence === 'low') {
      visionExtraction.confidence = 'medium';
    }
  }

  visionExtraction.pageNumber = pageNum;
  visionExtraction.wordCount  = wordCount(visionExtraction.rawText);

  return visionExtraction;
}

// ── Process an entire PDF (up to MAX_PDF_PAGES, in batches) ──────────────────

async function processPDF(
  pdfPath:     string,
  questionText?: string,
): Promise<PageExtraction[]> {
  const tempId  = `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const tempDir = path.join(process.cwd(), TEMP_DIR, tempId);
  await mkdir(tempDir, { recursive: true });

  const pages: PageExtraction[] = [];

  try {
    const pdfjsLib = getPdfjs();

    const pdfBuffer = await readFile(pdfPath);
    const pdfData   = new Uint8Array(pdfBuffer);

    const pdf = await pdfjsLib.getDocument({
      data:                      pdfData,
      disableAutoFetch:          false,
      disableStream:             false,
      isEvalSupported:           false,
      useSystemFonts:            true,
      fontExtraProperties:       false,
      useWorkerFetch:            false,
      isOffscreenCanvasSupported: false,
    }).promise;

    const totalPages  = pdf.numPages;
    const pagesToProc = Math.min(totalPages, MAX_PDF_PAGES);

    console.log(`[OCR] PDF: ${totalPages} pages total, processing ${pagesToProc}`);

    // Process in batches to balance memory, concurrency, and API rate limits
    for (let batchStart = 1; batchStart <= pagesToProc; batchStart += BATCH_SIZE) {
      const batchEnd    = Math.min(batchStart + BATCH_SIZE - 1, pagesToProc);
      const batchNums   = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

      console.log(`[OCR] Processing batch: pages ${batchStart}–${batchEnd}`);

      const batchResults = await Promise.all(
        batchNums.map(n => processPDFPage(pdf, n, totalPages, tempDir, questionText))
      );

      pages.push(...batchResults);
    }

    if (totalPages > MAX_PDF_PAGES) {
      // Append a synthetic page noting the truncation
      pages.push({
        pageNumber: MAX_PDF_PAGES + 1,
        rawText:    `[Note: PDF has ${totalPages} pages. Only the first ${MAX_PDF_PAGES} were processed.]`,
        sections: {
          mainText:    [`[Note: PDF has ${totalPages} pages. Only the first ${MAX_PDF_PAGES} were processed.]`],
          mathematics: [], code: [], tables: [], diagrams: [], annotations: [], lists: [],
        },
        confidence: 'high',
        wordCount:  0,
      });
    }
  } catch (err) {
    console.error('[OCR] PDF processing error:', err);
    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        rawText:    '[PDF could not be processed. Try uploading as individual images.]',
        sections: {
          mainText:    ['[PDF could not be processed. Try uploading as individual images.]'],
          mathematics: [], code: [], tables: [], diagrams: [], annotations: [], lists: [],
        },
        confidence: 'low',
        wordCount:  0,
      });
    }
  } finally {
    // Always clean up temp dir
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  return pages;
}

// ── Flat text (for grading API backward compat) ───────────────────────────────

function flattenPages(pages: PageExtraction[]): string {
  return pages
    .map(p => {
      const parts: string[] = [];
      if (pages.length > 1) parts.push(`=== Page ${p.pageNumber} ===`);
      if (p.rawText)        parts.push(p.rawText);
      return parts.join('\n');
    })
    .join('\n\n');
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, questionText } = body as { filePath?: string; questionText?: string };

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 });
    }

    const fullPath = path.join(process.cwd(), UPLOAD_DIR, filePath);

    try {
      await access(fullPath, constants.R_OK);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const ext           = path.extname(filePath).replace('.', '').toLowerCase();
    const supportedExts = ['jpg','jpeg','png','webp','tiff','tif','pdf'];

    if (!supportedExts.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format: ${ext}. Supported: ${supportedExts.join(', ')}` },
        { status: 400 },
      );
    }

    let pages: PageExtraction[];

    if (ext === 'pdf') {
      pages = await processPDF(fullPath, questionText);
    } else {
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg',
        png: 'image/png',  webp: 'image/webp',
        tiff: 'image/tiff', tif: 'image/tiff',
      };
      pages = [await ocrImage(fullPath, mimeMap[ext] ?? 'image/jpeg', questionText, 1, 1)];
    }

    const flatText          = flattenPages(pages);
    const overallConfidence = pages.some(p => p.confidence === 'high')   ? 'high'
                            : pages.some(p => p.confidence === 'medium') ? 'medium'
                            : 'low';

    return NextResponse.json({
      success:         true,
      text:            flatText,           // legacy field — grading API reads this
      confidence:      overallConfidence,  // legacy field
      pages,                               // rich page-wise data for the viewer
      totalPages:      pages.length,
      filePath,
      timestamp:       new Date().toISOString(),
    });
  } catch (err) {
    console.error('[OCR] Route error:', err);
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyPage(n: number): PageExtraction {
  return {
    pageNumber: n,
    rawText:    '',
    sections:   { mainText: [], mathematics: [], code: [], tables: [], diagrams: [], annotations: [], lists: [] },
    confidence: 'low',
    wordCount:  0,
  };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateConfidence(text: string): 'high' | 'medium' | 'low' {
  const unclear = (text.match(/\[?unclear\]?/gi) ?? []).length;
  if (!text || text.length < 20) return 'low';
  if (unclear > 5)               return 'low';
  if (unclear > 1)               return 'medium';
  return 'high';
}

function toStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => typeof v === 'string' && v.trim());
  if (typeof val === 'string' && val.trim()) return [val];
  return [];
}

function toTableArray(val: unknown): TableBlock[] {
  if (!Array.isArray(val)) return [];
  return val.filter((t): t is TableBlock => t && typeof t === 'object' && Array.isArray((t as TableBlock).headers));
}

function toDiagramArray(val: unknown): DiagramBlock[] {
  if (!Array.isArray(val)) return [];
  return val.filter((d): d is DiagramBlock => d && typeof d === 'object' && typeof (d as DiagramBlock).description === 'string');
}