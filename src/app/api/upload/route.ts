import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800', 10); // 50 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'text/plain': 'txt',
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
 *   file           — the binary file
 *   submissionId   — (optional) groups the file under a folder
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
      console.error('[UPLOAD] No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = ALLOWED_MIME_TYPES[file.type];
    if (!ext) {
      console.error('[UPLOAD] Unsupported file type:', file.type);
      return NextResponse.json(
        {
          error: `Unsupported file type "${file.type}". Allowed: JPEG, PNG, WebP, TIFF, PDF`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      const maxMB = Math.round(MAX_FILE_SIZE / 1024 / 1024);
      console.error('[UPLOAD] File too large:', file.size, 'bytes');
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxMB} MB` },
        { status: 400 }
      );
    }

    // ── Build unique blob pathname ────────────────────────────────────────
    // Vercel Blob uses the pathname as a "folder/filename" key.
    // e.g. "submissions/abc123/q1-1234567890-xyz-myfile.pdf"
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeOriginalName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 40);
    const fileName = `${timestamp}-${random}-${safeOriginalName}.${ext}`;

    let blobPathname: string;

    if (submissionId && questionNumber) {
      const safeSubmissionId = submissionId.replace(/[^a-zA-Z0-9-_]/g, '');
      blobPathname = `submissions/${safeSubmissionId}/q${questionNumber}-${fileName}`;
    } else {
      blobPathname = `uploads/${fileName}`;
    }

    // ── Upload to Vercel Blob or local storage ───────────────────────────────────
    let fileUrl: string;
    let filePath: string;
    const useVercelBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

    if (useVercelBlob) {
      // Production: Use Vercel Blob
      const blob = await put(blobPathname, file, {
        access: 'public',
        contentType: file.type,
      });
      fileUrl = blob.url;
      filePath = blob.pathname;
      console.log('[UPLOAD] Blob uploaded successfully:', blob.url);
    } else {
      // Development: Use local file storage
      const uploadsDir = path.join(process.cwd(), 'uploads');
      await mkdir(uploadsDir, { recursive: true });
      
      const localPath = path.join(uploadsDir, blobPathname);
      await mkdir(path.dirname(localPath), { recursive: true });
      
      const buffer = await file.arrayBuffer();
      await writeFile(localPath, Buffer.from(buffer));
      
      // Create a local URL (for development)
      fileUrl = `http://localhost:3000/api/files/${blobPathname}`;
      filePath = blobPathname;
      console.log('[UPLOAD] File saved locally:', localPath);
    }

    // ── Save file info to Neon database ─────────────────────────────────────
    try {
      await prisma.uploadedFile.create({
        data: {
          submissionId: submissionId || 'unknown',
          questionNumber: parseInt(questionNumber || '0'),
          fileName: file.name,
          fileUrl: fileUrl,
          mimeType: file.type,
          fileSize: BigInt(file.size),
          blobPathname: filePath,
        },
      });
      console.log('[UPLOAD] File metadata saved to database');
    } catch (dbError) {
      console.error('[UPLOAD] Failed to save to database:', dbError);
      // Continue anyway - the file is uploaded, we can retry DB save later
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,             // permanent CDN URL or local URL
      pathname: filePath,        // the key inside your blob store or local path
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storage: useVercelBlob ? 'vercel-blob' : 'local',
    });
  } catch (error) {
    console.error('[UPLOAD] Unexpected error:', error);
    return NextResponse.json({ error: 'Upload failed — please try again' }, { status: 500 });
  }
}