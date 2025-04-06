import React, { useState, useEffect } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { processRecording } from '@/utils/audio-processing';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import VoiceRecorder from '@/components/VoiceRecorder';
import JournalHeader from '@/components/journal/JournalHeader';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Journal = () => {
  const { user, ensureProfileExists } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState('record');
  const [profileCheckRetryCount, setProfileCheckRetryCount] = useState(0);
  const [lastProfileErrorTime, setLastProfileErrorTime] = useState(0);
  const [showRetryButton, setShowRetryButton] = useState(false);
  
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
      setShowRetryButton(false);
      
      console.log('[Journal] Checking user profile for ID:', userId);
      
      let profileCreated = await ensureProfileExists();
      
      if (!profileCreated && profileCheckRetryCount < 5) {
        console.log('[Journal] Profile check failed, retrying...', profileCheckRetryCount + 1);
        
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
        
        const now = Date.now();
        if (now - lastProfileErrorTime > 60000) {
          toast.error('Having trouble setting up your profile. You can try again or continue using the app.');
          setLastProfileErrorTime(now);
        }
        
        setShowRetryButton(true);
        
        setIsProfileChecked(true);
      }
    } catch (error: any) {
      console.error('[Journal] Error checking/creating user profile:', error);
      
      const now = Date.now();
      if (now - lastProfileErrorTime > 60000) {
        toast.error('Having trouble with your profile. You can try again or continue using the app.');
        setLastProfileErrorTime(now);
      }
      
      setShowRetryButton(true);
      
      setIsProfileChecked(true);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handleRetryProfileCreation = () => {
    if (!user?.id) return;
    
    setProfileCheckRetryCount(0);
    setIsProfileChecked(false);
    checkUserProfile(user.id);
  };

  const handleStartRecording = () => {
    console.log('Starting new recording');
    setActiveTab('record');
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!audioBlob || !user?.id) return;
    
    try {
      const toastId = toast.loading('Processing your journal entry...');
      
      const { success, tempId } = await processRecording(audioBlob, user.id);
      
      if (success && tempId) {
        setProcessingEntries(prev => [...prev, tempId]);
        
        setTimeout(() => {
          setRefreshKey(prev => prev + 1);
          
          setProcessingEntries(prev => prev.filter(id => id !== tempId));
          
          toast.success('Journal entry saved!', { id: toastId });
          
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

  const handleDeleteEntry = async (entryId: number) => {
    if (!user?.id) return;
    
    try {
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  if (isCheckingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
      <JournalHeader />
      
      {showRetryButton && (
        <div className="mb-6 p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200">
                We're having trouble setting up your profile. Your entries may not be saved correctly.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full sm:w-auto border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
              onClick={handleRetryProfileCreation}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> 
              Retry Profile Setup
            </Button>
          </div>
        </div>
      )}
      
      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="record">Record Entry</TabsTrigger>
          <TabsTrigger value="entries">Past Entries</TabsTrigger>
        </TabsList>
        
        <TabsContent value="record" className="mt-0">
          <div className="mb-4">
            <VoiceRecorder 
              onRecordingComplete={handleRecordingComplete}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="entries" className="mt-0">
          <JournalEntriesList
            entries={entries}
            loading={loading}
            processingEntries={processingEntries}
            onStartRecording={handleStartRecording}
            onDeleteEntry={handleDeleteEntry}
          />
          
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
    </div>
  );
};

export default Journal;
