
import React, { useState, useEffect, memo } from 'react';
import { Card } from "@/components/ui/card";
import DeleteEntryDialog from './entry-card/DeleteEntryDialog';
import SentimentMeter from './entry-card/SentimentMeter'; 
import EntryContent from './entry-card/EntryContent';
import ExtractThemeButton from './entry-card/ExtractThemeButton';
import FloatingDotsToggle from './entry-card/FloatingDotsToggle';
import ThemeLoader from './entry-card/ThemeLoader';
import ThemeBoxes from './ThemeBoxes';
import { JournalEntry } from '@/types/journal';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete: (entryId: number) => Promise<void>;
  isProcessing?: boolean;
  wasProcessed?: boolean;
  isNew?: boolean;
  setEntries?: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = memo(({ 
  entry, 
  onDelete, 
  isProcessing = false, 
  wasProcessed = false,
  isNew = false,
  setEntries
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);
  const [themes, setThemes] = useState<string[] | undefined>(entry.themes);
  const [masterThemes, setMasterThemes] = useState<string[] | undefined>(entry.master_themes);

  useEffect(() => {
    setThemes(entry.themes);
    setMasterThemes(entry.master_themes);
  }, [entry.themes, entry.master_themes]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleThemes = async () => {
    if (!showThemes && !themes) {
      setIsLoadingThemes(true);
    }
    setShowThemes(!showThemes);
  };

  return (
    <Card className="w-full mb-4 overflow-hidden">
      <div className="px-4 pt-4 flex justify-between items-start">
        <EntryContent
          content={entry.content}
          timestamp={entry.created_at}
          isExpanded={isExpanded}
        />

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center justify-end space-x-2">
            <SentimentMeter sentiment={entry.sentiment} />
            <FloatingDotsToggle isExpanded={isExpanded} onToggle={toggleExpanded} />
            <DeleteEntryDialog entryId={entry.id} onDelete={() => onDelete(entry.id)} />
          </div>
        </div>
      </div>

      <div className="px-4 py-2">
        {isLoadingThemes && <ThemeLoader entryId={entry.id} initialThemes={themes || []} content={entry.content || ""} />}
        {showThemes && (
          <>
            {themes && themes.length > 0 && (
              <div className="mb-2">
                <ThemeBoxes themes={themes} className="mb-1" size="sm" />
              </div>
            )}
            {masterThemes && masterThemes.length > 0 && (
              <div>
                <ThemeBoxes themes={masterThemes} className="mb-1" size="md" />
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-4 pb-4">
        <ExtractThemeButton
          entryId={entry.id}
          onExtract={toggleThemes}
          showThemes={showThemes}
          themes={themes}
          masterThemes={masterThemes}
        />
      </div>
    </Card>
  );
});

export default JournalEntryCard;
