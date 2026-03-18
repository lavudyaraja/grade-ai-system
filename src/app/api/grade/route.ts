/**
 * Grading API
 * POST /api/grade
 *
 * Fix applied: pdfjs-dist loaded lazily (not at module top-level) to prevent
 * webpack bundling, which caused "Cannot find module './pdf.worker.js'".
 * Requires next.config.ts → serverExternalPackages: ['pdfjs-dist', 'canvas']
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, access, mkdir, rm, writeFile } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { db } from '@/lib/db';

// ── Config ────────────────────────────────────────────────────────────────────
const GROQ_MODEL    = process.env.GROQ_OCR_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const UPLOAD_DIR    = process.env.UPLOAD_DIR || 'uploads';
const TEMP_DIR      = process.env.TEMP_DIR   || 'temp';
const MAX_PDF_PAGES = 50;
const BATCH_SIZE    = 5;

if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Lazy pdfjs loader ─────────────────────────────────────────────────────────
// Same pattern as /api/ocr — must NOT be at top-level require to avoid webpack bundling.
let _pdfjsLib: any = null;

function getPdfjs(): any {
  if (_pdfjsLib) return _pdfjsLib;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  // Empty string activates fake-worker mode (runs in-process, no browser Worker needed)
  // This works correctly only when pdfjs-dist is NOT webpack-bundled.
  _pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  return _pdfjsLib;
}

// ── Image OCR ─────────────────────────────────────────────────────────────────

async function ocrImage(
  imagePath:    string,
  questionText: string,
): Promise<{ text: string; confidence: string }> {
  try {
    const ext      = path.extname(imagePath).replace('.', '').toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png',  webp: 'image/webp',
      tiff: 'image/tiff', tif: 'image/tiff',
    };
    const mimeType = mimeMap[ext] ?? 'image/jpeg';

    const imageBuffer = await readFile(imagePath);
    const base64      = imageBuffer.toString('base64');

    const prompt = `You are an expert OCR system for exam answer sheets.
The student is answering: "${questionText}"
Extract ALL handwritten text accurately. Preserve structure and formatting.
Return ONLY the extracted text, no commentary.`;

    const completion = await groq.chat.completions.create({
      model:              GROQ_MODEL,
      temperature:        0.05,
      max_completion_tokens: 2048,
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

    const extractedText = completion.choices[0]?.message?.content ?? '';
    const unclearCount  = (extractedText.match(/\[unclear\]/g) ?? []).length;
    const confidence    = extractedText.length === 0 ? 'low'
                        : unclearCount > 3            ? 'low'
                        : unclearCount > 0            ? 'medium'
                        : 'high';

    return { text: extractedText, confidence };
  } catch (err) {
    console.error('[Grade] Image OCR error:', err);
    return { text: '', confidence: 'low' };
  }
}

// ── PDF text extraction ───────────────────────────────────────────────────────

async function extractPDFText(
  pdfPath:     string,
  questionText: string,
): Promise<{ text: string; confidence: string }> {
  const tempId  = `grade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tempDir = path.join(process.cwd(), TEMP_DIR, tempId);
  await mkdir(tempDir, { recursive: true });

  let allText    = '';
  let confSum    = 0;
  let confCount  = 0;

  try {
    const pdfjsLib = getPdfjs();

    const pdfBuffer = await readFile(pdfPath);
    const pdf = await pdfjsLib.getDocument({
      data:                      new Uint8Array(pdfBuffer),
      isEvalSupported:           false,
      useSystemFonts:            true,
      fontExtraProperties:       false,
      useWorkerFetch:            false,
      isOffscreenCanvasSupported: false,
    }).promise;

    const totalPages  = pdf.numPages;
    const pagesToProc = Math.min(totalPages, MAX_PDF_PAGES);

    console.log(`[Grade] PDF ${totalPages}p, processing ${pagesToProc}`);

    // Process in batches
    for (let batchStart = 1; batchStart <= pagesToProc; batchStart += BATCH_SIZE) {
      const batchEnd  = Math.min(batchStart + BATCH_SIZE - 1, pagesToProc);
      const batchNums = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

      await Promise.all(batchNums.map(async pageNum => {
        const page = await pdf.getPage(pageNum);

        // Try native text layer first
        let pageText = '';
        try {
          const tc = await page.getTextContent({ normalizeWhitespace: true });
          pageText  = tc.items.map((i: { str: string }) => i.str).join(' ').trim();
        } catch { /* no text layer */ }

        if (pageText.length > 30) {
          allText  += `\n--- Page ${pageNum} ---\n${pageText}\n`;
          confSum  += 3;
          confCount++;
          return;
        }

        // Fall back to vision OCR on rendered page
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { createCanvas } = require('canvas');
          const viewport = page.getViewport({ scale: 2.5 });
          const canvas   = createCanvas(viewport.width, viewport.height);
          const ctx      = canvas.getContext('2d');
          ctx.fillStyle  = '#ffffff';
          ctx.fillRect(0, 0, viewport.width, viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;

          const imgPath = path.join(tempDir, `p${pageNum}.png`);
          await writeFile(imgPath, canvas.toBuffer('image/png', { compressionLevel: 1 }));

          const result = await ocrImage(imgPath, questionText);
          try { await rm(imgPath, { force: true }); } catch { /* ignore */ }

          if (result.text.trim().length > 10) {
            allText  += `\n--- Page ${pageNum} (OCR) ---\n${result.text}\n`;
            confSum  += result.confidence === 'high' ? 3 : result.confidence === 'medium' ? 2 : 1;
            confCount++;
          } else {
            allText += `\n--- Page ${pageNum} ---\n[No readable text found]\n`;
          }
        } catch (err) {
          console.warn(`[Grade] Render failed page ${pageNum}:`, (err as Error).message);
          allText += `\n--- Page ${pageNum} ---\n[Render failed]\n`;
        }
      }));
    }

    if (!allText.trim()) {
      return { text: '[PDF contained no extractable text]', confidence: 'low' };
    }

    const avgConf   = confCount > 0 ? confSum / (confCount * 3) : 0.3;
    const confidence = avgConf >= 0.7 ? 'high' : avgConf >= 0.4 ? 'medium' : 'low';
    return { text: allText.trim(), confidence };

  } catch (err) {
    console.error('[Grade] PDF extraction error:', err);
    return { text: '[PDF processing failed]', confidence: 'low' };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Handwriting recognition dispatcher ───────────────────────────────────────

async function recognizeHandwriting(
  filePath:    string,
  questionText: string,
): Promise<{ text: string; confidence: string }> {
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  if (ext === 'pdf') return extractPDFText(filePath, questionText);
  return ocrImage(filePath, questionText);
}

// ── AI answer evaluation ──────────────────────────────────────────────────────

async function evaluateAnswer(params: {
  recognizedText: string;
  modelAnswer:    string;
  keywords:       string[];
  maxMarks:       number;
  questionText:   string;
}): Promise<{
  similarityScore: number;
  keywordScore:    number;
  finalScore:      number;
  feedback:        string;
  keyPointsFound:  string[];
  keyPointsMissed: string[];
}> {
  const { recognizedText, modelAnswer, keywords, maxMarks, questionText } = params;

  try {
    const kwLine = keywords.length > 0
      ? `\nKEYWORDS TO CHECK: ${keywords.join(', ')}`
      : '';

    const prompt = `You are an expert exam grader. Evaluate this student answer fairly.

QUESTION: ${questionText}

STUDENT ANSWER:
${recognizedText}

MODEL ANSWER:
${modelAnswer}
${kwLine}

Respond with this exact JSON (no fences, no preamble):
{
  "similarityScore": <0–1 semantic similarity>,
  "keywordScore":    <0–1 keyword coverage>,
  "finalScore":      <marks out of ${maxMarks}>,
  "feedback":        "<constructive feedback for the student>",
  "keyPointsFound":  ["point covered by student"],
  "keyPointsMissed": ["important point student missed"]
}

Guidelines:
- Award partial credit for partially correct answers.
- Be fair and constructive.
- finalScore must be between 0 and ${maxMarks}.`;

    const response = await groq.chat.completions.create({
      model:              GROQ_MODEL,
      temperature:        0.2,
      max_completion_tokens: 1024,
      top_p:              0.95,
      stream:             false,
      messages: [
        { role: 'system', content: 'You are an expert exam grader. Always respond with valid JSON only, no markdown.' },
        { role: 'user',   content: prompt },
      ],
    });

    const content   = response.choices[0]?.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        similarityScore: Math.min(1, Math.max(0, Number(result.similarityScore) || 0)),
        keywordScore:    Math.min(1, Math.max(0, Number(result.keywordScore)    || 0)),
        finalScore:      Math.min(maxMarks, Math.max(0, Number(result.finalScore) || 0)),
        feedback:        typeof result.feedback === 'string' ? result.feedback : 'No feedback available.',
        keyPointsFound:  Array.isArray(result.keyPointsFound)  ? result.keyPointsFound  : [],
        keyPointsMissed: Array.isArray(result.keyPointsMissed) ? result.keyPointsMissed : [],
      };
    }
  } catch (err) {
    console.error('[Grade] Evaluation error:', err);
  }

  return {
    similarityScore: 0,
    keywordScore:    0,
    finalScore:      0,
    feedback:        'Evaluation failed — please review manually.',
    keyPointsFound:  [],
    keyPointsMissed: [],
  };
}

// ── POST /api/grade ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, answerIds } = body as {
      submissionId?: string;
      answerIds?:    string[];
    };

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });
    }

    // ── Fetch submission ──────────────────────────────────────────────────────
    const submission = await db.submission.findUnique({
      where:   { id: submissionId },
      include: {
        exam:    { include: { questions: true } },
        answers: { include: { question: true }, orderBy: { questionNumber: 'asc' } },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Mark as processing
    await db.submission.update({
      where: { id: submissionId },
      data:  { status: 'processing' },
    });

    const answersToGrade = answerIds
      ? submission.answers.filter(a => answerIds.includes(a.id))
      : submission.answers;

    // ── Grade each answer ─────────────────────────────────────────────────────
    const results: any[] = [];

    for (const answer of answersToGrade) {
      const question = answer.question;

      // Use pre-extracted text if available
      let recognizedText = answer.recognizedText ?? '';
      let confidence     = answer.confidenceLevel ?? 'medium';

      // If no text yet but we have an image, extract now
      if (!recognizedText.trim() && answer.handwrittenImagePath) {
        const imgFullPath = path.join(process.cwd(), UPLOAD_DIR, answer.handwrittenImagePath);
        try {
          await access(imgFullPath, constants.R_OK);
          const result   = await recognizeHandwriting(imgFullPath, question.questionText);
          recognizedText = result.text;
          confidence     = result.confidence;
        } catch {
          console.warn(`[Grade] File not found: ${imgFullPath}`);
          recognizedText = '[Image not found]';
          confidence     = 'low';
        }
      }

      if (!recognizedText.trim()) {
        recognizedText = '[No answer provided]';
        confidence     = 'low';
      }

      // Parse keywords
      let keywords: string[] = [];
      if (question.keywords) {
        try { keywords = JSON.parse(question.keywords as string) as string[]; } catch { /* ignore */ }
      }

      // Evaluate
      const evaluation = await evaluateAnswer({
        recognizedText,
        modelAnswer:  question.modelAnswer,
        keywords,
        maxMarks:     question.maxMarks,
        questionText: question.questionText,
      });

      // Persist
      const updated = await db.answer.update({
        where: { id: answer.id },
        data: {
          recognizedText,
          modelAnswer:     question.modelAnswer,
          similarityScore: evaluation.similarityScore,
          keywordScore:    evaluation.keywordScore,
          finalScore:      evaluation.finalScore,
          feedback:        evaluation.feedback,
          keyPointsFound:  JSON.stringify(evaluation.keyPointsFound),
          keyPointsMissed: JSON.stringify(evaluation.keyPointsMissed),
          confidenceLevel: confidence,
          needsReview:     confidence === 'low' || evaluation.finalScore < question.maxMarks * 0.3,
        },
      });

      results.push(updated);
    }

    // ── Compute totals ────────────────────────────────────────────────────────
    const allAnswers = await db.answer.findMany({ where: { submissionId } });
    const totalScore = allAnswers.reduce((s, a) => s + (a.finalScore ?? 0), 0);
    const maxScore   = allAnswers.reduce((s, a) => s + a.maxMarks, 0);
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    // ── Overall feedback ──────────────────────────────────────────────────────
    let overallFeedback = 'Thank you for your submission.';
    try {
      const fbRes = await groq.chat.completions.create({
        model:              GROQ_MODEL,
        temperature:        0.6,
        max_completion_tokens: 200,
        stream:             false,
        messages: [
          { role: 'system', content: 'You are an encouraging teacher providing brief overall exam feedback.' },
          {
            role: 'user',
            content: `Student scored ${totalScore.toFixed(1)}/${maxScore} (${percentage.toFixed(1)}%) in "${submission.exam.title}" (${submission.exam.subject}). Write 2–3 encouraging sentences.`,
          },
        ],
      });
      overallFeedback = fbRes.choices[0]?.message?.content ?? overallFeedback;
    } catch { /* non-critical */ }

    // ── Update submission ─────────────────────────────────────────────────────
    const updatedSubmission = await db.submission.update({
      where: { id: submissionId },
      data: {
        status:     'graded',
        totalScore,
        maxScore,
        percentage,
        feedback:   overallFeedback,
      },
      include: {
        answers: { include: { question: true }, orderBy: { questionNumber: 'asc' } },
      },
    });

    return NextResponse.json({
      success:       true,
      submission:    updatedSubmission,
      gradedAnswers: results,
    });
  } catch (err) {
    console.error('[Grade] Route error:', err);
    return NextResponse.json({ error: 'Failed to grade submission' }, { status: 500 });
  }
}