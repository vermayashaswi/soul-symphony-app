
import React, { useState, useEffect } from 'react';
import { Bug, ChevronDown, ChevronUp, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDuration } from '@/utils/debug/debugUtils';

export interface RecordingDebugStep {
  step: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  timestamp: number;
  details?: string;
  duration?: number;
}

interface RecordingDebuggerProps {
  currentStatus?: string;
  audioDuration?: number;
  audioBlob?: Blob | null;
}

export const RecordingDebugger: React.FC<RecordingDebuggerProps> = ({
  currentStatus,
  audioDuration,
  audioBlob
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<RecordingDebugStep[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [prevStatus, setPrevStatus] = useState<string | undefined>(undefined);
  const [actualAudioDuration, setActualAudioDuration] = useState<number | undefined>(undefined);
  const [blobDetails, setBlobDetails] = useState<{
    size: number;
    type: string;
    blobDuration: number | null;
    isValid: boolean;
    isEmpty: boolean;
  } | null>(null);
  const { addEvent, isEnabled, toggleEnabled } = useDebugLog();
  
  // Update actual audio duration when audioDuration changes and is valid
  useEffect(() => {
    if (audioDuration && audioDuration > 0.1) {
      console.log('[RecordingDebugger] Setting actual audio duration:', audioDuration);
      setActualAudioDuration(audioDuration);
    }
  }, [audioDuration]);
  
  // Update blob details when audioBlob changes
  useEffect(() => {
    if (audioBlob) {
      const details = {
        size: audioBlob.size,
        type: audioBlob.type || 'unknown',
        blobDuration: (audioBlob as any).duration || null,
        isValid: audioBlob.size > 100,
        isEmpty: audioBlob.size <= 100
      };
      setBlobDetails(details);
      console.log('[RecordingDebugger] Blob details:', details);
    } else {
      setBlobDetails(null);
    }
  }, [audioBlob]);
  
  useEffect(() => {
    if (!currentStatus) return;
    
    // Only process if status actually changed
    if (currentStatus === prevStatus) return;
    
    const now = Date.now();
    console.log('[RecordingDebugger] Status changed:', prevStatus, '->', currentStatus, 
                'audioDuration:', audioDuration, 
                'actualAudioDuration:', actualAudioDuration,
                'blob:', blobDetails);
    
    if (currentStatus === 'Recording') {
      setSteps([
        {
          step: 'Microphone Access',
          status: 'completed',
          timestamp: now,
          details: 'Microphone permission granted'
        },
        {
          step: 'Recording Started',
          status: 'in-progress',
          timestamp: now,
          details: `Recording audio using browser MediaRecorder API`
        }
      ]);
      setStartTime(now);
      
      addEvent('recording', 'Recording started', 'info', { timestamp: now });
    } 
    else if (currentStatus === 'Recorded' || (audioBlob && prevStatus === 'Recording')) {
      const updatedSteps = [...steps];
      
      const recordingStepIndex = updatedSteps.findIndex(s => s.step === 'Recording Started');
      if (recordingStepIndex >= 0) {
        const recordingDuration = now - updatedSteps[recordingStepIndex].timestamp;
        updatedSteps[recordingStepIndex] = {
          ...updatedSteps[recordingStepIndex],
          status: 'completed',
          duration: recordingDuration
        };
      }
      
      // Calculate the most reliable duration to use
      const durationToUse = actualAudioDuration || audioDuration || 
                           (recordingStepIndex >= 0 ? 
                            (now - updatedSteps[recordingStepIndex].timestamp) / 1000 : 0);
      
      console.log('[RecordingDebugger] Using duration:', durationToUse, 
                 'actual:', actualAudioDuration, 
                 'prop:', audioDuration, 
                 'calculated:', recordingStepIndex >= 0 ? 
                               (now - updatedSteps[recordingStepIndex].timestamp) / 1000 : 0);
      
      const hasValidBlob = audioBlob && audioBlob.size > 100;
      
      updatedSteps.push(
        {
          step: 'Audio Processing',
          status: hasValidBlob ? 'completed' : 'error',
          timestamp: now,
          details: audioBlob 
            ? `Created audio blob: ${formatBytes(audioBlob.size)}, type: ${audioBlob.type || 'N/A'}, valid: ${hasValidBlob}`
            : 'No audio blob created',
          duration: 100
        }
      );
      
      if (hasValidBlob) {
        updatedSteps.push(
          {
            step: 'Playback Ready',
            status: durationToUse > 0.1 ? 'completed' : 'error',
            timestamp: now + 100,
            details: `Audio duration: ${formatTime(durationToUse)}${durationToUse < 0.1 ? ' (ERROR: Too short)' : ''}`,
            duration: 200
          },
          {
            step: 'Ready for Save',
            status: 'in-progress',
            timestamp: now + 300,
            details: 'Audio can be saved when duration > 0.1s and blob size > 100 bytes'
          }
        );
      } else {
        updatedSteps.push(
          {
            step: 'Error',
            status: 'error',
            timestamp: now + 100,
            details: `Invalid audio recording: ${audioBlob ? 'Size too small' : 'No audio data'}`
          }
        );
      }
      
      setSteps(updatedSteps);
      addEvent('recording', 'Recording completed', 'success', { 
        duration: durationToUse,
        blobSize: audioBlob?.size || 0,
        blobType: audioBlob?.type || 'unknown',
        isValid: hasValidBlob
      });
    }
    
    // Save the current status as previous for the next update
    setPrevStatus(currentStatus);
  }, [currentStatus, audioDuration, audioBlob, addEvent, steps, prevStatus, actualAudioDuration, blobDetails]);
  
  const handleDebugButtonClick = () => {
    if (!isEnabled) {
      // Enable debug mode when clicked
      toggleEnabled();
    }
    // Toggle panel state regardless of debug mode
    setIsOpen(!isOpen);
  };
  
  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end">
      <Button
        size="sm"
        variant={isEnabled ? "outline" : "secondary"}
        className="flex items-center gap-2 mb-2 bg-white dark:bg-gray-800 shadow-md"
        onClick={handleDebugButtonClick}
      >
        <Bug className="h-4 w-4" />
        <span>Debug Recording</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </Button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border shadow-lg p-4 max-w-sm w-full"
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Recording Process</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {!isEnabled && (
              <div className="mb-4 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Debug mode is currently disabled. Debug information will be limited.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleEnabled}
                  className="w-full mt-2 text-xs h-7 border-amber-300"
                >
                  Enable Debug Mode
                </Button>
              </div>
            )}
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {steps.map((step, index) => (
                <div key={index} className="border-l-2 pl-3 py-1 relative">
                  <div 
                    className={`absolute left-[-5px] top-2 w-2 h-2 rounded-full ${
                      step.status === 'completed' ? 'bg-green-500' :
                      step.status === 'in-progress' ? 'bg-blue-500 animate-pulse' :
                      step.status === 'error' ? 'bg-red-500' : 'bg-gray-300'
                    }`}
                  />
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm">{step.step}</p>
                    {step.duration && (
                      <span className="text-xs text-gray-500">{formatDuration(step.duration)}</span>
                    )}
                  </div>
                  {step.details && (
                    <p className="text-xs text-gray-500 mt-1">{step.details}</p>
                  )}
                </div>
              ))}
              
              {currentStatus === 'No Recording' && (
                <div className="text-center text-sm text-gray-500 py-2">
                  No recording in progress. Press the record button to start.
                </div>
              )}
            </div>
            
            {blobDetails && (
              <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-md">
                <h4 className="text-xs font-medium mb-1">Audio Blob Details:</h4>
                <ul className="text-xs space-y-1 text-gray-500">
                  <li className="flex justify-between">
                    <span>Size:</span> 
                    <span className={blobDetails.size < 100 ? 'text-red-500 font-medium' : ''}>{formatBytes(blobDetails.size)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Type:</span> 
                    <span>{blobDetails.type}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Blob Duration:</span> 
                    <span>{blobDetails.blobDuration !== null ? `${blobDetails.blobDuration.toFixed(2)}s` : 'Not set'}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Valid for Processing:</span> 
                    <span className={!blobDetails.isValid ? 'text-red-500 font-medium' : 'text-green-500'}>{blobDetails.isValid ? 'Yes' : 'No'}</span>
                  </li>
                </ul>
                {!blobDetails.isValid && (
                  <div className="mt-1 text-xs flex items-center gap-1 text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    <span>{blobDetails.isEmpty ? 'Audio blob too small or empty' : 'Audio blob invalid'}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-3 text-xs text-gray-500 border-t pt-2">
              {currentStatus && (
                <div className="flex justify-between">
                  <span>Current Status:</span>
                  <span className="font-medium">{currentStatus}</span>
                </div>
              )}
              <div className="flex justify-between mt-1">
                <span>Elapsed:</span>
                <span className="font-medium">{formatDuration(Date.now() - startTime)}</span>
              </div>
              {actualAudioDuration && (
                <div className="flex justify-between mt-1">
                  <span>Audio Duration:</span>
                  <span className={`font-medium ${actualAudioDuration < 0.1 ? 'text-red-500' : ''}`}>
                    {formatTime(actualAudioDuration)}
                    {actualAudioDuration < 0.1 && ' (Too short)'}
                  </span>
                </div>
              )}
              <div className="flex justify-between mt-1">
                <span>Save Requirements:</span>
                <span className="font-medium">
                  {audioBlob && actualAudioDuration 
                    ? (audioBlob.size > 100 && actualAudioDuration > 0.1 
                        ? '✅ All met' 
                        : '❌ Not met') 
                    : 'N/A'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
