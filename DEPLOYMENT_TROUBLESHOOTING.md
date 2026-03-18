# Deployment Troubleshooting Guide

## Upload & OCR Issues After Deployment

### Common Issues and Solutions

#### 1. Environment Variables Missing
```bash
# Required for deployment
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=postgresql://...
UPLOAD_DIR=uploads
TEMP_DIR=temp
MAX_FILE_SIZE=52428800
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### 2. File Directory Permissions
```bash
# Ensure directories exist and are writable
mkdir -p uploads temp
chmod 755 uploads temp
```

#### 3. Dependencies for PDF Processing
```bash
# Ubuntu/Debian
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# Alpine (Docker)
apk add cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev
```

#### 4. Canvas Dependencies
The OCR uses `canvas` for PDF rendering which requires native libraries.

### Debug Steps

1. **Check Environment Variables**
   ```bash
   # In your deployment console
   echo $GROQ_API_KEY
   echo $DATABASE_URL
   ```

2. **Test Upload Endpoint**
   ```bash
   curl -X POST https://your-domain.com/api/upload \
     -F "file=@test.jpg" \
     -F "submissionId=test" \
     -F "questionNumber=1"
   ```

3. **Test OCR Endpoint**
   ```bash
   curl -X POST https://your-domain.com/api/ocr \
     -H "Content-Type: application/json" \
     -d '{"filePath":"test/test.jpg","questionText":"Test question"}'
   ```

4. **Check Logs**
   ```bash
   # Vercel
   vercel logs

   # Docker
   docker logs <container_id>
   ```

### Quick Fixes

#### Fix 1: Add Environment Variables
In your deployment platform (Vercel, Docker, etc.), add these environment variables:
- `GROQ_API_KEY`
- `DATABASE_URL`
- `UPLOAD_DIR=uploads`
- `TEMP_DIR=temp`

#### Fix 2: Update Upload Directory Handling
The upload directory needs to be created at runtime.

#### Fix 3: Ensure Proper Build
Make sure `canvas` and `pdfjs-dist` are properly handled in the build.

### Vercel Specific

1. Add environment variables in Vercel dashboard
2. Set `NODE_ENV=production`
3. Ensure `output: "standalone"` in next.config.ts
4. Add build scripts for native dependencies

### Docker Specific

1. Install native dependencies in Dockerfile
2. Create directories at runtime
3. Set proper permissions
4. Mount volumes for uploads if needed
