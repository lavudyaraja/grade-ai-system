import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/teachers - List all teachers
export async function GET() {
  try {
    const teachers = await db.teacher.findMany({
      include: {
        _count: {
          select: { exams: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teachers' },
      { status: 500 }
    );
  }
}

// POST /api/teachers - Create a new teacher
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email' },
        { status: 400 }
      );
    }

    const teacher = await db.teacher.create({
      data: { name, email }
    });

    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    console.error('Error creating teacher:', error);
    return NextResponse.json(
      { error: 'Failed to create teacher' },
      { status: 500 }
    );
  }
}
