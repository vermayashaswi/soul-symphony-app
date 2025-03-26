import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { JournalHeader } from '@/components/journal/JournalHeader';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useJournalHandler } from '@/hooks/use-journal-handler';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mic, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

export default function Journal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { 
    entries: journalEntries, 
    loading: isLoading, 
    refreshEntries, 
    loadError 
  } = useJournalEntries(user?.id);
  const { 
    handleCreateJournal, 
    handleViewInsights,
    processUnprocessedEntries,
    isProcessing
  } = useJournalHandler(user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [directEntryId, setDirectEntryId] = useState<number | null>(null);
  const [mode, setMode] = useState<'record' | 'past'>('past');
  const [refreshCount, setRefreshCount] = useState(0);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasTriedProfileCreation, setHasTriedProfileCreation] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tempId = queryParams.get('processing');
    const entryId = queryParams.get('entry');
    
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    
    if (tempId && !processingEntries.includes(tempId)) {
      console.log('Adding processing entry from URL:', tempId);
      setProcessingEntries(prev => [...prev, tempId]);
      
      const processingTimeout = setTimeout(() => {
        console.log('Processing entry timeout reached, refreshing');
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        refreshEntries(false);
      }, 30000);
      
      const refreshInterval = setInterval(() => {
        console.log("Auto-refreshing to check for processed entry");
        refreshEntries(false);
      }, 5000);
      
      return () => {
        clearTimeout(processingTimeout);
        clearInterval(refreshInterval);
      };
    }
    
    if (entryId) {
      const entryIdNumber = parseInt(entryId, 10);
      if (!isNaN(entryIdNumber)) {
        console.log('Setting direct entry view for ID:', entryIdNumber);
        setDirectEntryId(entryIdNumber);
        if (!isRefreshing && !isLoading) {
          refreshEntries(false);
        }
      }
    }
  }, [location.search, processingEntries, refreshEntries, isRefreshing, isLoading]);

  useEffect(() => {
    if (user && !hasTriedProfileCreation) {
      const checkAndCreateProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (!data || error) {
            console.log('Profile not found or error:', error);
            
            const { error: createError } = await supabase
              .from('profiles')
              .insert([{ id: user.id }]);
            
            if (createError) {
              console.error('Failed to create profile:', createError);
              toast.error('Unable to set up your profile. Some features might not work properly.');
            } else {
              console.log('Profile created successfully');
              setTimeout(() => refreshEntries(false), 1000);
            }
          }
        } catch (err) {
          console.error('Error in profile check/creation:', err);
        } finally {
          setHasTriedProfileCreation(true);
        }
      };
      
      checkAndCreateProfile();
    }
  }, [user, hasTriedProfileCreation, refreshEntries]);

  useEffect(() => {
    if (processingEntries.length > 0 && !isRefreshing && !isLoading) {
      console.log('Setting up refresh interval for processing entries');
      const interval = setInterval(() => {
        console.log('Auto refreshing for processing entries');
        refreshEntries(false);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [processingEntries, isRefreshing, isLoading, refreshEntries]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Force completing loading state due to timeout');
        setIsRefreshing(false);
        
        if (processingEntries.length > 0) {
          console.log('Clearing stuck processing entries');
          setProcessingEntries([]);
        }
        
        setRefreshCount(prev => prev + 1);
      }
    }, 15000);
    
    setLoadTimeout(timeout);
    
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    };
  }, [isLoading, processingEntries.length]);

  useEffect(() => {
    if (!isLoading && journalEntries && journalEntries.length > 0 && processingEntries.length > 0) {
      console.log('Checking if processing entries are now available in journal entries');
      setProcessingEntries([]);
    }
  }, [isLoading, journalEntries, processingEntries.length]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      if (user?.id) {
        const processingResult = await processUnprocessedEntries();
        
        if (processingResult.alreadyProcessing) {
          setIsRefreshing(false);
          return;
        }
      }
      
      await refreshEntries(true);
      setProcessingEntries([]);
      
    } catch (error) {
      console.error('Error refreshing entries:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleMode = (value: string) => {
    if (value === 'record') {
      navigate('/record');
    } else {
      setMode('past');
    }
  };

  return (
    <div className="container px-4 md:px-6 max-w-6xl space-y-6 py-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">Journal</CardTitle>
          <div className="mt-2 flex justify-between items-center">
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
            
            <div className="flex gap-2">
              <Button
                onClick={handleViewInsights}
                variant="outline"
                size="sm"
              >
                View Insights
              </Button>
              
              <Button onClick={() => navigate('/record')}>
                New Journal Entry
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <JournalHeader
        onCreateJournal={handleCreateJournal}
        onViewInsights={handleViewInsights}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      
      {loadError && !isLoading && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Failed to load journal entries. 
            <Button 
              variant="link" 
              className="p-0 h-auto text-destructive-foreground underline ml-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              Click to retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {isLoading && (
        <div className="text-center py-6">
          <JournalEntriesList 
            entries={[]} 
            loading={true}
            processingEntries={processingEntries}
            onStartRecording={() => navigate('/record')}
          />
        </div>
      )}
      
      {!isLoading && (
        <JournalEntriesList 
          entries={journalEntries || []} 
          loading={false}
          processingEntries={processingEntries}
          onStartRecording={() => navigate('/record')}
        />
      )}
    </div>
  );
}
