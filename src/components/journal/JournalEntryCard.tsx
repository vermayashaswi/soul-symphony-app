import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { formatShortDate } from '@/utils/format-time';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FloatingDotsToggle, 
  ThemeLoader, 
  DeleteEntryDialog,
  EntryContent
} from './entry-card';
import { EditEntryButton } from './entry-card/EditEntryButton';
import ErrorBoundary from './ErrorBoundary';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { JournalEntry as JournalEntryType, Json } from '@/types/journal';

export interface JournalEntry {
  id: number;
  content: string;
  created_at: string;
  audio_url?: string;
  sentiment?: string | number | null;
  themes?: string[] | null;
  master_themes?: string[];
  entities?: Array<{
    type: string;
    name: string;
    text?: string;
  }>;
  foreignKey?: string;
  predictedLanguages?: {
    [key: string]: number;
  } | null;
  Edit_Status?: number | null;
  user_feedback?: string | null;
  emotions?: Record<string, number>;
  duration?: number;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
  isNew?: boolean;
  isProcessing?: boolean;
  setEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
}

export function JournalEntryCard({ 
  entry, 
  onDelete, 
  isNew = false, 
  isProcessing = false,
  setEntries
}: JournalEntryCardProps) {
  const safeEntry = {
    id: entry?.id || 0,
    content: entry?.content || "Processing entry...",
    created_at: entry?.created_at || new Date().toISOString(),
    sentiment: entry?.sentiment || null,
    master_themes: Array.isArray(entry?.master_themes) ? entry.master_themes : [],
    themes: Array.isArray(entry?.themes) ? entry.themes : [],
    Edit_Status: entry?.Edit_Status || null,
    user_feedback: entry?.user_feedback || null,
    emotions: entry?.emotions || null,
    duration: entry?.duration || null
  };

  // ... rest of the code remains unchanged
}
