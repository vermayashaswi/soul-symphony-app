
import React, { useState, useEffect } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { processRecording } from '@/utils/audio-processing';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import VoiceRecorder from '@/components/VoiceRecorder';
import JournalHeader from '@/components/journal/JournalHeader';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import JournalProfileDebug from '@/components/journal/JournalProfileDebug';

const Journal = () => {
  const { user, ensureProfileExists } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState('record');
  const [profileCheckRetryCount, setProfileCheckRetryCount] = useState(0);
  // Track when the last profile error message was shown to avoid spamming
  const [lastProfileErrorTime, setLastProfileErrorTime] = useState(0);
  
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
      
      console.log('[Journal] Checking user profile for ID:', userId);
      
      // Ensure profile exists with retry mechanism
      let profileCreated = await ensureProfileExists();
      
      // If profile creation failed and we haven't retried too many times
      if (!profileCreated && profileCheckRetryCount < 5) {
        console.log('[Journal] Profile check failed, retrying...', profileCheckRetryCount + 1);
        
        // Wait a bit longer each time (exponential backoff)
        const delay = 1000 * Math.pow(1.5, profileCheckRetryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        profileCreated = await ensureProfileExists();
        
        setProfileCheckRetryCount(prevCount => prevCount + 1);
      }
      
      if (profileCreated) {
        console.log('[Journal] Profile created or verified successfully');
        setIsProfileChecked(true);
      } else if (profileCheckRetryCount >= 5) {
        console.error('[Journal] Failed to create profile after multiple retries');
        
        // Only show error toast occasionally (max once per minute)
        const now = Date.now();
        if (now - lastProfileErrorTime > 60000) {
          toast.error('Having trouble setting up your profile. You can still use the app.');
          setLastProfileErrorTime(now);
        }
        
        // Allow usage even if profile creation failed
        setIsProfileChecked(true);
      }
    } catch (error: any) {
      console.error('[Journal] Error checking/creating user profile:', error);
      
      // Only show error toast occasionally (max once per minute)
      const now = Date.now();
      if (now - lastProfileErrorTime > 60000) {
        toast.error('Having trouble with your profile, but you can continue using the app');
        setLastProfileErrorTime(now);
      }
      
      // Allow usage even with errors
      setIsProfileChecked(true);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  // Handle starting a new recording
  const handleStartRecording = () => {
    console.log('Starting new recording');
    setActiveTab('record');
  };

  // Handle when a recording is completed
  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!audioBlob || !user?.id) return;
    
    try {
      // Show only one toast for the entire process
      const toastId = toast.loading('Processing your journal entry...');
      
      // Process the recording and get a temporary ID
      const { success, tempId } = await processRecording(audioBlob, user.id);
      
      if (success && tempId) {
        // Add the tempId to processing entries state
        setProcessingEntries(prev => [...prev, tempId]);
        
        // Refresh the entries list after a delay to allow processing
        setTimeout(() => {
          setRefreshKey(prev => prev + 1);
          
          // Remove the tempId from processing entries
          setProcessingEntries(prev => prev.filter(id => id !== tempId));
          
          // Update the toast once processing is complete
          toast.success('Journal entry saved!', { id: toastId });
          
          // Switch to the entries tab after recording is processed
          setActiveTab('entries');
        }, 1500);
      } else {
        toast.error('Failed to process recording', { id: toastId });
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      toast.error('Error processing your recording');
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
      <JournalHeader />
      
      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="record">Record Entry</TabsTrigger>
          <TabsTrigger value="entries">Past Entries</TabsTrigger>
        </TabsList>
        
        <TabsContent value="record" className="mt-0">
          {/* Voice recorder component */}
          <div className="mb-4">
            <VoiceRecorder 
              onRecordingComplete={handleRecordingComplete}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="entries" className="mt-0">
          {/* Journal entries list */}
          <JournalEntriesList
            entries={entries}
            loading={loading}
            processingEntries={processingEntries}
            onStartRecording={handleStartRecording}
            onDeleteEntry={handleDeleteEntry}
          />
          
          {/* Show processing indicator when entries are being processed */}
          {processingEntries.length > 0 && (
            <div className="mt-4 p-3 bg-primary-foreground/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing entry...</span>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Add the Profile Debug Component */}
      <JournalProfileDebug />
    </div>
  );
};

export default Journal;
