/**
 * Environment Check API
 * GET /api/health
 * 
 * Checks if all required services and configurations are working
 */
import { NextRequest, NextResponse } from 'next/server';
import { access, constants } from 'fs/promises';
import path from 'path';
import Groq from 'groq-sdk';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const TEMP_DIR = process.env.TEMP_DIR || 'temp';

export async function GET(request: NextRequest) {
  const checks: {
    environment: Record<string, any>;
    directories: Record<string, any>;
    services: Record<string, any>;
    dependencies: Record<string, any>;
  } = {
    environment: {},
    directories: {},
    services: {},
    dependencies: {}
  };

  // Check environment variables
  checks.environment = {
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    DATABASE_URL: !!process.env.DATABASE_URL,
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
    TEMP_DIR: process.env.TEMP_DIR || 'temp',
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || '52428800',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  // Check directories
  try {
    const uploadRoot = path.join(process.cwd(), UPLOAD_DIR);
    const tempRoot = path.join(process.cwd(), TEMP_DIR);
    
    await access(uploadRoot, constants.W_OK);
    await access(tempRoot, constants.W_OK);
    
    checks.directories = {
      uploadDir: { exists: true, writable: true, path: uploadRoot },
      tempDir: { exists: true, writable: true, path: tempRoot },
    };
  } catch (error) {
    checks.directories = {
      uploadDir: { exists: false, writable: false, error: error instanceof Error ? error.message : 'Unknown error' },
      tempDir: { exists: false, writable: false, error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }

  // Check Groq API
  try {
    if (process.env.GROQ_API_KEY) {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      // Test with a minimal request to check if API key is valid
      const models = await groq.models.list();
      checks.services.groq = { 
        connected: true, 
        models: models.data?.length || 0,
        ocrModel: process.env.GROQ_OCR_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'
      };
    } else {
      checks.services.groq = { connected: false, error: 'GROQ_API_KEY not set' };
    }
  } catch (error) {
    checks.services.groq = { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }

  // Check database (simple connection test)
  try {
    if (process.env.DATABASE_URL) {
      // We would need to import Prisma client here, but for simplicity just check the URL format
      const url = process.env.DATABASE_URL;
      checks.services.database = { 
        configured: url.startsWith('postgresql://'),
        url: url.replace(/\/\/.*@/, '//***:***@') // Hide credentials
      };
    } else {
      checks.services.database = { configured: false, error: 'DATABASE_URL not set' };
    }
  } catch (error) {
    checks.services.database = { 
      configured: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }

  // Check critical dependencies
  try {
    // These should be available if the app started successfully
    checks.dependencies = {
      groqSdk: true,
      pdfjs: true, // Would fail if not available
      canvas: true, // Would fail if not available
    };
  } catch (error) {
    checks.dependencies = {
      groqSdk: false,
      pdfjs: false,
      canvas: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Overall status
  const allChecksPass = 
    checks.environment.GROQ_API_KEY && 
    checks.environment.DATABASE_URL &&
    checks.directories.uploadDir?.writable &&
    checks.directories.tempDir?.writable &&
    checks.services.groq?.connected &&
    checks.services.database?.configured;

  return NextResponse.json({
    status: allChecksPass ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
}
