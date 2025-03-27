
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createAudioBucket, diagnoseDatabaseIssues } from '@/utils/supabase-diagnostics';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function BackendTester() {
  const [isFixing, setIsFixing] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const { user } = useAuth();
  
  const checkAndFixAudioStorage = async () => {
    if (!user) {
      toast.error('You need to be signed in to check audio storage');
      return;
    }
    
    setIsFixing(true);
    toast.loading('Checking audio storage...', { id: 'storage-check' });
    
    try {
      // First check if bucket exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        toast.error('Failed to check storage buckets', { id: 'storage-check' });
        console.error('Error checking storage buckets:', listError);
        setIsFixing(false);
        return;
      }
      
      const audioBucket = buckets?.find(bucket => bucket.name === 'journal-audio-entries');
      
      if (audioBucket) {
        toast.success('Audio bucket exists, checking policies...', { id: 'storage-check' });
        
        // Test if we can access it
        try {
          const testFilePath = `${user.id}/test-file.txt`;
          
          // Try to upload a test file
          const { error: uploadError } = await supabase.storage
            .from('journal-audio-entries')
            .upload(testFilePath, new Blob(['test']), {
              contentType: 'text/plain',
              upsert: true
            });
            
          if (uploadError) {
            console.error('Access test failed:', uploadError);
            toast.error('Storage bucket exists but policies need to be fixed', { id: 'storage-check' });
            
            // Verify bucket status
            const result = await createAudioBucket();
            if (result.success) {
              toast.success('Audio bucket verified successfully', { id: 'storage-check' });
            } else {
              toast.error(`Failed to verify audio policies: ${result.error}`, { id: 'storage-check' });
            }
          } else {
            // Clean up the test file
            await supabase.storage.from('journal-audio-entries').remove([testFilePath]);
            toast.success('Audio storage is working correctly', { id: 'storage-check' });
          }
        } catch (testError) {
          console.error('Error testing bucket access:', testError);
          toast.error('Failed to test bucket access', { id: 'storage-check' });
        }
      } else {
        toast.error('Audio bucket does not exist, contact administrator...', { id: 'storage-check' });
        
        // Attempt to verify the bucket status
        const result = await createAudioBucket();
        
        if (result.success) {
          toast.success('Audio bucket verified successfully', { id: 'storage-check' });
        } else {
          toast.error(`Audio storage not available: ${result.error}`, { id: 'storage-check' });
        }
      }
    } catch (error: any) {
      console.error('Error checking/fixing audio storage:', error);
      toast.error(`Error: ${error.message}`, { id: 'storage-check' });
    } finally {
      setIsFixing(false);
    }
  };
  
  const runCompleteDiagnostics = async () => {
    if (!user) {
      toast.error('You need to be signed in to run diagnostics');
      return;
    }
    
    setIsDiagnosing(true);
    toast.loading('Running database diagnostics...', { id: 'diagnostics' });
    
    try {
      const results = await diagnoseDatabaseIssues();
      
      if (results.success) {
        toast.success('All database checks passed!', { id: 'diagnostics' });
      } else {
        const failedChecks = Object.entries(results.results)
          .filter(([_, passed]) => !passed)
          .map(([name]) => name)
          .join(', ');
          
        toast.error(`Diagnostics failed: ${failedChecks}`, { id: 'diagnostics' });
        
        if (results.errorDetails.length > 0) {
          console.error('Diagnostic errors:', results.errorDetails);
        }
      }
    } catch (error: any) {
      console.error('Error running diagnostics:', error);
      toast.error(`Diagnostics error: ${error.message}`, { id: 'diagnostics' });
    } finally {
      setIsDiagnosing(false);
    }
  };
  
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Database & Storage Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            If you're having issues with database access or audio storage, you can run these diagnostic tools.
          </AlertDescription>
        </Alert>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={checkAndFixAudioStorage}
            disabled={isFixing || isDiagnosing}
            className="flex-1"
          >
            {isFixing ? 'Checking...' : 'Check Audio Storage'}
          </Button>
          
          <Button 
            onClick={runCompleteDiagnostics}
            disabled={isFixing || isDiagnosing}
            variant="outline" 
            className="flex-1"
          >
            {isDiagnosing ? 'Running...' : 'Run Full Diagnostics'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
