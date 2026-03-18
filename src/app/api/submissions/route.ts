import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/submissions - List submissions (optionally filtered by exam)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (examId) where.examId = examId;
    if (status) where.status = status;

    const submissions = await db.submission.findMany({
      where,
      include: {
        exam: {
          include: {
            teacher: true
          }
        },
        answers: {
          include: {
            question: true
          },
          orderBy: { questionNumber: 'asc' }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    return NextResponse.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

// POST /api/submissions - Create a new submission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { examId, studentName, studentId, answers } = body;

    // Validate required fields
    if (!examId || !studentName) {
      return NextResponse.json(
        { error: 'Missing required fields: examId, studentName' },
        { status: 400 }
      );
    }

    // Check if exam exists
    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: { questions: true }
    });

    if (!exam) {
      return NextResponse.json(
        { error: 'Exam not found' },
        { status: 404 }
      );
    }

    // Create submission with answers
    const submission = await db.submission.create({
      data: {
        studentName,
        studentId: studentId || null,
        examId,
        maxScore: exam.totalMarks,
        answers: answers ? {
          create: answers.map((a: {
            questionId: string;
            questionNumber: number;
            handwrittenImagePath?: string;
            maxMarks: number;
          }) => ({
            questionId: a.questionId,
            questionNumber: a.questionNumber,
            handwrittenImagePath: a.handwrittenImagePath || null,
            maxMarks: a.maxMarks
          }))
        } : {
          create: exam.questions.map(q => ({
            questionId: q.id,
            questionNumber: q.questionNumber,
            maxMarks: q.maxMarks
          }))
        }
      },
      include: {
        answers: {
          include: {
            question: true
          },
          orderBy: { questionNumber: 'asc' }
        }
      }
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error('Error creating submission:', error);
    return NextResponse.json(
      { error: 'Failed to create submission' },
      { status: 500 }
    );
  }
}
