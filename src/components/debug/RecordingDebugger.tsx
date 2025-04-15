
import React, { useState, useEffect } from 'react';
import { Bug, ChevronDown, ChevronUp, X } from 'lucide-react';
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
  const { addEvent, isEnabled } = useDebugLog();
  
  // Update steps when current status changes
  useEffect(() => {
    if (!currentStatus) return;
    
    const now = Date.now();
    
    if (currentStatus === 'Recording') {
      // Reset steps when starting a new recording
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
    else if (currentStatus === 'Recorded' && steps.length > 0) {
      // Update recording step to completed and add next steps
      const updatedSteps = [...steps];
      
      // Find the "Recording Started" step and update it
      const recordingStepIndex = updatedSteps.findIndex(s => s.step === 'Recording Started');
      if (recordingStepIndex >= 0) {
        updatedSteps[recordingStepIndex] = {
          ...updatedSteps[recordingStepIndex],
          status: 'completed',
          duration: now - updatedSteps[recordingStepIndex].timestamp
        };
      }
      
      // Add audio processing steps
      updatedSteps.push(
        {
          step: 'Audio Processing',
          status: 'completed',
          timestamp: now,
          details: `Created audio blob: ${audioBlob ? formatBytes(audioBlob.size) : 'N/A'}, type: ${audioBlob?.type || 'N/A'}`,
          duration: 100 // Estimated
        },
        {
          step: 'Playback Ready',
          status: 'completed',
          timestamp: now + 100,
          details: `Audio duration: ${formatTime(audioDuration || 0)}`,
          duration: 200 // Estimated
        },
        {
          step: 'Waiting for Save',
          status: 'in-progress',
          timestamp: now + 300,
          details: 'Ready to process and save recording'
        }
      );
      
      setSteps(updatedSteps);
      addEvent('recording', 'Recording completed', 'success', { 
        duration: audioDuration || 0,
        blobSize: audioBlob?.size || 0,
        blobType: audioBlob?.type || 'unknown'
      });
    }
  }, [currentStatus, audioDuration, audioBlob, addEvent]);
  
  // If debug mode is disabled, don't render
  if (!isEnabled) return null;
  
  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end">
      <Button
        size="sm"
        variant="outline"
        className="flex items-center gap-2 mb-2 bg-white dark:bg-gray-800 shadow-md"
        onClick={() => setIsOpen(!isOpen)}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to format time
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
