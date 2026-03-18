'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Upload,
  BarChart3,
  FileText,
  Brain,
  PenTool,
  Sparkles,
  Menu,
} from 'lucide-react';
import ExamsTab from '@/components/tabs/ExamsTab';
import UploadTab from '@/components/tabs/UploadTab';
import ResultsTab from '@/components/tabs/ResultsTab';
import AnalyticsTab from '@/components/tabs/AnalyticsTab';

export default function Home() {
  const [teacherId, setTeacherId] = useState<string>('default-teacher');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initTeacher = async () => {
      try {
        // Check if teacher exists or create default
        const response = await fetch('/api/teachers');
        if (response.ok) {
          const teachers = await response.json();
          if (teachers.length > 0) {
            setTeacherId(teachers[0].id);
          } else {
            // Create default teacher
            const createResponse = await fetch('/api/teachers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: 'Default Teacher',
                email: 'teacher@example.com',
              }),
            });
            if (createResponse.ok) {
              const teacher = await createResponse.json();
              setTeacherId(teacher.id);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing teacher:', error);
      } finally {
        setIsInitialized(true);
      }
    };
    initTeacher();
  }, []);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Grade AI System
              </h1>
              <p className="text-xs text-muted-foreground">
                Handwritten Answer Analysis & Assessment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:flex">
              <Sparkles className="h-3 w-3 mr-1" />
              Phase 1
            </Badge>
            <Badge variant="secondary" className="hidden sm:flex">
              <PenTool className="h-3 w-3 mr-1" />
              Handwriting Recognition
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6">
        {!isInitialized ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse flex items-center gap-2">
              <div className="h-4 w-4 bg-muted rounded-full animate-spin" />
              <span className="text-muted-foreground">Initializing...</span>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="exams" className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <TabsList className="grid grid-cols-4 w-full max-w-lg">
                <TabsTrigger value="exams" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Exams</span>
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload</span>
                </TabsTrigger>
                <TabsTrigger value="results" className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Results</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="exams" className="space-y-6">
              <ExamsTab 
                teacherId={teacherId} 
                onExamCreated={handleRefresh}
              />
            </TabsContent>

            <TabsContent value="upload" className="space-y-6">
              <UploadTab 
                teacherId={teacherId}
                onSubmissionCreated={handleRefresh}
              />
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              <ResultsTab refreshTrigger={refreshTrigger} />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <AnalyticsTab refreshTrigger={refreshTrigger} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-4 bg-muted/30">
        <div className="container px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span>Grade AI System - AI-Powered Exam Grading</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Phase 1: Document Ingestion & Digitization</span>
              <Badge variant="outline" className="text-xs">
                VLM-powered
              </Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
