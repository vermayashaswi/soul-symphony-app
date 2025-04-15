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
    meetsRequirements: boolean;
  } | null>(null);
  const { addEvent, isEnabled, toggleEnabled } = useDebugLog();
  
  useEffect(() => {
    if (audioDuration && audioDuration > 0.1) {
      console.log('[RecordingDebugger] Setting actual audio duration:', audioDuration);
      setActualAudioDuration(audioDuration);
    }
  }, [audioDuration]);
  
  useEffect(() => {
    if (audioBlob) {
      const blobDuration = (audioBlob as any).duration || null;
      
      const details = {
        size: audioBlob.size,
        type: audioBlob.type || 'unknown',
        blobDuration: blobDuration,
        isValid: audioBlob.size > 100,
        isEmpty: audioBlob.size <= 100,
        meetsRequirements: audioBlob.size > 100 && (blobDuration !== null && blobDuration > 0.1)
      };
      setBlobDetails(details);
      console.log('[RecordingDebugger] Blob details:', details);
    } else {
      setBlobDetails(null);
    }
  }, [audioBlob]);
  
  useEffect(() => {
    if (!currentStatus) return;
    
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
      
      const blobDuration = audioBlob ? (audioBlob as any).duration : null;
      const durationToUse = blobDuration && blobDuration > 0.1 ? blobDuration : 
                           (actualAudioDuration || audioDuration || 
                           (recordingStepIndex >= 0 ? 
                            (now - updatedSteps[recordingStepIndex].timestamp) / 1000 : 0));
      
      console.log('[RecordingDebugger] Using duration:', durationToUse, 
                 'blob duration:', blobDuration,
                 'actual:', actualAudioDuration, 
                 'prop:', audioDuration, 
                 'calculated:', recordingStepIndex >= 0 ? 
                               (now - updatedSteps[recordingStepIndex].timestamp) / 1000 : 0);
      
      const hasValidBlob = audioBlob && audioBlob.size > 100;
      const hasValidDuration = durationToUse > 0.1;
      const meetsRequirements = hasValidBlob && hasValidDuration;
      
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
      
      updatedSteps.push(
        {
          step: 'Duration Detection',
          status: hasValidDuration ? 'completed' : 'error',
          timestamp: now + 50,
          details: `Detected duration: ${formatTime(durationToUse)}s${!hasValidDuration ? ' (ERROR: Too short)' : ''}`,
          duration: 50
        }
      );
      
      if (hasValidBlob && hasValidDuration) {
        updatedSteps.push(
          {
            step: 'Playback Ready',
            status: 'completed',
            timestamp: now + 150,
            details: `Audio can be played (${formatBytes(audioBlob.size)}, ${formatTime(durationToUse)}s)`,
            duration: 200
          },
          {
            step: 'Ready for Save',
            status: 'completed',
            timestamp: now + 300,
            details: 'All requirements met: size > 100 bytes, duration > 0.1s'
          }
        );
      } else {
        updatedSteps.push(
          {
            step: 'Error',
            status: 'error',
            timestamp: now + 100,
            details: !hasValidBlob 
              ? `Invalid audio blob: Size too small (${audioBlob?.size || 0} bytes)` 
              : `Invalid duration: Too short (${durationToUse}s)`
          }
        );
      }
      
      setSteps(updatedSteps);
      addEvent('recording', 'Recording completed', 'success', { 
        duration: durationToUse,
        blobSize: audioBlob?.size || 0,
        blobType: audioBlob?.type || 'unknown',
        blobDuration: blobDuration,
        isValid: hasValidBlob && hasValidDuration
      });
    }
    
    setPrevStatus(currentStatus);
  }, [currentStatus, audioDuration, audioBlob, addEvent, steps, prevStatus, actualAudioDuration, blobDetails]);
  
  const handleDebugButtonClick = () => {
    if (!isEnabled) {
      toggleEnabled();
    }
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
                    <span className={blobDetails.size < 100 ? 'text-red-500 font-medium' : 'text-green-500 font-medium'}>
                      {formatBytes(blobDetails.size)}
                      {blobDetails.size < 100 ? ' ❌' : ' ✅'}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Type:</span> 
                    <span>{blobDetails.type}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Blob Duration:</span> 
                    <span className={
                      blobDetails.blobDuration === null ? 'text-red-500 font-medium' : 
                      (blobDetails.blobDuration !== null && blobDetails.blobDuration < 0.1) ? 'text-red-500 font-medium' : 
                      'text-green-500 font-medium'
                    }>
                      {blobDetails.blobDuration !== null 
                        ? `${blobDetails.blobDuration.toFixed(2)}s${blobDetails.blobDuration < 0.1 ? ' ❌' : ' ✅'}` 
                        : 'Not set ❌'}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Valid for Processing:</span> 
                    <span className={!blobDetails.meetsRequirements ? 'text-red-500 font-medium' : 'text-green-500 font-medium'}>
                      {blobDetails.meetsRequirements ? 'Yes ✅' : 'No ❌'}
                    </span>
                  </li>
                </ul>
                
                {!blobDetails.meetsRequirements && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <h5 className="text-xs font-medium mb-1 text-red-800 dark:text-red-300">Requirements to Save:</h5>
                    <ul className="text-xs space-y-1 text-red-700 dark:text-red-300">
                      <li className="flex justify-between">
                        <span>Size &gt; 100 bytes:</span>
                        <span>{blobDetails.size > 100 ? '✅ Met' : '❌ Not met'}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Duration &gt; 0.1s:</span>
                        <span>
                          {blobDetails.blobDuration !== null && blobDetails.blobDuration > 0.1 
                            ? '✅ Met' 
                            : '❌ Not met'}
                        </span>
                      </li>
                    </ul>
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
                <span>Blob Duration:</span>
                <span className="font-medium">
                  {blobDetails?.blobDuration !== null 
                    ? `${blobDetails.blobDuration.toFixed(2)}s` 
                    : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Save Requirements:</span>
                <span className="font-medium">
                  {blobDetails 
                    ? (blobDetails.meetsRequirements 
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
