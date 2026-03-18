# AI API Used for OCR

This project uses the Groq SDK for OCR and handwriting recognition. Here's the breakdown:

## SDK Details

| PROPERTY | VALUE |
|----------|-------|
| SDK Name | groq-sdk |
| Import | `import Groq from 'groq-sdk'` |
| Type | Vision Language Model (VLM) SDK |
| Capabilities | Image understanding, Text extraction, Chat completions |
| PDF Support | Yes - via pdf2pic conversion to images |

## Supported File Formats

| Format | Max Size | OCR Support | Notes |
|--------|----------|-------------|-------|
| JPEG | 50MB | ✅ | Standard image format |
| PNG | 50MB | ✅ | Supports transparency |
| WebP | 50MB | ✅ | Modern web format |
| TIFF | 50MB | ✅ | High-quality scans |
| PDF | 50MB | ✅ | Multi-page documents |

## How It Works

The OCR process uses a Vision Language Model (VLM) which is a multimodal AI model that can "see" and understand images:

### For Images:
```typescript
// Initialize the Groq client
const groq = new Groq({
  apiKey: 'your-api-key'
});

// Use Vision API for handwriting recognition
const completion = await groq.chat.completions.create({
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64Image}`
          }
        }
      ]
    }
  ],
  temperature: 1,
  max_completion_tokens: 1024,
  top_p: 1,
  stream: false
});
```

### For PDFs:
```typescript
// Advanced PDF processing with pdfjs-dist and Canvas
// Method 1: Direct text extraction (text-based PDFs)
const pdfjsLib = require('pdfjs-dist');
const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
const textContent = await page.getTextContent();

// Method 2: OCR for scanned content (images, drawings, handwriting)
const viewport = page.getViewport({ scale: 1.5 });
const canvas = createCanvas(viewport.width, viewport.height);
await page.render({ canvasContext: context, viewport }).promise;
const ocrResult = await extractTextFromImage(canvas.toBuffer(), questionText);
```

**Advanced PDF Capabilities:**
- **Text Extraction**: Direct extraction from selectable text
- **Image OCR**: Handwritten text recognition from scanned pages
- **Drawing Recognition**: Processes diagrams and charts via OCR
- **Multi-page Support**: Handles documents with multiple pages
- **Mixed Content**: Processes PDFs with both text and images
- **Canvas Rendering**: High-quality page rendering for OCR

## Key Features Used

- `Groq()` - Initializes the Groq client with API key
- `chat.completions.create()` - Sends image + text prompt for analysis
- `meta-llama/llama-4-scout-17b-16e-instruct` - Llama 4 Vision model for OCR
- `pdfjs-dist` - Advanced PDF processing and text extraction
- `canvas` - High-quality PDF page rendering for OCR

## Why This Approach?

- **High Performance** - Groq provides fast inference speeds
- **Vision Capabilities** - Llama 4 model supports image analysis
- **PDF Support** - Handles multi-page PDF documents
- **Large File Support** - Up to 50MB files supported
- **Reliable API** - Stable and well-documented API
- **Confidence Scoring** - Built into the response processing
- **Structured Output** - Clean JSON responses with extracted text

## OCR Flow

```
File Upload → Format Check → Size Validation (50MB) → 
PDF? → Convert to Images → Groq Vision API → Text Extraction → 
Confidence Score → Database Storage
```

## PDF Preview

PDF files can be previewed like images using the preview endpoint:

```typescript
// GET /api/preview/[filePath]
// Converts first page of PDF to image for preview
```

**Preview URL Examples:**
- Image: `/api/preview/submission123/answer1.jpg`
- PDF: `/api/preview/submission123/document.pdf` (shows first page as image)

The SDK provides a unified interface for both vision (OCR) and text (grading) capabilities.

## API Response Format

```json
{
  "success": true,
  "text": "Extracted handwritten text",
  "confidence": "high|medium|low",
  "filePath": "path/to/file.jpg",
  "timestamp": "2026-03-17T..."
}
```

## Usage Example

```typescript
// POST /api/ocr
{
  "filePath": "uploads/student-answer.pdf",
  "questionText": "What is machine learning?"
}
```

## Model Details

- **Model**: meta-llama/llama-4-scout-17b-16e-instruct
- **Capabilities**: Vision + Text understanding
- **Max Tokens**: 1024
- **Temperature**: 1 (for creative text extraction)
- **Streaming**: Disabled for complete response
- **PDF Processing**: First 3 pages converted to 2000x2000px images
