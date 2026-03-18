import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface ExamMetaFieldsProps {
  title?: string;
  subject?: string;
  description?: string;
  status?: 'draft' | 'active';
  onTitleChange?: (value: string) => void;
  onSubjectChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
  onStatusChange?: (value: 'draft' | 'active') => void;
}

export function ExamMetaFields({
  title = '',
  subject = '',
  description = '',
  status = 'draft',
  onTitleChange,
  onSubjectChange,
  onDescriptionChange,
  onStatusChange,
}: ExamMetaFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-xs font-semibold text-gray-700">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            placeholder="e.g. Midterm Exam"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subject" className="text-xs font-semibold text-gray-700">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => onSubjectChange?.(e.target.value)}
            placeholder="e.g. Mathematics"
            className="text-sm"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs font-semibold text-gray-700">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange?.(e.target.value)}
          placeholder="Exam instructions or details..."
          className="text-sm resize-none"
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status" className="text-xs font-semibold text-gray-700">Status</Label>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
