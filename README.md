<div align="center">

<img src="https://www.lavudyaraja.in/favicon.ico" width="80" height="80" alt="Grade AI Logo" />

# Grade AI System

### AI-Powered Exam Grading & Assessment Platform

**Automated handwritten answer analysis using Vision Language Models**

[![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Groq](https://img.shields.io/badge/Groq-Llama_4_Vision-orange?style=flat-square)](https://groq.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](LICENSE)

---

[Features](#-features) · [Tech Stack](#-technology-stack) · [Installation](#️-installation) · [Usage](#-core-workflows) · [API Reference](#-api-reference) · [Database](#-database-schema) · [Deployment](#-deployment) · [Roadmap](#-roadmap)

</div>

---

## Overview

**Grade AI** is a production-grade, AI-powered examination management and automated grading system designed for educational institutions. It transforms the tedious manual grading of handwritten exam papers into a fast, consistent, and intelligent workflow — leveraging Groq's Llama 4 Vision model for state-of-the-art OCR and semantic understanding.

Teachers create exams, students upload handwritten answer sheets (as photos or PDFs), and the AI extracts, structures, and grades the content automatically — providing per-question scores, detailed feedback, and class-wide analytics.

---

## ✨ Features

### 📝 Exam Management
- **Full Exam Lifecycle**: Draft → Active → Graded workflow with status tracking
- **Rich Question Builder**: Add multiple questions with model answers, max marks, grading keywords, and assessment criteria
- **Bulk Operations**: Duplicate exams, batch-update questions, archive old papers
- **Preview Mode**: Simulate the student view before publishing an exam

### 🖊️ Handwriting Recognition (OCR)
- **Advanced Vision OCR**: Powered by Groq's Llama 4 Scout 17B model
- **Multi-Format Ingestion**: JPEG, PNG, WebP, TIFF, and multi-page PDF support
- **Page-Wise Extraction**: Each PDF page is individually rendered at 3× resolution and OCR'd — results navigable page by page in the UI
- **Structured Content Parsing**: Extracts and categorises:
  - 📄 Main text and paragraphs
  - ➗ Mathematical formulas and equations (inline `$...$` and block `$$...$$`)
  - 💻 Code blocks with syntax preserved
  - 📊 Tables (headers + rows reconstructed)
  - 🖼️ Diagrams and figures (described with labels and components)
  - 📌 Annotations, margin notes, and footnotes
  - 🔢 Numbered and bulleted lists
- **Confidence Scoring**: High / Medium / Low confidence per page
- **Retry on Failure**: One-click OCR retry per question without re-uploading
- **Native Text Layer Fallback**: For digital PDFs, the native text layer is merged with OCR output for maximum accuracy

### 🤖 AI-Powered Grading
- **Semantic Similarity**: Deep comparison between student and model answers
- **Keyword Coverage**: Automatic detection of required terms and concepts
- **Partial Credit Scoring**: Proportional marks for partially correct responses
- **Per-Question Feedback**: AI-generated, constructive feedback for every answer
- **Low-Confidence Flagging**: Automatically surfaces answers needing human review
- **Override Support**: Teachers can manually adjust AI scores and leave comments
- **Bulk Re-grade**: Re-run grading on a submission after OCR correction

### 📊 Analytics & Reporting
- **Student Report Cards**: Full per-student breakdown by question
- **Class Performance Dashboard**: Score distribution, mean, median, percentiles
- **Question Difficulty Analysis**: Identify questions where students struggle most
- **Keyword Hit Maps**: Visualise which keywords students include or miss
- **Time-Series Trends**: Track class improvement across multiple exams
- **Export Options**: Download results as CSV or PDF reports

### 🎨 UI/UX
- **Responsive Design**: Fully functional on desktop, tablet, and mobile
- **Dark Mode**: System-aware automatic theme switching
- **Drag-and-Drop Uploads**: Per-question file drop zones
- **Real-Time Status**: Live upload, OCR, and grading progress indicators
- **Page-Wise Dialog Viewer**: Navigate multi-page PDF extractions with structured/raw toggle
- **Copy to Clipboard**: One-click copy for any extracted section
- **Keyboard Shortcuts**: Escape to close dialogs, arrow keys for page navigation

### 🔒 Security
- **Directory Traversal Protection**: Resolved-path bounds checking on all file serves
- **File Type Validation**: MIME type + extension double-check on upload
- **File Size Limits**: Configurable max size (default 50 MB)
- **Input Sanitisation**: All user inputs sanitised before database writes
- **Environment-Based Secrets**: No credentials in source code
- **Submission ID Scoping**: Files namespaced per submission to prevent collisions

---

## 🚀 Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15+ (App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **Database** | PostgreSQL 14+ |
| **ORM** | Prisma |
| **AI / OCR** | Groq SDK — Llama 4 Scout 17B Vision |
| **PDF Rendering** | pdfjs-dist (legacy build) + node-canvas |
| **Web Server** | Caddy (reverse proxy) |
| **Runtime** | Node.js 18+ |

---

## 🛠️ Installation

### Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- **PostgreSQL** 14 or later (running locally or remote)
- **Groq API Key** — obtain free at [console.groq.com](https://console.groq.com)

---

### 1. Clone the Repository

```bash
git clone <repository-url>
cd score_ai
```

### 2. Install Dependencies

```bash
npm install
```

> **Note:** `canvas` (used for PDF rendering) requires system libraries.
> On Ubuntu/Debian: `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
> On macOS: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`

### 3. Configure Environment

Create `.env.local` in the project root:

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://username:password@localhost:5432/grade_ai"

# ── Groq AI (OCR & Grading) ───────────────────────────────────────────────────
GROQ_API_KEY="your-groq-api-key-here"
GROQ_OCR_MODEL="meta-llama/llama-4-scout-17b-16e-instruct"

# ── File Storage ──────────────────────────────────────────────────────────────
UPLOAD_DIR="uploads"
TEMP_DIR="temp"
MAX_FILE_SIZE="52428800"

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"
```

> Generate a secure secret: `openssl rand -base64 32`

### 4. Set Up the Database

```bash
# Generate the Prisma client
npm run db:generate

# Apply database schema
npm run db:push          # Development (no migration history)
# — or —
npm run db:migrate       # Production (with migration tracking)
```

### 5. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
score_ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── exams/              # Exam CRUD endpoints
│   │   │   ├── files/[...path]/    # Secure file serving
│   │   │   ├── grade/              # AI grading pipeline
│   │   │   ├── ocr/                # OCR extraction (images + PDFs)
│   │   │   ├── structured-pdf/     # Page-wise structured PDF extraction
│   │   │   ├── submissions/        # Student submission management
│   │   │   ├── answers/[id]/       # Per-answer patch endpoint
│   │   │   ├── results/            # Graded result retrieval
│   │   │   └── teachers/           # Teacher account management
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── tabs/
│   │   │   ├── UploadTab.tsx       # File upload, OCR, submission creation
│   │   │   ├── ExamsTab.tsx        # Exam creation and management
│   │   │   ├── ResultsTab.tsx      # Grading results and review
│   │   │   └── AnalyticsTab.tsx    # Class analytics dashboard
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── PDFPreview.tsx          # Embedded PDF viewer
│   │   ├── PageWiseViewer.tsx      # Multi-page OCR result navigator
│   │   └── FullScreenTextDialog.tsx
│   └── lib/
│       ├── db.ts                   # Prisma client singleton
│       ├── types/                  # Shared TypeScript types
│       └── utils.ts
├── prisma/
│   └── schema.prisma
├── uploads/                        # Runtime: uploaded answer files
├── temp/                           # Runtime: temporary PDF processing
├── public/
├── Caddyfile
├── package.json
└── README.md
```

---

## 🎯 Core Workflows

### Teacher — Creating an Exam

```
1. Open the Exams tab
2. Click "New Exam" → fill in title, subject, description
3. Add questions:
   - Question text
   - Model answer
   - Max marks
   - Required keywords (comma-separated)
   - Grading notes / rubric
4. Save as Draft → review → set Status to "Active"
```

### Teacher — Uploading a Student Submission

```
1. Open the Upload tab
2. Select the exam from the dropdown
3. Enter student name and roll number
4. Click "Create Submission"
5. For each question, drag-and-drop or browse for the answer image/PDF
6. Watch real-time OCR — each file is processed immediately after upload
7. Click "View Extraction" to inspect page-wise structured output
8. Click "Start AI Grading" when ready
```

### Teacher — Reviewing Results

```
1. Open the Results tab
2. Select the submission to review
3. Per-question breakdown:
   - AI score vs max marks
   - Extracted student text
   - AI feedback
   - Keyword coverage
   - Confidence level
4. Adjust scores manually if needed
5. Mark as "Final" to lock the result
```

### Student Experience (Read-Only Portal)

```
1. Teacher shares submission link
2. Student views their results per question
3. Sees AI feedback and correct model answer
4. Downloads their report card PDF
```

---

## 📡 API Reference

### OCR & Processing

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ocr` | Extract text from image or PDF. Returns `pages[]` + flat `text`. |
| `POST` | `/api/structured-pdf` | Deep page-wise structured extraction from PDF. |
| `POST` | `/api/upload` | Upload a file. Returns `filePath` for subsequent OCR calls. |
| `GET` | `/api/files/[...path]` | Serve an uploaded file with correct Content-Type. |

#### `POST /api/ocr` — Request Body

```json
{
  "filePath": "submissionId/q1-1234567890.jpg",
  "questionText": "Explain the concept of a symbol table in compilers."
}
```

#### `POST /api/ocr` — Response

```json
{
  "success": true,
  "text": "=== Page 1 ===\nA symbol table is a data structure...",
  "confidence": "high",
  "pages": [
    {
      "pageNumber": 1,
      "rawText": "A symbol table is a data structure used by compilers...",
      "sections": {
        "mainText": ["A symbol table is..."],
        "mathematics": ["$O(1)$ average lookup time"],
        "code": ["```c\nstruct Entry { char *name; int type; };\n```"],
        "tables": [{ "headers": ["Operation", "Complexity"], "rows": [["Insert", "O(1)"]] }],
        "diagrams": [{ "type": "flowchart", "description": "...", "labels": ["Input","Lookup"] }],
        "annotations": [],
        "lists": ["Hash table implementation", "Binary search tree implementation"]
      },
      "confidence": "high",
      "wordCount": 312
    }
  ],
  "totalPages": 1
}
```

---

### Exam Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/exams` | List all exams for the authenticated teacher. |
| `POST` | `/api/exams` | Create a new exam with questions. |
| `GET` | `/api/exams/[id]` | Get a single exam with all questions. |
| `PUT` | `/api/exams/[id]` | Update exam details or questions. |
| `DELETE` | `/api/exams/[id]` | Delete an exam and all associated data. |

---

### Submissions & Grading

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/submissions` | List all submissions (optionally filter by exam). |
| `POST` | `/api/submissions` | Create a new student submission. Returns answer IDs. |
| `GET` | `/api/submissions/[id]` | Get full submission with answers. |
| `PATCH` | `/api/answers/[id]` | Update an answer with OCR text, image path, confidence. |
| `POST` | `/api/grade` | Run AI grading on a submission. |
| `GET` | `/api/results` | List graded results with scores and feedback. |
| `GET` | `/api/results/[id]` | Get full result detail for one submission. |

---

## 🗄️ Database Schema

```prisma
model Teacher {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  exams     Exam[]
  createdAt DateTime @default(now())
}

model Exam {
  id          String       @id @default(cuid())
  title       String
  subject     String
  description String?
  status      ExamStatus   @default(DRAFT)
  totalMarks  Int
  teacher     Teacher      @relation(fields: [teacherId], references: [id])
  teacherId   String
  questions   Question[]
  submissions Submission[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Question {
  id           String   @id @default(cuid())
  questionNumber Int
  questionText String
  modelAnswer  String
  maxMarks     Int
  keywords     String[] // required keywords for grading
  gradingNotes String?
  exam         Exam     @relation(fields: [examId], references: [id])
  examId       String
  answers      Answer[]
}

model Submission {
  id          String           @id @default(cuid())
  studentName String
  studentId   String?
  status      SubmissionStatus @default(PENDING)
  exam        Exam             @relation(fields: [examId], references: [id])
  examId      String
  answers     Answer[]
  totalScore  Float?
  createdAt   DateTime         @default(now())
  gradedAt    DateTime?
}

model Answer {
  id                   String     @id @default(cuid())
  questionNumber       Int
  handwrittenImagePath String?
  recognizedText       String?
  confidenceLevel      String?
  aiScore              Float?
  maxMarks             Int
  aiFeedback           String?
  keywordMatches       String[]
  needsReview          Boolean    @default(false)
  teacherScore         Float?     // manual override
  teacherComment       String?
  submission           Submission @relation(fields: [submissionId], references: [id])
  submissionId         String
  question             Question   @relation(fields: [questionId], references: [id])
  questionId           String
}

enum ExamStatus       { DRAFT ACTIVE GRADED ARCHIVED }
enum SubmissionStatus { PENDING PROCESSING GRADED REVIEWED }
```

---

## 🚀 Deployment

### Development

```bash
npm run dev          # Start with hot reload on :3000
npm run lint         # ESLint check
npm run build        # Production build
npm run start        # Start production server
```

### Database Commands

```bash
npm run db:generate  # Re-generate Prisma client after schema changes
npm run db:push      # Push schema without migration history (dev)
npm run db:migrate   # Create and apply migration (production)
npm run db:reset     # Drop and recreate database (dev only)
npm run db:studio    # Open Prisma Studio GUI
```

### Production with Caddy

```caddyfile
# Caddyfile
your-domain.com {
    reverse_proxy localhost:3000
    encode gzip
    file_server
}
```

```bash
# Build and start
npm run build
NODE_ENV=production npm run start &
caddy run --config Caddyfile
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine AS builder
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
RUN apk add --no-cache cairo pango jpeg giflib librsvg
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## ⚙️ Configuration Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `GROQ_API_KEY` | ✅ | — | Groq API key for vision OCR |
| `GROQ_OCR_MODEL` | ❌ | `meta-llama/llama-4-scout-17b-16e-instruct` | Groq model ID |
| `UPLOAD_DIR` | ❌ | `uploads` | Directory for uploaded files |
| `TEMP_DIR` | ❌ | `temp` | Directory for temporary PDF rendering |
| `MAX_FILE_SIZE` | ❌ | `52428800` | Max upload size in bytes (50 MB) |
| `NEXT_PUBLIC_APP_URL` | ❌ | `http://localhost:3000` | Public base URL |
| `NEXTAUTH_SECRET` | ✅ | — | NextAuth session signing secret |

---

## 🔮 Roadmap

### Version 2.0
- [ ] Multi-language OCR (Hindi, Tamil, Telugu, Arabic, Chinese)
- [ ] Bulk PDF upload — auto-split pages per question
- [ ] Real-time collaborative grading (multiple teachers, same submission)
- [ ] Mobile camera capture with auto-crop and deskew

### Version 2.1
- [ ] Student self-submission portal with OTP authentication
- [ ] WhatsApp / email notification on grade release
- [ ] Rubric-based grading templates
- [ ] Integration with Google Classroom and Moodle LMS

### Version 3.0
- [ ] AWS S3 / Google Cloud Storage backend for files
- [ ] Advanced analytics with ML-powered difficulty prediction
- [ ] Native iOS and Android application
- [ ] Third-party LMS API integrations (Canvas, Blackboard)
- [ ] Plagiarism detection between student submissions

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request with a clear description of changes

Please follow the existing code style and include TypeScript types for all new code.

---

## 🆘 Support & Contact

| Channel | Details |
|---|---|
| **Author** | Rajaram |
| **Website** | [www.lavudyaraja.in](https://www.lavudyaraja.in) |
| **API Docs** | See `OCR_AI_API.md` in the repository |
| **Issues** | Open a GitHub Issue for bugs or feature requests |

---

## 📝 License

This project is proprietary software. All rights reserved © Rajaram.

---

<div align="center">

**Built with care using Next.js, TypeScript, PostgreSQL, and Groq Vision AI**

[⬆ Back to top](#grade-ai-system)

</div>#   g r a d e - a i - f o r - e d u c a t i o n  
 