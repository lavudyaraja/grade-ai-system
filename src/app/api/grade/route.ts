import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import Groq from 'groq-sdk';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
});

// Recognize handwritten text from image using Groq Vision API
async function recognizeHandwriting(
  imagePath: string,
  questionText: string
): Promise<{ text: string; confidence: string }> {
  try {
    // Check if file is PDF
    const extension = imagePath.split('.').pop()?.toLowerCase();
    
    if (extension === 'pdf') {
      // Handle PDF processing
      return await extractTextFromPDF(imagePath, questionText);
    }
    
    // Handle image processing
    const imageBuffer = await readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine mime type
    const mimeType = extension === 'png' ? 'image/png' : 
                     extension === 'webp' ? 'image/webp' :
                     extension === 'tiff' || extension === 'tif' ? 'image/tiff' :
                     'image/jpeg';

    const prompt = `You are an expert OCR system specialized in reading handwritten text from exam answer sheets.

The student is answering this question: "${questionText}"

Please carefully analyze this handwritten answer image and extract ALL handwritten text accurately. Maintain the original structure and formatting. Return ONLY the extracted text content, no additional commentary.`;

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

    const extractedText = completion.choices[0]?.message?.content || '';
    
    // Estimate confidence based on response
    const unclearCount = (extractedText.match(/\[unclear\]/g) || []).length;
    const confidence = extractedText.length === 0 ? 'low' :
                       unclearCount > 3 ? 'low' :
                       unclearCount > 0 ? 'medium' : 'high';

    return { text: extractedText, confidence };
  } catch (error) {
    console.error('Error recognizing handwriting:', error);
    return { text: '', confidence: 'low' };
  }
}

// Extract text from PDF using advanced processing with pdfjs-dist
async function extractTextFromPDF(
  pdfPath: string,
  questionText: string
): Promise<{ text: string; confidence: string }> {
  try {
    console.log('Starting advanced PDF processing with pdfjs-dist for grading:', pdfPath);
    
    // Method 1: Use pdfjs-dist to extract text and render pages as images
    try {
      const fs = require('fs');
      const pdfjsLib = require('pdfjs-dist');
      
      // Set up worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry.js');
      
      // Read PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
      const pdf = await loadingTask.promise;
      
      console.log(`PDF loaded successfully for grading with ${pdf.numPages} pages`);
      
      let allExtractedText = '';
      let totalConfidence = 0;
      let processedPages = 0;
      
      // Process each page (limit to 3 pages for grading performance)
      const maxPages = Math.min(pdf.numPages, 3);
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          console.log(`Processing page ${pageNum} for grading...`);
          
          // Get page
          const page = await pdf.getPage(pageNum);
          
          // Extract text content
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .trim();
          
          if (pageText.length > 10) {
            console.log(`Page ${pageNum}: Extracted ${pageText.length} characters of text for grading`);
            allExtractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
            totalConfidence += 3; // High confidence for extracted text
            processedPages++;
          } else {
            console.log(`Page ${pageNum}: Minimal text found, trying OCR for grading...`);
            
            // Render page as image for OCR
            try {
              const viewport = page.getViewport({ scale: 1.5 });
              const { createCanvas } = require('canvas');
              const canvas = createCanvas(viewport.width, viewport.height);
              const context = canvas.getContext('2d');
              
              // Render PDF page to canvas
              await page.render({ canvasContext: context, viewport }).promise;
              
              // Convert canvas to buffer
              const imageBuffer = canvas.toBuffer('image/png');
              
              // Save temporary image file
              const tempImagePath = `${process.cwd()}/temp/pdf-grade-${pageNum}-${Date.now()}.png`;
              fs.writeFileSync(tempImagePath, imageBuffer);
              
              // Use OCR on the rendered image
              const ocrResult = await recognizeHandwriting(tempImagePath, questionText);
              
              if (ocrResult.text && ocrResult.text.trim().length > 10) {
                allExtractedText += `\n--- Page ${pageNum} (OCR) ---\n${ocrResult.text}\n`;
                totalConfidence += ocrResult.confidence === 'high' ? 3 : ocrResult.confidence === 'medium' ? 2 : 1;
                console.log(`Page ${pageNum}: OCR completed successfully for grading`);
              } else {
                allExtractedText += `\n--- Page ${pageNum} ---\n[No readable text found on this page]\n`;
              }
              
              // Clean up temporary file
              try {
                fs.unlinkSync(tempImagePath);
              } catch (cleanupError) {
                console.warn(`Failed to clean up ${tempImagePath} in grading:`, cleanupError);
              }
            } catch (ocrError) {
              console.error(`OCR failed for page ${pageNum} in grading:`, ocrError);
              allExtractedText += `\n--- Page ${pageNum} ---\n[OCR processing failed for this page]\n`;
            }
          }
        } catch (pageError) {
          console.error(`Error processing page ${pageNum} for grading:`, pageError);
          allExtractedText += `\n--- Page ${pageNum} ---\n[Error processing this page]\n`;
        }
      }
      
      if (processedPages > 0 || allExtractedText.trim().length > 20) {
        // Calculate average confidence
        const avgConfidence = processedPages > 0 ? totalConfidence / (processedPages * 3) : 0.5;
        const confidence = avgConfidence >= 0.7 ? 'high' : avgConfidence >= 0.4 ? 'medium' : 'low';
        
        console.log(`PDF processing for grading completed. Processed ${processedPages} pages with confidence: ${confidence}`);
        return { text: allExtractedText.trim(), confidence };
      }
    } catch (pdfjsError) {
      console.error('PDF.js processing failed for grading:', pdfjsError);
    }
    
    // Method 2: Fallback - Try basic file reading
    console.log('PDF.js failed for grading, trying fallback method...');
    try {
      const fs = require('fs');
      const stats = fs.statSync(pdfPath);
      
      return { 
        text: `[PDF document received for grading (${Math.round(stats.size / 1024)}KB). The system attempted to extract text using multiple methods including:\n\n• Direct text extraction for selectable text\n• OCR processing for scanned content and images\n• Drawing and diagram recognition\n\nHowever, automatic extraction was not successful. This could be due to:\n• The PDF being password-protected\n• Very complex layouts or formatting\n• Corrupted PDF file\n• Unsupported content types\n\nRecommendations:\n• Try uploading the document as individual images\n• Ensure the PDF is not password-protected\n• For best results, upload clear images of handwritten content\n• The system can process images, drawings, and handwritten text very effectively]`, 
        confidence: 'low' 
      };
    } catch (fallbackError) {
      console.error('Fallback processing also failed for grading:', fallbackError);
      return { text: '[PDF processing failed completely for grading]', confidence: 'low' };
    }
  } catch (error) {
    console.error('Critical error in PDF processing for grading:', error);
    return { text: '', confidence: 'low' };
  }
}

// Evaluate answer against model answer using LLM
async function evaluateAnswer(
  recognizedText: string,
  modelAnswer: string,
  keywords: string[],
  maxMarks: number,
  questionText: string
): Promise<{
  similarityScore: number;
  keywordScore: number;
  finalScore: number;
  feedback: string;
  keyPointsFound: string[];
  keyPointsMissed: string[];
}> {
  try {
    const keywordsList = keywords.length > 0 
      ? `\nKEYWORDS TO LOOK FOR: ${keywords.join(', ')}` 
      : '';

    const prompt = `You are an expert exam grader. Evaluate this student's answer.

QUESTION: ${questionText}

STUDENT ANSWER:
${recognizedText}

MODEL ANSWER:
${modelAnswer}
${keywordsList}

Evaluate and respond in this exact JSON format:
{
  "similarityScore": <number 0-1 representing semantic similarity>,
  "keywordScore": <number 0-1 representing keyword coverage>,
  "finalScore": <number representing marks to award out of ${maxMarks}>,
  "feedback": "<detailed feedback for the student>",
  "keyPointsFound": ["<point1>", "<point2>"],
  "keyPointsMissed": ["<point1>", "<point2>"]
}

Be fair and constructive. Award partial credit where appropriate.`;

    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: 'system', content: 'You are an expert exam grader. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_completion_tokens: 1024,
      top_p: 1,
      stream: false
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        similarityScore: Math.min(1, Math.max(0, result.similarityScore || 0)),
        keywordScore: Math.min(1, Math.max(0, result.keywordScore || 0)),
        finalScore: Math.min(maxMarks, Math.max(0, result.finalScore || 0)),
        feedback: result.feedback || 'No feedback available',
        keyPointsFound: result.keyPointsFound || [],
        keyPointsMissed: result.keyPointsMissed || []
      };
    }
  } catch (error) {
    console.error('Error evaluating answer:', error);
  }

  // Return default values if evaluation fails
  return {
    similarityScore: 0,
    keywordScore: 0,
    finalScore: 0,
    feedback: 'Evaluation failed',
    keyPointsFound: [],
    keyPointsMissed: []
  };
}

// POST /api/grade - Process and grade a submission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, answerIds } = body;

    if (!submissionId) {
      return NextResponse.json(
        { error: 'Missing submissionId' },
        { status: 400 }
      );
    }

    // Get submission with answers and questions
    const submission = await db.submission.findUnique({
      where: { id: submissionId },
      include: {
        exam: {
          include: {
            questions: true
          }
        },
        answers: {
          include: {
            question: true
          },
          orderBy: { questionNumber: 'asc' }
        }
      }
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Update submission status to processing
    await db.submission.update({
      where: { id: submissionId },
      data: { status: 'processing' }
    });

    // Filter answers to grade if specific answerIds provided
    const answersToGrade = answerIds 
      ? submission.answers.filter(a => answerIds.includes(a.id))
      : submission.answers;

    // Process each answer
    const results: any[] = [];
    for (const answer of answersToGrade) {
      const question = answer.question;
      
      // Use pre-extracted text if available, otherwise extract from image
      let recognizedText = answer.recognizedText || '';
      let confidence = answer.confidenceLevel || 'medium';

      // If no pre-extracted text but image exists, extract it now
      if (!recognizedText && answer.handwrittenImagePath) {
        const imagePath = path.join(process.cwd(), 'uploads', answer.handwrittenImagePath);
        
        try {
          await access(imagePath, constants.R_OK);
          const recognition = await recognizeHandwriting(imagePath, question.questionText);
          recognizedText = recognition.text;
          confidence = recognition.confidence;
        } catch {
          console.error(`Image not found: ${imagePath}`);
          recognizedText = '[Image not found]';
          confidence = 'low';
        }
      }

      // If still no text, mark as not provided
      if (!recognizedText || recognizedText.trim() === '') {
        recognizedText = '[No answer provided]';
        confidence = 'low';
      }

      // Parse keywords from question
      let keywords: string[] = [];
      if (question.keywords) {
        try {
          keywords = JSON.parse(question.keywords as string) as string[];
        } catch {
          keywords = [];
        }
      }

      // Evaluate the answer
      const evaluation = await evaluateAnswer(
        recognizedText,
        question.modelAnswer,
        keywords,
        question.maxMarks,
        question.questionText
      );

      // Update answer in database
      const updatedAnswer = await db.answer.update({
        where: { id: answer.id },
        data: {
          recognizedText,
          modelAnswer: question.modelAnswer,
          similarityScore: evaluation.similarityScore,
          keywordScore: evaluation.keywordScore,
          finalScore: evaluation.finalScore,
          feedback: evaluation.feedback,
          keyPointsFound: JSON.stringify(evaluation.keyPointsFound),
          keyPointsMissed: JSON.stringify(evaluation.keyPointsMissed),
          confidenceLevel: confidence,
          needsReview: confidence === 'low' || evaluation.finalScore < question.maxMarks * 0.3
        }
      });

      results.push(updatedAnswer);
    }

    // Calculate total score
    const allAnswers = await db.answer.findMany({
      where: { submissionId }
    });

    const totalScore = allAnswers.reduce((sum, a) => sum + (a.finalScore || 0), 0);
    const maxScore = allAnswers.reduce((sum, a) => sum + a.maxMarks, 0);
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    // Generate overall feedback
    const feedbackResponse = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { 
          role: 'system', 
          content: 'You are an encouraging teacher providing overall feedback on exam performance.' 
        },
        { 
          role: 'user', 
          content: `A student scored ${totalScore.toFixed(1)} out of ${maxScore} (${percentage.toFixed(1)}%) on an exam. 
                    The exam is titled "${submission.exam.title}" in subject "${submission.exam.subject}".
                    Provide a brief, encouraging overall feedback comment (2-3 sentences).`
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 200,
      top_p: 1,
      stream: false
    });

    const overallFeedback = feedbackResponse.choices[0]?.message?.content || 'Thank you for your submission.';

    // Update submission with final scores
    const updatedSubmission = await db.submission.update({
      where: { id: submissionId },
      data: {
        status: 'graded',
        totalScore,
        maxScore,
        percentage,
        feedback: overallFeedback
      },
      include: {
        answers: {
          include: {
            question: true
          },
          orderBy: { questionNumber: 'asc' }
        }
      }
    });

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      gradedAnswers: results
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    return NextResponse.json(
      { error: 'Failed to grade submission' },
      { status: 500 }
    );
  }
}
