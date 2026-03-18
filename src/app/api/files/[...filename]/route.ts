import { NextRequest, NextResponse } from 'next/server';
import { readFile, access, stat } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string[] } }
) {
  try {
    // Reconstruct the relative path from path segments
    const segments = params.filename;

    // ── Security: block directory traversal ──────────────────────────────
    // Each segment must not be ".." or contain null bytes / backslashes.
    // Joining with "/" is intentional — uploads are stored in subdirectories
    // like uploads/<submissionId>/q1-<timestamp>.jpg
    const hasTraversal = segments.some(
      (seg) => seg === '..' || seg.includes('\0') || seg.includes('\\')
    );
    if (hasTraversal) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const relativePath = segments.join('/');
    const filePath = path.join(process.cwd(), UPLOAD_DIR, relativePath);

    // Confirm resolved path is still inside the upload directory (defense-in-depth)
    const uploadRoot = path.join(process.cwd(), UPLOAD_DIR);
    if (!filePath.startsWith(uploadRoot + path.sep) && filePath !== uploadRoot) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // ── File existence check ─────────────────────────────────────────────
    try {
      await access(filePath, constants.R_OK);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // ── Read file & determine content type ───────────────────────────────
    const [fileBuffer, fileStat] = await Promise.all([
      readFile(filePath),
      stat(filePath),
    ]);

    const ext = path.extname(relativePath).replace('.', '').toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === 'true';
    const fileName = path.basename(relativePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileStat.size),
        'Cache-Control': 'private, max-age=3600',
        'Last-Modified': fileStat.mtime.toUTCString(),
        ...(isDownload
          ? { 'Content-Disposition': `attachment; filename="${fileName}"` }
          : { 'Content-Disposition': `inline; filename="${fileName}"` }),
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}