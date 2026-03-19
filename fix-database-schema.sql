-- Migration script to fix missing columns in PostgreSQL database
-- Run this script when database connection is restored

-- Add missing teacherId column to Exam table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Exam' AND column_name = 'teacherId'
    ) THEN
        ALTER TABLE "Exam" ADD COLUMN "teacherId" TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Add missing examId column to Submission table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Submission' AND column_name = 'examId'
    ) THEN
        ALTER TABLE "Submission" ADD COLUMN "examId" TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Add missing examId column to Question table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Question' AND column_name = 'examId'
    ) THEN
        ALTER TABLE "Question" ADD COLUMN "examId" TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Add missing questionId column to Answer table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Answer' AND column_name = 'questionId'
    ) THEN
        ALTER TABLE "Answer" ADD COLUMN "questionId" TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Add missing submissionId column to Answer table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Answer' AND column_name = 'submissionId'
    ) THEN
        ALTER TABLE "Answer" ADD COLUMN "submissionId" TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Create foreign key constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'Exam' AND constraint_name = 'Exam_teacherId_fkey'
    ) THEN
        ALTER TABLE "Exam" ADD CONSTRAINT "Exam_teacherId_fkey" 
        FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'Submission' AND constraint_name = 'Submission_examId_fkey'
    ) THEN
        ALTER TABLE "Submission" ADD CONSTRAINT "Submission_examId_fkey" 
        FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'Question' AND constraint_name = 'Question_examId_fkey'
    ) THEN
        ALTER TABLE "Question" ADD CONSTRAINT "Question_examId_fkey" 
        FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'Answer' AND constraint_name = 'Answer_questionId_fkey'
    ) THEN
        ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" 
        FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'Answer' AND constraint_name = 'Answer_submissionId_fkey'
    ) THEN
        ALTER TABLE "Answer" ADD CONSTRAINT "Answer_submissionId_fkey" 
        FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
