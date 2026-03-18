/**
 * Structured PDF Extraction API
 * POST /api/structured-pdf
 *
 * Extracts rich structured content (text, math, tables, diagrams, code)
 * from each page of a PDF using Llama 4 Vision.
 *
 * Returns the same PageExtraction[] shape as /api/ocr so the client
 * can use a single viewer component for both images and PDFs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, access, mkdir, rm } from 'fs/promises';
import { constants } from 'fs';
import { writeFileSync, unlinkSync, statSync } from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import type { PageExtraction } from '../ocr/route';

// ── Config ────────────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_OCR_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const TEMP_DIR = process.env.TEMP_DIR || 'temp';

if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ── Prompt ────────────────────────────────────────────────────────────────────

function pagePrompt(pageNum: number, totalPages: number): string {
  return `You are an expert document digitization engine. This is page ${pageNum} of ${totalPages} from an academic PDF.

Extract EVERY piece of content with maximum fidelity:

1. TEXT — verbatim, preserving paragraphs.
2. MATHEMATICS — exact symbols and notation. Inline: $expr$, block: $$expr$$.
3. CODE — preserve indentation and syntax. Use \`\`\`language\\n...\\n\`\`\`.
4. TABLES — reproduce full structure in markdown-table format.
5. DIAGRAMS / FIGURES — describe completely inside [DIAGRAM: ...] with labels, arrows, axis names, data points, flow direction.
6. ANNOTATIONS / FOOTNOTES — any margin notes, footnotes, or callouts.
7. LISTS — numbered or bulleted, exact items.

Respond ONLY with a valid JSON object (no markdown fences, no commentary):

{
  "rawText": "full verbatim text of the page with newlines",
  "sections": {
    "mainText": ["para 1", "para 2"],
    "mathematics": ["$x^2 + y^2 = r^2$", "$$\\\\int_0^\\\\infty e^{-x} dx = 1$$"],
    "code": ["\`\`\`python\\nprint('hello')\\n\`\`\`"],
    "tables": [{ "title": "", "headers": ["A","B"], "rows": [["1","2"]] }],
    "diagrams": [{ "type": "flowchart", "description": "...", "labels": ["Start","End"] }],
    "annotations": ["footnote text"],
    "lists": ["item 1", "item 2"]
  },
  "confidence": "high"
}`;
}

// ── Extract one page ──────────────────────────────────────────────────────────

async function extractPage(
  imagePath: string,
  pageNum: number,
  totalPages: number
): Promise<PageExtraction> {
  const imageBuffer = await readFile(imagePath);
  const base64 = imageBuffer.toString('base64');

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: pagePrompt(pageNum, totalPages) },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64}` },
            },
          ],
        },
      ],
      temperature: 0.05,
      max_completion_tokens: 4096,
      top_p: 0.95,
      stream: false,
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    const parsed = JSON.parse(cleaned);
    const s = parsed.sections ?? {};

    const words = (parsed.rawText ?? '').trim().split(/\s+/).filter(Boolean).length;

    return {
      pageNumber: pageNum,
      rawText: parsed.rawText ?? '',
      sections: {
        mainText: arr(s.mainText),
        mathematics: arr(s.mathematics),
        code: arr(s.code),
        tables: tableArr(s.tables),
        diagrams: diagramArr(s.diagrams),
        annotations: arr(s.annotations),
        lists: arr(s.lists),
      },
      confidence: (['high', 'medium', 'low'] as const).includes(parsed.confidence)
        ? parsed.confidence
        : words > 50 ? 'medium' : 'low',
      wordCount: words,
    };
  } catch (err) {
    console.error(`Page ${pageNum} extraction error:`, err);
    return emptyPage(pageNum);
  }
}

// ── PDF → pages ───────────────────────────────────────────────────────────────

async function extractPDF(pdfPath: string): Promise<{
  pages: PageExtraction[];
  totalPages: number;
  fileSize: string;
  processingMs: number;
}> {
  const t0 = Date.now();
  const tempId = `spdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tempDir = path.join(process.cwd(), TEMP_DIR, tempId);
  await mkdir(tempDir, { recursive: true });

  const pages: PageExtraction[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    
    // Configure PDF.js for server-side usage (no worker)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const pdfBuffer = await readFile(pdfPath);
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      isEvalSupported: false,
      useSystemFonts: true,
      fontExtraProperties: false,
      useWorkerFetch: false,
      isOffscreenCanvasSupported: false,
    }).promise;

    const totalPages: number = pdf.numPages;

    for (let n = 1; n <= totalPages; n++) {
      const page = await pdf.getPage(n);

      // Render at 3× for crisp OCR
      const { createCanvas } = require('canvas');
      const vp = page.getViewport({ scale: 3.0 });
      const canvas = createCanvas(vp.width, vp.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, vp.width, vp.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      const imgPath = path.join(tempDir, `p${n}.png`);
      writeFileSync(imgPath, canvas.toBuffer('image/png', { compressionLevel: 1 }));

      const extraction = await extractPage(imgPath, n, totalPages);

      // Also pull native text layer for fallback
      try {
        const tc = await page.getTextContent({ normalizeWhitespace: true });
        const layerText = tc.items
          .map((i: { str: string }) => i.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (layerText.length > extraction.rawText.length) {
          extraction.rawText = layerText;
          if (!extraction.sections.mainText.length) {
            extraction.sections.mainText = [layerText];
          }
        }
      } catch {/* no text layer */}

      unlinkSync(imgPath);
      pages.push(extraction);
    }

    const stat = statSync(pdfPath);
    return {
      pages,
      totalPages,
      fileSize: `${(stat.size / 1024).toFixed(1)} KB`,
      processingMs: Date.now() - t0,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyPage(n: number): PageExtraction {
  return {
    pageNumber: n,
    rawText: '',
    sections: { mainText: [], mathematics: [], code: [], tables: [], diagrams: [], annotations: [], lists: [] },
    confidence: 'low',
    wordCount: 0,
  };
}

function arr(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim());
  if (typeof v === 'string' && v.trim()) return [v];
  return [];
}

function tableArr(v: unknown): PageExtraction['sections']['tables'] {
  if (!Array.isArray(v)) return [];
  return v.filter((t) => t && Array.isArray(t.headers));
}

function diagramArr(v: unknown): PageExtraction['sections']['diagrams'] {
  if (!Array.isArray(v)) return [];
  return v.filter((d) => d && typeof d.description === 'string');
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { filePath } = (await request.json()) as { filePath?: string };

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 });
    }

    const fullPath = path.join(process.cwd(), UPLOAD_DIR, filePath);
    try {
      await access(fullPath, constants.R_OK);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    if (ext !== 'pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    const { pages, totalPages, fileSize, processingMs } = await extractPDF(fullPath);

    const avgConf =
      pages.reduce((s, p) => s + (p.confidence === 'high' ? 3 : p.confidence === 'medium' ? 2 : 1), 0) /
      Math.max(pages.length, 1);

    return NextResponse.json({
      success: true,
      pages,
      totalPages,
      summary: {
        totalTables: pages.reduce((s, p) => s + p.sections.tables.length, 0),
        totalDiagrams: pages.reduce((s, p) => s + p.sections.diagrams.length, 0),
        totalMathItems: pages.reduce((s, p) => s + p.sections.mathematics.length, 0),
        totalAnnotations: pages.reduce((s, p) => s + p.sections.annotations.length, 0),
        averageConfidence: avgConf >= 2.5 ? 'high' : avgConf >= 1.5 ? 'medium' : 'low',
      },
      metadata: {
        fileName: path.basename(filePath),
        fileSize,
        processingMs,
      },
      // Flat text for backward compat
      text: pages.map((p) => `=== Page ${p.pageNumber} ===\n${p.rawText}`).join('\n\n'),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Structured PDF error:', err);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}