import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/answers/[id] - Update answer with OCR text
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { handwrittenImagePath, recognizedText, confidenceLevel } = body;

    const updateData: Record<string, unknown> = {};
    if (handwrittenImagePath !== undefined) updateData.handwrittenImagePath = handwrittenImagePath;
    if (recognizedText !== undefined) updateData.recognizedText = recognizedText;
    if (confidenceLevel !== undefined) updateData.confidenceLevel = confidenceLevel;

    const answer = await db.answer.update({
      where: { id },
      data: updateData,
      include: {
        question: true
      }
    });

    return NextResponse.json(answer);
  } catch (error) {
    console.error('Error updating answer:', error);
    return NextResponse.json(
      { error: 'Failed to update answer' },
      { status: 500 }
    );
  }
}
