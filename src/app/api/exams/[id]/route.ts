import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/exams/[id] - Get exam details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        teacher: true,
        questions: {
          orderBy: { questionNumber: 'asc' }
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          include: {
            answers: {
              include: {
                question: true
              }
            }
          }
        }
      }
    });

    if (!exam) {
      return NextResponse.json(
        { error: 'Exam not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(exam);
  } catch (error) {
    console.error('Error fetching exam:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exam' },
      { status: 500 }
    );
  }
}

// PUT /api/exams/[id] - Update exam
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, subject, description, totalMarks, status, questions } = body;

    // Update exam basic info
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (subject !== undefined) updateData.subject = subject;
    if (description !== undefined) updateData.description = description;
    if (totalMarks !== undefined) updateData.totalMarks = totalMarks;
    if (status !== undefined) updateData.status = status;

    // If questions are provided, update them
    if (questions && Array.isArray(questions)) {
      // Delete existing questions and create new ones
      await db.question.deleteMany({
        where: { examId: id }
      });

      await db.exam.update({
        where: { id },
        data: {
          ...updateData,
          questions: {
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
          }
        },
        include: {
          questions: {
            orderBy: { questionNumber: 'asc' }
          }
        }
      });
    } else {
      await db.exam.update({
        where: { id },
        data: updateData
      });
    }

    const updatedExam = await db.exam.findUnique({
      where: { id },
      include: {
        teacher: true,
        questions: {
          orderBy: { questionNumber: 'asc' }
        }
      }
    });

    return NextResponse.json(updatedExam);
  } catch (error) {
    console.error('Error updating exam:', error);
    return NextResponse.json(
      { error: 'Failed to update exam' },
      { status: 500 }
    );
  }
}

// DELETE /api/exams/[id] - Delete exam
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if exam exists
    const exam = await db.exam.findUnique({
      where: { id },
      include: { _count: { select: { submissions: true } } }
    });

    if (!exam) {
      return NextResponse.json(
        { error: 'Exam not found' },
        { status: 404 }
      );
    }

    // Delete exam (cascades to questions, submissions, and answers)
    await db.exam.delete({
      where: { id }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Exam deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting exam:', error);
    return NextResponse.json(
      { error: 'Failed to delete exam' },
      { status: 500 }
    );
  }
}
