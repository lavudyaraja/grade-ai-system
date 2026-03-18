import { NextRequest, NextResponse } from 'next/server';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

// GET /api/preview/[...path] - Preview PDF or image files
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join('/');
    const fullPath = path.join(process.cwd(), 'uploads', filePath);

    // Check if file exists
    try {
      await access(fullPath, constants.R_OK);
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Determine file type
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    if (extension === 'pdf') {
      // For PDFs, we'll convert the first page to an image for preview using pdfjs-dist
      try {
        const fs = require('fs');
        const pdfjsLib = require('pdfjs-dist');
        
        // Set up worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry.js');
        
        // Read PDF file
        const pdfBuffer = await readFile(fullPath);
        const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
        const pdf = await loadingTask.promise;
        
        if (pdf.numPages > 0) {
          // Get first page
          const page = await pdf.getPage(1);
          
          // Create viewport for preview
          const viewport = page.getViewport({ scale: 0.8 });
          const { createCanvas } = require('canvas');
          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');
          
          // Render PDF page to canvas
          await page.render({ canvasContext: context, viewport }).promise;
          
          // Convert canvas to buffer
          const imageBuffer = canvas.toBuffer('image/png');
          
          return new NextResponse(imageBuffer, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
          });
        }
      } catch (pdfError) {
        console.error('Error converting PDF to image for preview:', pdfError);
      }
      
      // Return a simple placeholder response if PDF conversion fails
      return NextResponse.json(
        { 
          error: 'PDF preview not available',
          message: 'The PDF could not be converted to a preview image. This may be due to the PDF being corrupted, password-protected, or containing no visual content.'
        },
        { status: 200 } // Return 200 instead of 500 to avoid breaking the UI
      );
    } else {
      // For images, serve directly
      const imageBuffer = await readFile(fullPath);
      
      const mimeType = extension === 'png' ? 'image/png' : 
                       extension === 'webp' ? 'image/webp' :
                       extension === 'tiff' || extension === 'tif' ? 'image/tiff' :
                       'image/jpeg';
      
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    }
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
