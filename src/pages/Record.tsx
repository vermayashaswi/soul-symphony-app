
import React, { useState } from 'react';
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

  const handleRecordingComplete = (audioBlob: Blob, tempId?: string) => {
    console.log('Recording completed, tempId:', tempId);
    toast.success('Journal entry saved successfully!');
    
    // Navigate to the journal page with the temp ID as a query param
    // This will allow us to show a loading state for just this entry
    if (tempId) {
      navigate(`/journal?processing=${tempId}`, { replace: true });
    } else {
      navigate('/journal', { replace: true });
    }
  };

  const handleToggleMode = (value: string) => {
    if (value === 'past') {
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
              onCancel={() => navigate('/journal')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
