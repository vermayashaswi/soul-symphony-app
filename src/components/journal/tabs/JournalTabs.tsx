
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranslatableText } from '@/components/translation/TranslatableText';
import VoiceRecorder from '@/components/VoiceRecorder';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import ErrorBoundary from '@/components/journal/ErrorBoundary';
import { JournalEntry } from '@/types/journal';

interface JournalTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  onRecordingComplete: (audioBlob: Blob) => void;
  updateDebugInfo: (info: {status: string, duration?: number}) => void;
  entries: JournalEntry[];
  loading: boolean;
  processingEntries: string[];
  processedEntryIds: number[];
  onStartRecording: () => void;
  onDeleteEntry: (id: number) => Promise<void>;
  entriesListRef: React.RefObject<HTMLDivElement>;
}

export function JournalTabs({
  activeTab,
  onTabChange,
  onRecordingComplete,
  updateDebugInfo,
  entries,
  loading,
  processingEntries,
  processedEntryIds,
  onStartRecording,
  onDeleteEntry,
  entriesListRef
}: JournalTabsProps) {
  // Transform JournalEntry objects from types/journal to match the format expected by JournalEntryCard
  const transformedEntries = entries.map(entry => ({
    id: entry.id || 0,
    content: entry["refined text"] || entry["transcription text"] || "",
    created_at: entry.created_at || new Date().toISOString(),
    audio_url: entry.audio_url || undefined,
    sentiment: entry.sentiment || null,
    themes: entry.master_themes || [],
    master_themes: entry.master_themes || [],
    entities: entry.entities || [],
    Edit_Status: entry.Edit_Status || null,
    user_feedback: entry.user_feedback || null
  }));

  return (
    <Tabs 
      defaultValue={activeTab} 
      value={activeTab} 
      onValueChange={onTabChange} 
      className="mt-6"
    >
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="record">
          <TranslatableText text="Record Entry" />
        </TabsTrigger>
        <TabsTrigger value="entries">
          <TranslatableText text="Past Entries" />
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="record" className="mt-0">
        <div className="mb-4">
          <VoiceRecorder 
            onRecordingComplete={onRecordingComplete}
            updateDebugInfo={updateDebugInfo}
          />
        </div>
      </TabsContent>
      
      <TabsContent value="entries" className="mt-0" ref={entriesListRef}>
        <ErrorBoundary>
          <JournalEntriesList
            entries={transformedEntries}
            loading={loading}
            processingEntries={processingEntries}
            processedEntryIds={processedEntryIds}
            onStartRecording={onStartRecording}
            onDeleteEntry={onDeleteEntry}
          />
        </ErrorBoundary>
      </TabsContent>
    </Tabs>
  );
}
