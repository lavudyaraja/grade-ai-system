'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Trash2,
  FileText,
  User,
  Calendar,
  Award,
  TrendingUp,
} from 'lucide-react';
import type { Submission, Exam, Answer } from '@/lib/types';

interface ResultsTabProps {
  refreshTrigger?: number;
}

export default function ResultsTab({ refreshTrigger }: ResultsTabProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [submissionsRes, examsRes] = await Promise.all([
          fetch('/api/submissions'),
          fetch('/api/exams'),
        ]);

        if (submissionsRes.ok && examsRes.ok) {
          const [submissionsData, examsData] = await Promise.all([
            submissionsRes.json(),
            examsRes.json(),
          ]);
          setSubmissions(submissionsData);
          setExams(examsData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshTrigger]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/submissions/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSubmissions(prev => prev.filter(s => s.id !== deleteTarget.id));
        setDeleteTarget(null);
        setIsDeleteOpen(false);
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
    } finally {
      setDeleting(false);
    }
  };

  const filteredSubmissions = selectedExamId === 'all'
    ? submissions
    : submissions.filter(s => s.examId === selectedExamId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'graded':
        return 'bg-green-500';
      case 'processing':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    if (percentage >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (confidence: string | null) => {
    switch (confidence) {
      case 'high':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" /> Medium</Badge>;
      case 'low':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> Low</Badge>;
      default:
        return <Badge variant="secondary">Not graded</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Results</h2>
          <p className="text-muted-foreground">
            View graded submissions with detailed feedback
          </p>
        </div>
        <Select value={selectedExamId} onValueChange={setSelectedExamId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filter by exam" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exams</SelectItem>
            {exams.map((exam) => (
              <SelectItem key={exam.id} value={exam.id}>
                {exam.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Award className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No submissions yet</p>
            <p className="text-muted-foreground text-sm">
              Upload handwritten answers to see results here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubmissions.map((submission) => (
            <Card key={submission.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{submission.studentName}</CardTitle>
                    <CardDescription>
                      {submission.exam?.title || 'Unknown Exam'}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    <span className={`mr-1.5 h-2 w-2 rounded-full ${getStatusColor(submission.status)}`} />
                    {submission.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {submission.studentId && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>ID: {submission.studentId}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(submission.submittedAt).toLocaleDateString()}</span>
                  </div>

                  {submission.status === 'graded' && (
                    <>
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Score</span>
                          <span className={`text-sm font-bold ${getScoreColor(submission.percentage || 0)}`}>
                            {submission.totalScore?.toFixed(1)} / {submission.maxScore?.toFixed(1)}
                          </span>
                        </div>
                        <Progress value={submission.percentage || 0} className="h-2" />
                        <p className={`text-xs mt-1 ${getScoreColor(submission.percentage || 0)}`}>
                          {submission.percentage?.toFixed(1)}%
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {submission.answers?.filter(a => a.needsReview).length || 0} need review
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedSubmission(submission);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeleteTarget(submission);
                        setIsDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl grid-rows-[auto_1fr] max-h-[90vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>
              {selectedSubmission?.studentName}&apos;s Results
            </DialogTitle>
            <DialogDescription>
              {selectedSubmission?.exam?.title} - {selectedSubmission?.exam?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 max-h-[70vh]">
            {selectedSubmission && (
              <div className="space-y-6 py-4">
                {/* Overall Score */}
                {selectedSubmission.status === 'graded' && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Score</p>
                          <p className={`text-3xl font-bold ${getScoreColor(selectedSubmission.percentage || 0)}`}>
                            {selectedSubmission.totalScore?.toFixed(1)} / {selectedSubmission.maxScore?.toFixed(0)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {selectedSubmission.percentage?.toFixed(1)}%
                          </p>
                        </div>
                        <div className="w-24 h-24 relative">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="48"
                              cy="48"
                              r="40"
                              stroke="currentColor"
                              strokeWidth="8"
                              fill="none"
                              className="text-muted"
                            />
                            <circle
                              cx="48"
                              cy="48"
                              r="40"
                              stroke="currentColor"
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={`${(selectedSubmission.percentage || 0) * 2.51} 251`}
                              className={getScoreColor(selectedSubmission.percentage || 0)}
                            />
                          </svg>
                        </div>
                      </div>
                      {selectedSubmission.feedback && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium mb-1">Feedback</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedSubmission.feedback}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Individual Answers */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Answer Details</h3>
                  {selectedSubmission.answers?.map((answer) => (
                    <Card key={answer.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Q{answer.questionNumber}</Badge>
                            {getConfidenceBadge(answer.confidenceLevel)}
                          </div>
                          <div className="flex items-center gap-2">
                            {answer.needsReview && (
                              <Badge variant="destructive">Needs Review</Badge>
                            )}
                            <span className={`font-bold ${getScoreColor(
                              answer.maxMarks > 0 ? ((answer.finalScore || 0) / answer.maxMarks) * 100 : 0
                            )}`}>
                              {answer.finalScore?.toFixed(1) || 0} / {answer.maxMarks}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Question */}
                        <div>
                          <p className="text-sm font-medium mb-1">Question</p>
                          <p className="text-sm text-muted-foreground">
                            {answer.question?.questionText}
                          </p>
                        </div>

                        {/* Recognized Text */}
                        {answer.recognizedText && (
                          <div>
                            <p className="text-sm font-medium mb-1">Recognized Answer</p>
                            <div className="p-3 bg-muted/50 rounded-lg max-h-40 overflow-y-auto">
                              <p className="text-sm whitespace-pre-wrap">
                                {answer.recognizedText}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Model Answer */}
                        {answer.modelAnswer && (
                          <div>
                            <p className="text-sm font-medium mb-1">Model Answer</p>
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg max-h-40 overflow-y-auto">
                              <p className="text-sm whitespace-pre-wrap">
                                {answer.modelAnswer}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Scores */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground">Similarity Score</p>
                            <Progress value={(answer.similarityScore || 0) * 100} className="h-2 mt-1" />
                            <p className="text-xs mt-1">{((answer.similarityScore || 0) * 100).toFixed(0)}%</p>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground">Keyword Coverage</p>
                            <Progress value={(answer.keywordScore || 0) * 100} className="h-2 mt-1" />
                            <p className="text-xs mt-1">{((answer.keywordScore || 0) * 100).toFixed(0)}%</p>
                          </div>
                        </div>

                        {/* Key Points */}
                        <div className="grid grid-cols-2 gap-4">
                          {answer.keyPointsFound && (
                            <div>
                              <p className="text-sm font-medium text-green-600 mb-1">
                                <CheckCircle className="inline h-3 w-3 mr-1" />
                                Key Points Found
                              </p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {JSON.parse(answer.keyPointsFound).map((point: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1">
                                    <span className="text-green-500">✓</span>
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {answer.keyPointsMissed && (
                            <div>
                              <p className="text-sm font-medium text-red-600 mb-1">
                                <XCircle className="inline h-3 w-3 mr-1" />
                                Key Points Missed
                              </p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {JSON.parse(answer.keyPointsMissed).map((point: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1">
                                    <span className="text-red-500">✗</span>
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Feedback */}
                        {answer.feedback && (
                          <div>
                            <p className="text-sm font-medium mb-1">Feedback</p>
                            <p className="text-sm text-muted-foreground p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              {answer.feedback}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.studentName}&apos;s submission?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
