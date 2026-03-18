/**
 * Reviews API
 *
 * GET  /api/reviews          — list all graded submissions with review metadata
 * GET  /api/reviews/[id]     — single submission with full answer detail
 * POST /api/reviews/[id]/decision — accept / reject / dispute a single answer
 * POST /api/reviews/[id]/bulk    — bulk accept-all or reject-flagged
 * POST /api/reviews/[id]/finalize — lock the review as complete
 *
 * All review decisions are stored on the Answer model via PATCH /api/answers/[id]
 * and on Submission via a reviewStatus field.
 *
 * This file handles the orchestration layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/reviews ──────────────────────────────────────────────────────────
// Returns all graded submissions enriched with review progress stats.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const examId       = searchParams.get('examId') ?? undefined;
    const reviewStatus = searchParams.get('reviewStatus') ?? undefined; // pending|in_review|reviewed|disputed
    const priority     = searchParams.get('priority') === 'true';

    const submissions = await db.submission.findMany({
      where: {
        status:       'graded',
        ...(examId       ? { examId }       : {}),
        ...(reviewStatus ? { reviewStatus } : {}),
      },
      include: {
        exam: { select: { id: true, title: true, subject: true } },
        answers: {
          include: {
            question: { select: { questionNumber: true, questionText: true, maxMarks: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Enrich each submission with review metadata
    const enriched = submissions.map(sub => {
      const total       = sub.answers.length;
      const accepted    = sub.answers.filter(a => (a as any).reviewDecision === 'accepted').length;
      const rejected    = sub.answers.filter(a => (a as any).reviewDecision === 'rejected').length;
      const disputed    = sub.answers.filter(a => (a as any).reviewDecision === 'disputed').length;
      const flagged     = sub.answers.filter(a => a.needsReview).length;
      const pending     = total - accepted - rejected - disputed;
      const lowOcr      = sub.answers.filter(a => a.confidenceLevel === 'low').length;
      const hasOverride = sub.answers.some(a => (a as any).teacherScore != null);

      // Priority score: flagged answers + low OCR + unreviewed
      const priorityScore = flagged * 3 + lowOcr * 2 + pending;

      return {
        ...sub,
        _review: {
          total,
          accepted,
          rejected,
          disputed,
          flagged,
          pending,
          lowOcr,
          hasOverride,
          progress: total > 0 ? Math.round(((accepted + rejected + disputed) / total) * 100) : 0,
          priorityScore,
          isComplete: pending === 0,
        },
      };
    });

    // Sort by priority if requested
    const sorted = priority
      ? [...enriched].sort((a, b) => b._review.priorityScore - a._review.priorityScore)
      : enriched;

    return NextResponse.json(sorted);
  } catch (err) {
    console.error('GET /api/reviews error:', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// ── POST /api/reviews — handle sub-actions via action param ──────────────────
// Body: { action: 'decision'|'bulk'|'finalize', submissionId, ... }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, submissionId } = body as {
      action: 'decision' | 'bulk' | 'finalize';
      submissionId: string;
    };

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });
    }

    // ── Decision: accept / reject / dispute a single answer ──────────────────
    if (action === 'decision') {
      const {
        answerId,
        decision,        // 'accepted' | 'rejected' | 'disputed' | 'pending'
        teacherScore,    // number | null
        teacherComment,  // string | null
        reviewNote,      // string | null — internal note, not shown to student
      } = body as {
        answerId: string;
        decision: string;
        teacherScore?: number | null;
        teacherComment?: string | null;
        reviewNote?: string | null;
      };

      if (!answerId || !decision) {
        return NextResponse.json({ error: 'answerId and decision are required' }, { status: 400 });
      }

      const updated = await db.answer.update({
        where: { id: answerId },
        data: {
          reviewDecision: decision,
          ...(teacherScore  != null ? { teacherScore }   : {}),
          ...(teacherComment != null ? { teacherComment } : {}),
          ...(reviewNote    != null ? { reviewNote }     : {}),
          reviewedAt: new Date(),
        },
      });

      // Recalculate submission total score using teacher overrides where present
      await recalculateSubmissionScore(submissionId);

      return NextResponse.json({ success: true, answer: updated });
    }

    // ── Bulk: accept-all or reject-flagged ────────────────────────────────────
    if (action === 'bulk') {
      const { mode } = body as { mode: 'accept_all' | 'reject_flagged' | 'accept_unflagged' };

      const submission = await db.submission.findUnique({
        where: { id: submissionId },
        include: { answers: true },
      });

      if (!submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }

      let targetAnswers = submission.answers;

      if (mode === 'accept_all') {
        // Accept ALL answers that have no review decision yet
        targetAnswers = submission.answers.filter(a => !a.reviewDecision || a.reviewDecision === 'pending');
        await db.answer.updateMany({
          where: { id: { in: targetAnswers.map(a => a.id) } },
          data: { reviewDecision: 'accepted', reviewedAt: new Date() },
        });
      } else if (mode === 'reject_flagged') {
        // Reject answers flagged as needing review
        targetAnswers = submission.answers.filter(a => a.needsReview);
        await db.answer.updateMany({
          where: { id: { in: targetAnswers.map(a => a.id) } },
          data: { reviewDecision: 'rejected', reviewedAt: new Date() },
        });
      } else if (mode === 'accept_unflagged') {
        // Accept only non-flagged answers
        targetAnswers = submission.answers.filter(a => !a.needsReview);
        await db.answer.updateMany({
          where: { id: { in: targetAnswers.map(a => a.id) } },
          data: { reviewDecision: 'accepted', reviewedAt: new Date() },
        });
      }

      await recalculateSubmissionScore(submissionId);

      return NextResponse.json({ success: true, affected: targetAnswers.length });
    }

    // ── Finalize: lock review as complete ─────────────────────────────────────
    if (action === 'finalize') {
      const { reviewerNote } = body as { reviewerNote?: string };

      // Mark any still-pending answers as accepted
      await db.answer.updateMany({
        where: {
          submissionId,
          OR: [
            { reviewDecision: null },
            { reviewDecision: 'pending' }
          ],
        },
        data: { reviewDecision: 'accepted', reviewedAt: new Date() },
      });

      const updated = await db.submission.update({
        where: { id: submissionId },
        data: {
          reviewStatus:   'reviewed',
          reviewFinalizedAt: new Date(),
          ...(reviewerNote ? { reviewerNote } : {}),
        },
        include: {
          exam: true,
          answers: { include: { question: true } },
        },
      });

      await recalculateSubmissionScore(submissionId);

      return NextResponse.json({ success: true, submission: updated });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('POST /api/reviews error:', err);
    return NextResponse.json({ error: 'Review action failed' }, { status: 500 });
  }
}

// ── Helper: recalculate submission total using teacher overrides ──────────────
async function recalculateSubmissionScore(submissionId: string) {
  try {
    const sub = await db.submission.findUnique({
      where: { id: submissionId },
      include: { answers: true },
    });
    if (!sub) return;

    const totalScore = sub.answers.reduce(
      (acc, a) => acc + ((a as any).teacherScore ?? a.finalScore ?? 0),
      0
    );
    const maxScore = sub.answers.reduce((acc, a) => acc + a.maxMarks, 0);
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    await db.submission.update({
      where: { id: submissionId },
      data: { totalScore, maxScore, percentage },
    });
  } catch (err) {
    console.error('Score recalculation error:', err);
  }
}