
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { JournalHeader } from '@/components/journal/JournalHeader';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import EmptyJournalState from '@/components/journal/EmptyJournalState';
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
  const [mode, setMode] = useState<'record' | 'past'>('past');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasTriedProfileCreation, setHasTriedProfileCreation] = useState(false);

  // Check profile exists and create if needed
  useEffect(() => {
    if (user && !hasTriedProfileCreation) {
      const checkAndCreateProfile = async () => {
        try {
          // Check if profile exists
          const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (!data || error) {
            console.log('Profile not found or error:', error);
            
            // Try to create profile
            const { error: createError } = await supabase
              .from('profiles')
              .insert([{ id: user.id }]);
            
            if (createError) {
              console.error('Failed to create profile:', createError);
              toast.error('Unable to set up your profile. Some features might not work properly.');
            } else {
              console.log('Profile created successfully');
              // Refresh entries after creating profile
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

  // Handle loading timeout
  useEffect(() => {
    // Set a timeout to force-complete loading state after 15 seconds
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Force completing loading state due to timeout');
        setIsRefreshing(false);
        // Try process entries to ensure everything is set up
        if (user?.id && !isProcessing) {
          processUnprocessedEntries();
        }
      }
    }, 15000);
    
    setLoadTimeout(timeout);
    
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    };
  }, [isLoading, user?.id, processUnprocessedEntries, isProcessing]);

  // Handle URL processing parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tempId = queryParams.get('processing');
    
    if (tempId && !processingEntries.includes(tempId)) {
      setProcessingEntries(prev => [...prev, tempId]);
      
      // Clean URL without reloading page
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Set a timeout to remove the processing entry
      const processingTimeout = setTimeout(() => {
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        refreshEntries(false);
      }, 30000);
      
      // Schedule periodic refreshes while processing
      const refreshInterval = setInterval(() => {
        console.log("Auto-refreshing entries to check for processed entry");
        refreshEntries(false).then(() => {
          if (processingEntries.length === 0) {
            clearInterval(refreshInterval);
          }
        });
      }, 5000);
      
      return () => {
        clearTimeout(processingTimeout);
        clearInterval(refreshInterval);
      };
    }
  }, [location.search, processingEntries, refreshEntries]);

  // Handle manual refresh button click
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Process any unprocessed entries
      if (user?.id) {
        const processingResult = await processUnprocessedEntries();
        
        // Only continue if processing is not already happening
        if (processingResult.alreadyProcessing) {
          setIsRefreshing(false);
          return;
        }
      }
      
      // Pass true to show a toast notification for manual refresh
      await refreshEntries(true);
      
      // After refresh, clear any processing entries that might have been completed
      setProcessingEntries([]);
      setRefreshKey(prev => prev + 1); // Force a fresh fetch
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
      
      {/* Show a message when loading takes too long */}
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
      
      {/* Show entries when not loading */}
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
