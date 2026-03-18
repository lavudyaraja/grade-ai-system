// Type definitions for the Exam Grading System

export interface Teacher {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    exams: number;
  };
}

export interface Question {
  id: string;
  questionNumber: number;
  questionText: string;
  modelAnswer: string;
  maxMarks: number;
  keywords: string | null;
  gradingNotes: string | null;
  createdAt: string;
  updatedAt: string;
  examId: string;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  totalMarks: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  teacherId: string;
  teacher?: Teacher;
  questions: Question[];
  submissions?: Submission[];
  _count?: {
    submissions: number;
    questions: number;
  };
}

export interface Answer {
  id: string;
  questionNumber: number;
  handwrittenImagePath: string | null;
  recognizedText: string | null;
  modelAnswer: string | null;
  similarityScore: number | null;
  keywordScore: number | null;
  finalScore: number | null;
  maxMarks: number;
  feedback: string | null;
  keyPointsFound: string | null;
  keyPointsMissed: string | null;
  confidenceLevel: string | null;
  needsReview: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  teacherScore: number | null;
  teacherComment: string | null;
  reviewDecision: string | null; // 'accepted' | 'rejected' | 'disputed' | 'pending'
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  questionId: string;
  submissionId: string;
  question?: Question;
}

export interface Submission {
  id: string;
  studentName: string;
  studentId: string | null;
  submittedAt: string;
  status: string;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  feedback: string | null;
  reviewStatus: string | null; // pending | in_review | reviewed | disputed
  reviewFinalizedAt: string | null;
  reviewerNote: string | null;
  examId: string;
  exam?: Exam;
  answers: Answer[];
}

// API Response types
export interface ApiResponse<T> {
  success?: boolean;
  error?: string;
  data?: T;
}

export interface UploadResponse {
  success: boolean;
  filePath: string;
  fullPath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface GradeResponse {
  success: boolean;
  submission: Submission;
  gradedAnswers: Answer[];
}

// Form types
export interface ExamFormData {
  title: string;
  subject: string;
  description?: string;
  teacherId: string;
  questions: QuestionFormData[];
}

export interface QuestionFormData {
  questionNumber: number;
  questionText: string;
  modelAnswer: string;
  maxMarks: number;
  keywords?: string[];
  gradingNotes?: string;
}

export interface SubmissionFormData {
  examId: string;
  studentName: string;
  studentId?: string;
  answers: AnswerFormData[];
}

export interface AnswerFormData {
  questionId: string;
  questionNumber: number;
  handwrittenImagePath?: string;
  maxMarks: number;
}
