
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Play, Pause } from 'lucide-react';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { LoadingEntryContent } from './LoadingEntryContent';
import TranslatedContent from './TranslatedContent';

interface EntryContentProps {
  content: string;
  audioUrl?: string | null;
  isProcessing?: boolean;
  isProcessed?: boolean;
  language?: string;
  entryId?: number;
}

export function EntryContent({ content, audioUrl, isProcessing, isProcessed, language, entryId }: EntryContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { 
    isPlaying, 
    togglePlayback, 
    audioRef, 
    prepareAudio, 
    playbackProgress 
  } = useAudioPlayback({ audioUrl }); // Pass the audioUrl here
  
  // Check if audio is ready
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  
  // Load audio when component mounts or URL changes
  React.useEffect(() => {
    if (audioUrl) {
      fetch(audioUrl)
        .then(response => response.blob())
        .then(blob => {
          return prepareAudio()
            .then(() => setAudioLoaded(true))
            .catch(() => setAudioError(true));
        })
        .catch(() => setAudioError(true));
    }
  }, [audioUrl, prepareAudio]);
  
  // Toggle expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div>
      {isProcessing ? (
        <LoadingEntryContent />
      ) : (
        <div className="space-y-2">
          <div className={`overflow-hidden ${isExpanded ? '' : 'max-h-24'} transition-all duration-300`}>
            <TranslatedContent 
              content={content} 
              isExpanded={isExpanded} 
              language={language}
              entryId={entryId}
            />
          </div>

          <div className="flex items-center mt-1 gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs px-2 py-1 h-8"
              onClick={toggleExpanded}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" /> Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" /> Show More
                </>
              )}
            </Button>

            {audioUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-8"
                onClick={togglePlayback}
                disabled={!audioLoaded || audioError}
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" /> Pause Audio
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" /> Play Audio
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EntryContent;
