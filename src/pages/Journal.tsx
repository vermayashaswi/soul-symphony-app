
import React, { useState, useEffect } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { processRecording } from '@/utils/audio-processing';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import VoiceRecorder from '@/components/VoiceRecorder';
import JournalHeader from '@/components/journal/JournalHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Journal = () => {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);

  // Get journal entries using the hook
  const { entries, loading, fetchEntries } = useJournalEntries(
    user?.id,
    refreshKey,
    isProfileChecked
  );

  useEffect(() => {
    if (user?.id) {
      checkUserProfile(user.id);
    }
  }, [user?.id]);

  // Let's modify just the checkUserProfile function in Journal.tsx
  const checkUserProfile = async (userId: string) => {
    try {
      const event = new CustomEvent('journalOperationStart', {
        detail: {
          type: 'loading',
          message: 'Checking user profile'
        }
      });
      const opId = window.dispatchEvent(event) ? (event as any).detail?.id : null;
      
      console.log('Checking user profile for ID:', userId);
      
      // Use the ensureProfileExists function from AuthContext instead
      const { ensureProfileExists } = useAuth();
      await ensureProfileExists();
      
      // Still check the profile to get the onboarding status
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, onboarding_completed')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error checking profile:', error);
        if (opId) {
          window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
            detail: {
              id: opId,
              status: 'error',
              details: `Profile error: ${error.message}`
            }
          }));
        }
        throw error;
      }
      
      console.log('Profile exists:', profile.id);
      setIsFirstTimeUser(!profile.onboarding_completed);
      setIsProfileChecked(true);
      
      if (opId) {
        window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
          detail: {
            id: opId,
            status: 'success'
          }
        }));
      }
    } catch (error: any) {
      console.error('Error checking/creating user profile:', error);
      toast.error('Error setting up profile. Please try again.');
    }
  };

  // Handle starting a new recording
  const handleStartRecording = () => {
    console.log('Starting new recording');
  };

  // Handle when a recording is completed
  const handleRecordingComplete = async (audioBlob: Blob | null) => {
    if (!audioBlob || !user?.id) return;
    
    try {
      // Process the recording and get a temporary ID
      const { success, tempId } = await processRecording(audioBlob, user.id);
      
      if (success && tempId) {
        // Add the tempId to processing entries state
        setProcessingEntries(prev => [...prev, tempId]);
        
        // Refresh the entries list after a delay to allow processing
        setTimeout(() => {
          setRefreshKey(prev => prev + 1);
          
          // Remove the tempId from processing entries after a longer delay
          setTimeout(() => {
            setProcessingEntries(prev => prev.filter(id => id !== tempId));
          }, 10000);
        }, 3000);
      }
    } catch (error) {
      console.error('Error processing recording:', error);
    }
  };

  // Handle deleting an entry
  const handleDeleteEntry = async (entryId: number) => {
    if (!user?.id) return;
    
    try {
      // After successful deletion, refresh the entries list
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
      <JournalHeader isFirstTime={isFirstTimeUser} />
      
      {/* Voice recorder component */}
      <div className="mb-8">
        <VoiceRecorder 
          onRecordingComplete={handleRecordingComplete} 
          shouldAnimateMic={true}
        />
      </div>
      
      {/* Journal entries list */}
      <JournalEntriesList
        entries={entries}
        loading={loading}
        processingEntries={processingEntries}
        onStartRecording={handleStartRecording}
        onDeleteEntry={handleDeleteEntry}
      />
    </div>
  );
};

export default Journal;
