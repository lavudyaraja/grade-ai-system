import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/exams - List all exams
export async function GET() {
  try {
    const exams = await db.exam.findMany({
      include: {
        teacher: true,
        questions: {
          orderBy: { questionNumber: 'asc' }
        },
        _count: {
          select: { submissions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(exams);
  } catch (error) {
    console.error('Error fetching exams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exams' },
      { status: 500 }
    );
  }
}

// POST /api/exams - Create a new exam
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, subject, description, totalMarks, teacherId, questions } = body;

    console.log('Creating exam with data:', { title, subject, teacherId, questionsCount: questions?.length });

    // Validate required fields
    if (!title || !subject || !teacherId) {
      return NextResponse.json(
        { error: 'Missing required fields: title, subject, teacherId' },
        { status: 400 }
      );
    }

    // Check if teacher exists, if not create one
    console.log('Looking for teacher with ID:', teacherId);
    let teacher = await db.teacher.findUnique({
      where: { id: teacherId }
    });

    if (!teacher) {
      teacher = await db.teacher.create({
        data: {
          id: teacherId,
          name: 'Default Teacher',
          email: `teacher-${teacherId}@example.com`
        }
      });
    }

    // Calculate total marks from questions if not provided
    const calculatedTotalMarks = totalMarks || questions?.reduce(
      (sum: number, q: { maxMarks: number }) => sum + q.maxMarks,
      0
    ) || 0;

    const exam = await db.exam.create({
      data: {
        title,
        subject,
        description,
        totalMarks: calculatedTotalMarks,
        teacherId: teacher.id,
        questions: questions ? {
          create: questions.map((q: { 
            questionNumber: number; 
            questionText: string; 
            modelAnswer: string; 
            maxMarks: number;
            keywords?: string[];
            gradingNotes?: string;
          }) => ({
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            modelAnswer: q.modelAnswer,
            maxMarks: q.maxMarks,
            keywords: q.keywords ? JSON.stringify(q.keywords) : null,
            gradingNotes: q.gradingNotes || null
          }))
        } : undefined
      },
      include: {
        questions: {
          orderBy: { questionNumber: 'asc' }
        }
      }
    });

    return NextResponse.json(exam, { status: 201 });
  } catch (error) {
    console.error('Error creating exam:', error);
    return NextResponse.json(
      { error: 'Failed to create exam' },
      { status: 500 }
    );
  }
}
