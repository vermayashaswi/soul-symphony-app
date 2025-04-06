
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
  const { user, ensureProfileExists } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  // Get journal entries using the hook
  const { entries, loading, fetchEntries } = useJournalEntries(
    user?.id,
    refreshKey,
    isProfileChecked
  );

  useEffect(() => {
    if (user?.id) {
      checkUserProfile(user.id);
    } else {
      setIsCheckingProfile(false);
    }
  }, [user?.id]);

  const checkUserProfile = async (userId: string) => {
    try {
      setIsCheckingProfile(true);
      const event = new CustomEvent('journalOperationStart', {
        detail: {
          type: 'loading',
          message: 'Checking user profile'
        }
      });
      window.dispatchEvent(event);
      
      console.log('Checking user profile for ID:', userId);
      
      // Ensure profile exists
      const profileCreated = await ensureProfileExists();
      if (!profileCreated) {
        console.log('Profile check failed, retrying...');
        // Retry once more if the first attempt failed
        await new Promise(resolve => setTimeout(resolve, 500));
        await ensureProfileExists();
      }
      
      // Still check the profile to get the onboarding status
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, onboarding_completed')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error checking profile:', error);
        toast.error('Error loading your profile. Please refresh the page.');
        throw error;
      }
      
      console.log('Profile exists:', profile.id);
      setIsFirstTimeUser(!profile.onboarding_completed);
      setIsProfileChecked(true);
      
      window.dispatchEvent(new CustomEvent('journalOperationUpdate', {
        detail: {
          id: (event as any).detail?.id,
          status: 'success'
        }
      }));
    } catch (error: any) {
      console.error('Error checking/creating user profile:', error);
      toast.error('Error setting up profile. Please refresh and try again.');
    } finally {
      setIsCheckingProfile(false);
    }
  };

  // Handle starting a new recording
  const handleStartRecording = () => {
    console.log('Starting new recording');
  };

  // Handle when a recording is completed
  const handleRecordingComplete = async (audioBlob: Blob) => {
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

  // If we're checking the profile, show a loading state
  if (isCheckingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="ml-4 text-muted-foreground">Setting up your profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
      <JournalHeader isFirstTime={isFirstTimeUser} />
      
      {/* Voice recorder component */}
      <div className="mb-8">
        <VoiceRecorder 
          onRecordingComplete={handleRecordingComplete}
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
