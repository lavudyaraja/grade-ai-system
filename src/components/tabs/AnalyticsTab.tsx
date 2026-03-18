'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  Users,
  FileText,
  Award,
  BarChart3,
  Activity,
} from 'lucide-react';
import type { Submission, Exam } from '@/lib/types';

interface AnalyticsTabProps {
  refreshTrigger?: number;
}

const COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444'];

export default function AnalyticsTab({ refreshTrigger }: AnalyticsTabProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [submissionsRes, examsRes] = await Promise.all([
          fetch('/api/submissions?status=graded'),
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

  const filteredSubmissions = selectedExamId === 'all'
    ? submissions
    : submissions.filter(s => s.examId === selectedExamId);

  // Calculate statistics
  const totalSubmissions = filteredSubmissions.length;
  const gradedSubmissions = filteredSubmissions.filter(s => s.status === 'graded').length;
  const averageScore = gradedSubmissions > 0
    ? filteredSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / gradedSubmissions
    : 0;
  const totalExams = exams.length;

  // Score distribution
  const scoreDistribution = [
    { range: '80-100%', count: filteredSubmissions.filter(s => (s.percentage || 0) >= 80).length, color: COLORS[0] },
    { range: '60-79%', count: filteredSubmissions.filter(s => (s.percentage || 0) >= 60 && (s.percentage || 0) < 80).length, color: COLORS[1] },
    { range: '40-59%', count: filteredSubmissions.filter(s => (s.percentage || 0) >= 40 && (s.percentage || 0) < 60).length, color: COLORS[2] },
    { range: '0-39%', count: filteredSubmissions.filter(s => (s.percentage || 0) < 40).length, color: COLORS[3] },
  ];

  // Question performance
  const questionPerformance = selectedExamId !== 'all' 
    ? (() => {
        const examSubmissions = filteredSubmissions;
        if (examSubmissions.length === 0) return [];
        
        const exam = exams.find(e => e.id === selectedExamId);
        if (!exam) return [];
        
        return exam.questions.map(q => {
          const answers = examSubmissions.flatMap(s => s.answers.filter(a => a.questionId === q.id));
          const avgScore = answers.length > 0
            ? answers.reduce((sum, a) => sum + (a.finalScore || 0), 0) / answers.length
            : 0;
          return {
            name: `Q${q.questionNumber}`,
            avgScore: avgScore.toFixed(1),
            maxMarks: q.maxMarks,
            percentage: q.maxMarks > 0 ? (avgScore / q.maxMarks) * 100 : 0,
          };
        });
      })()
    : [];

  // Recent activity
  const recentActivity = [...filteredSubmissions]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  // Top performers
  const topPerformers = [...filteredSubmissions]
    .filter(s => s.status === 'graded')
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Score distribution, statistics, and performance insights
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalSubmissions}</div>
                <p className="text-xs text-muted-foreground">
                  {gradedSubmissions} graded
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{averageScore.toFixed(1)}%</div>
                <Progress value={averageScore} className="h-2 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalExams}</div>
                <p className="text-xs text-muted-foreground">
                  {exams.filter(e => e.status === 'active').length} active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {gradedSubmissions > 0
                    ? ((filteredSubmissions.filter(s => (s.percentage || 0) >= 40).length / gradedSubmissions) * 100).toFixed(0)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  &gt;= 40% threshold
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Score Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>Distribution of student scores</CardDescription>
              </CardHeader>
              <CardContent>
                {gradedSubmissions === 0 ? (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    No graded submissions yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={scoreDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="count"
                        label={({ range, count }) => `${range}: ${count}`}
                      >
                        {scoreDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Score Distribution Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Score Ranges</CardTitle>
                <CardDescription>Number of students in each score range</CardDescription>
              </CardHeader>
              <CardContent>
                {gradedSubmissions === 0 ? (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    No graded submissions yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]}>
                        {scoreDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Question Performance - only show when specific exam selected */}
          {selectedExamId !== 'all' && questionPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Question Performance</CardTitle>
                <CardDescription>Average score per question</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={questionPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgScore" fill="#3b82f6" name="Average Score" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {questionPerformance.map((q, i) => (
                    <div key={i} className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium">{q.name}</p>
                      <p className="text-lg font-bold">{q.avgScore} / {q.maxMarks}</p>
                      <Progress value={q.percentage} className="h-2 mt-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bottom Section */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  Top Performers
                </CardTitle>
                <CardDescription>Highest scoring students</CardDescription>
              </CardHeader>
              <CardContent>
                {topPerformers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No graded submissions yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topPerformers.map((submission, index) => (
                      <div key={submission.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-100 text-gray-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{submission.studentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {submission.exam?.title}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{submission.percentage?.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">
                            {submission.totalScore?.toFixed(1)} / {submission.maxScore?.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No submissions yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((submission) => (
                      <div key={submission.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{submission.studentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {submission.exam?.title}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={submission.status === 'graded' ? 'default' : 'secondary'}>
                            {submission.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(submission.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
