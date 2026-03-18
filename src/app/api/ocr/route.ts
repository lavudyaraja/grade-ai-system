/**
 * OCR API — Advanced handwriting & document text recognition
 * POST /api/ocr
 *
 * Supports:
 *  • JPEG / PNG / WebP / TIFF  — direct vision OCR
 *  • PDF                       — page-wise image rendering + OCR per page
 *
 * Returns page-structured data so the client can display each page separately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, access, mkdir, rm } from 'fs/promises';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { constants } from 'fs';
import path from 'path';
import Groq from 'groq-sdk';

// ── Config ────────────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_OCR_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const TEMP_DIR = process.env.TEMP_DIR || 'temp';

if (!GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY environment variable is not set');
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageExtraction {
  pageNumber: number;
  rawText: string;
  sections: {
    mainText: string[];
    mathematics: string[];
    code: string[];
    tables: TableBlock[];
    diagrams: DiagramBlock[];
    annotations: string[];
    lists: string[];
  };
  confidence: 'high' | 'medium' | 'low';
  wordCount: number;
}

interface TableBlock {
  title?: string;
  headers: string[];
  rows: string[][];
}

interface DiagramBlock {
  type: string;
  description: string;
  labels: string[];
}

// ── OCR Prompt ────────────────────────────────────────────────────────────────

function buildOCRPrompt(questionText?: string, pageNum?: number, totalPages?: number): string {
  const pageCtx =
    totalPages && totalPages > 1
      ? `This is page ${pageNum} of ${totalPages}.\n`
      : '';

  const questionCtx = questionText
    ? `The student is answering this exam question: "${questionText}"\n\n`
    : '';

  return `${pageCtx}${questionCtx}You are an expert academic document OCR system. Extract ALL content from this image with maximum accuracy.

EXTRACTION RULES:
1. TEXT — Extract every word verbatim. Preserve paragraphs and line breaks.
2. MATHEMATICS — Capture all formulas, equations, symbols exactly (∫, ∑, √, ±, ≤, ≥, ≠, π, α, β, γ, θ, λ, μ, σ, ∂, ∇, ∞, ∈, ∉, ⊂, ⊃, ∪, ∩, →, ⇒, ↔). Write inline math as $formula$ and block math as $$formula$$.
3. CODE — Preserve code blocks exactly with indentation. Wrap in \`\`\`language ... \`\`\` blocks.
4. TABLES — Reproduce all rows and columns in markdown table format.
5. DIAGRAMS & DRAWINGS — Describe every visual element in detail inside [DIAGRAM: ...] tags. Include all labels, arrows, component names, axis labels, values.
6. LISTS — Preserve numbered and bulleted lists exactly.
7. ANNOTATIONS — Capture handwritten notes, margin comments, underlines, circled text.
8. UNCLEAR TEXT — Mark with [?unclear?] but still extract surrounding context.

OUTPUT FORMAT — respond with a JSON object only (no markdown fences, no preamble):

{
  "rawText": "complete verbatim extracted text with newlines preserved",
  "sections": {
    "mainText": ["paragraph 1", "paragraph 2"],
    "mathematics": ["equation or formula 1", "equation 2"],
    "code": ["code block 1 with language tag"],
    "tables": [
      {
        "title": "optional table title",
        "headers": ["col1", "col2"],
        "rows": [["val1", "val2"], ["val3", "val4"]]
      }
    ],
    "diagrams": [
      {
        "type": "flowchart|graph|circuit|tree|ER|UML|bar chart|pie chart|drawing|other",
        "description": "detailed description of what the diagram shows",
        "labels": ["label1", "label2"]
      }
    ],
    "annotations": ["handwritten note or margin comment"],
    "lists": ["item 1", "item 2"]
  },
  "confidence": "high|medium|low"
}`;
}

// ── Image OCR ─────────────────────────────────────────────────────────────────

async function ocrImage(
  imagePath: string,
  mimeType: string,
  questionText?: string,
  pageNum?: number,
  totalPages?: number
): Promise<PageExtraction> {
  const imageBuffer = await readFile(imagePath);
  const base64 = imageBuffer.toString('base64');

  const prompt = buildOCRPrompt(questionText, pageNum, totalPages);

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 4096,
      top_p: 0.95,
      stream: false,
    });

    const raw = completion.choices[0]?.message?.content || '';
    return parseOCRResponse(raw, pageNum ?? 1);
  } catch (err) {
    console.error('Groq OCR error:', err);
    return emptyPage(pageNum ?? 1);
  }
}

// ── Parse AI Response ─────────────────────────────────────────────────────────

function parseOCRResponse(raw: string, pageNum: number): PageExtraction {
  // Strip potential markdown fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const sections = parsed.sections ?? {};

    const extraction: PageExtraction = {
      pageNumber: pageNum,
      rawText: parsed.rawText ?? cleaned,
      sections: {
        mainText: toStringArray(sections.mainText),
        mathematics: toStringArray(sections.mathematics),
        code: toStringArray(sections.code),
        tables: toTableArray(sections.tables),
        diagrams: toDiagramArray(sections.diagrams),
        annotations: toStringArray(sections.annotations),
        lists: toStringArray(sections.lists),
      },
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : estimateConfidence(parsed.rawText ?? ''),
      wordCount: wordCount(parsed.rawText ?? ''),
    };

    return extraction;
  } catch {
    // Fallback: treat entire response as raw text
    return {
      pageNumber: pageNum,
      rawText: cleaned,
      sections: {
        mainText: cleaned ? [cleaned] : [],
        mathematics: [],
        code: [],
        tables: [],
        diagrams: [],
        annotations: [],
        lists: [],
      },
      confidence: estimateConfidence(cleaned),
      wordCount: wordCount(cleaned),
    };
  }
}

// ── PDF Processing ────────────────────────────────────────────────────────────

async function processPDF(
  pdfPath: string,
  questionText?: string
): Promise<PageExtraction[]> {
  const tempId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const tempDir = path.join(process.cwd(), TEMP_DIR, tempId);
  await mkdir(tempDir, { recursive: true });

  const pages: PageExtraction[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = null; // server-side: no worker needed

    const pdfBuffer = await readFile(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);

    const pdf = await pdfjsLib.getDocument({
      data: pdfData,
      disableAutoFetch: false,
      disableStream: false,
      isEvalSupported: false,
    }).promise;

    const totalPages = pdf.numPages;
    console.log(`PDF: ${totalPages} pages`);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      console.log(`  Processing page ${pageNum}/${totalPages}`);

      const page = await pdf.getPage(pageNum);

      // ── Strategy 1: direct text layer ────────────────────────────────
      let directText = '';
      try {
        const tc = await page.getTextContent({ normalizeWhitespace: true });
        directText = tc.items
          .map((item: { str: string }) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      } catch {
        /* no text layer */
      }

      // ── Strategy 2: high-res render → OCR ────────────────────────────
      let ocrExtraction: PageExtraction = emptyPage(pageNum);
      try {
        const { createCanvas } = require('canvas');
        const scale = 3.0; // 3× resolution for sharp OCR
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        const imgPath = path.join(tempDir, `page-${pageNum}.png`);
        writeFileSync(imgPath, canvas.toBuffer('image/png', { compressionLevel: 1 }));

        ocrExtraction = await ocrImage(
          imgPath,
          'image/png',
          questionText,
          pageNum,
          totalPages
        );

        unlinkSync(imgPath);
      } catch (err) {
        console.warn(`  OCR render failed for page ${pageNum}:`, err);
      }

      // ── Merge: prefer longer of direct text vs OCR rawText ───────────
      if (directText.length > ocrExtraction.rawText.length) {
        // Re-parse the direct text through the AI for structure
        try {
          const directOcr = await ocrImageFromBase64(
            Buffer.from(directText).toString('base64'),
            'text/plain',
            questionText,
            pageNum,
            totalPages
          );
          // Only adopt if it adds real structure
          if (
            directOcr.sections.mathematics.length > 0 ||
            directOcr.sections.tables.length > 0
          ) {
            ocrExtraction = directOcr;
          } else {
            ocrExtraction.rawText = directText;
            ocrExtraction.sections.mainText = [directText];
          }
        } catch {
          ocrExtraction.rawText =
            directText.length > ocrExtraction.rawText.length
              ? directText
              : ocrExtraction.rawText;
        }
      }

      ocrExtraction.pageNumber = pageNum;
      ocrExtraction.wordCount = wordCount(ocrExtraction.rawText);
      pages.push(ocrExtraction);
    }
  } catch (err) {
    console.error('PDF processing error:', err);
    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        rawText: '[PDF could not be processed. Try uploading as individual images.]',
        sections: {
          mainText: ['[PDF could not be processed. Try uploading as individual images.]'],
          mathematics: [],
          code: [],
          tables: [],
          diagrams: [],
          annotations: [],
          lists: [],
        },
        confidence: 'low',
        wordCount: 0,
      });
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  return pages;
}

// Fallback: send raw text as "image" for structure parsing (rare path)
async function ocrImageFromBase64(
  base64: string,
  _mimeType: string,
  questionText?: string,
  pageNum?: number,
  totalPages?: number
): Promise<PageExtraction> {
  const prompt = buildOCRPrompt(questionText, pageNum, totalPages);
  // For plain text we just parse it directly
  return parseOCRResponse(base64, pageNum ?? 1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyPage(pageNum: number): PageExtraction {
  return {
    pageNumber: pageNum,
    rawText: '',
    sections: {
      mainText: [],
      mathematics: [],
      code: [],
      tables: [],
      diagrams: [],
      annotations: [],
      lists: [],
    },
    confidence: 'low',
    wordCount: 0,
  };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateConfidence(text: string): 'high' | 'medium' | 'low' {
  const unclear = (text.match(/\[?unclear\]?/gi) ?? []).length;
  if (!text || text.length < 20) return 'low';
  if (unclear > 5) return 'low';
  if (unclear > 1) return 'medium';
  return 'high';
}

function toStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((v) => typeof v === 'string' && v.trim());
  if (typeof val === 'string' && val.trim()) return [val];
  return [];
}

function toTableArray(val: unknown): TableBlock[] {
  if (!Array.isArray(val)) return [];
  return val.filter(
    (t): t is TableBlock =>
      t &&
      typeof t === 'object' &&
      Array.isArray((t as TableBlock).headers)
  );
}

function toDiagramArray(val: unknown): DiagramBlock[] {
  if (!Array.isArray(val)) return [];
  return val.filter(
    (d): d is DiagramBlock =>
      d && typeof d === 'object' && typeof (d as DiagramBlock).description === 'string'
  );
}

// Flat text summary for legacy consumers (e.g., grading API)
function flattenPages(pages: PageExtraction[]): string {
  return pages
    .map((p) => {
      const lines: string[] = [];
      if (pages.length > 1) lines.push(`=== Page ${p.pageNumber} ===`);
      if (p.rawText) lines.push(p.rawText);
      return lines.join('\n');
    })
    .join('\n\n');
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, questionText } = body as {
      filePath?: string;
      questionText?: string;
    };

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
    const supportedExts = ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'pdf'];

    if (!supportedExts.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format: ${ext}. Supported: ${supportedExts.join(', ')}` },
        { status: 400 }
      );
    }

    let pages: PageExtraction[];

    if (ext === 'pdf') {
      pages = await processPDF(fullPath, questionText);
    } else {
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        tiff: 'image/tiff',
        tif: 'image/tiff',
      };
      const page = await ocrImage(fullPath, mimeMap[ext] ?? 'image/jpeg', questionText, 1, 1);
      pages = [page];
    }

    // Flat text for backward-compatible fields (grading API reads .text)
    const flatText = flattenPages(pages);
    const overallConfidence =
      pages.some((p) => p.confidence === 'high')
        ? 'high'
        : pages.some((p) => p.confidence === 'medium')
        ? 'medium'
        : 'low';

    return NextResponse.json({
      success: true,
      // Legacy flat fields (grading API compatibility)
      text: flatText,
      confidence: overallConfidence,
      // Rich page-wise data for the dialog viewer
      pages,
      totalPages: pages.length,
      filePath,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('OCR route error:', err);
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 });
  }
}