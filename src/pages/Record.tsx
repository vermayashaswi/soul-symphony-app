
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VoiceRecorder from '@/components/VoiceRecorder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BookOpen, Mic } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Record() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<'record' | 'past'>('record');
  const [isNavigating, setIsNavigating] = useState(false);
  const [recordingCompleted, setRecordingCompleted] = useState(false);

  const handleRecordingComplete = async (audioBlob: Blob, tempId?: string) => {
    console.log('Recording completed, tempId:', tempId);
    
    if (isNavigating || recordingCompleted) {
      console.log('Already navigating or completed, ignoring duplicate completion event');
      return;
    }
    
    setIsNavigating(true);
    setRecordingCompleted(true);
    
    try {
      // Notify user
      toast.success('Journal entry saved successfully!');
      
      // Add a small delay to ensure processing has started
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to the journal page with the temp ID as a query param
      if (tempId) {
        console.log('Navigating to journal with processing ID:', tempId);
        navigate(`/journal?processing=${tempId}`, { replace: true });
      } else {
        console.log('Navigating to journal (no processing ID)');
        navigate('/journal', { replace: true });
      }
    } catch (error) {
      console.error('Navigation error:', error);
      setIsNavigating(false);
      toast.error('Error navigating after saving journal entry');
    }
  };

  // Reset state when component unmounts
  useEffect(() => {
    return () => {
      setIsNavigating(false);
      setRecordingCompleted(false);
    };
  }, []);

  const handleToggleMode = (value: string) => {
    if (value === 'past' && !isNavigating) {
      console.log('Switching to past entries view, navigating to journal');
      setIsNavigating(true);
      navigate('/journal');
    }
  };

  const handleCancel = () => {
    console.log('Recording cancelled, navigating to journal');
    if (!isNavigating) {
      setIsNavigating(true);
      navigate('/journal');
    }
  };

  return (
    <div className="container px-4 md:px-6 max-w-5xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Journal</CardTitle>
          <div className="mt-2">
            <ToggleGroup type="single" value={mode} onValueChange={(value) => handleToggleMode(value)} className="justify-start">
              <ToggleGroupItem value="record" className="gap-1">
                <Mic className="h-4 w-4" />
                <span>Record Entry</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="past" className="gap-1">
                <BookOpen className="h-4 w-4" />
                <span>Past Entries</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          <div className="py-4">
            <h3 className="text-lg font-medium mb-4">Record a New Journal Entry</h3>
            <VoiceRecorder 
              onRecordingComplete={handleRecordingComplete}
              onCancel={handleCancel}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
