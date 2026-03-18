import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800', 10); // 50 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/tiff': 'tiff',
  'application/pdf': 'pdf',
};

/**
 * POST /api/upload
 * Accepts a multipart form with:
 *   file          — the binary file
 *   submissionId  — (optional) groups the file under a submission folder
 *   questionNumber — (optional) prefixes the filename
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const submissionId = (formData.get('submissionId') as string | null)?.trim();
    const questionNumber = (formData.get('questionNumber') as string | null)?.trim();

    // ── Validation ───────────────────────────────────────────────────────
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = ALLOWED_MIME_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        {
          error: `Unsupported file type "${file.type}". Allowed: JPEG, PNG, WebP, TIFF, PDF`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      const maxMB = Math.round(MAX_FILE_SIZE / 1024 / 1024);
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxMB} MB` },
        { status: 400 }
      );
    }

    // ── Build unique filename ────────────────────────────────────────────
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeOriginalName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 40);
    const fileName = `${timestamp}-${random}-${safeOriginalName}.${ext}`;

    // ── Determine target directory ───────────────────────────────────────
    const uploadRoot = path.join(process.cwd(), UPLOAD_DIR);
    const tempRoot = path.join(process.cwd(), process.env.TEMP_DIR || 'temp');

    let targetDir: string;
    let relativePath: string;

    if (submissionId && questionNumber) {
      // Sanitise submissionId — must be alphanumeric / hyphens only
      const safeSubmissionId = submissionId.replace(/[^a-zA-Z0-9-_]/g, '');
      targetDir = path.join(uploadRoot, safeSubmissionId);
      relativePath = `${safeSubmissionId}/q${questionNumber}-${fileName}`;
    } else {
      targetDir = uploadRoot;
      relativePath = fileName;
    }

    // ── Ensure directories exist ─────────────────────────────────────────
    if (!existsSync(uploadRoot)) await mkdir(uploadRoot, { recursive: true });
    if (!existsSync(tempRoot)) await mkdir(tempRoot, { recursive: true });
    if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });

    // ── Write file ───────────────────────────────────────────────────────
    const fullPath = path.join(process.cwd(), UPLOAD_DIR, relativePath);
    const bytes = await file.arrayBuffer();
    await writeFile(fullPath, Buffer.from(bytes));

    return NextResponse.json({
      success: true,
      filePath: relativePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}