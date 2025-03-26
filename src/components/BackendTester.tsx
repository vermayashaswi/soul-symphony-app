
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createAudioBucket } from '@/utils/supabase-diagnostics';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function BackendTester() {
  const [isFixing, setIsFixing] = useState(false);
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
      
      const audioBucket = buckets?.find(bucket => bucket.name === 'audio');
      
      if (audioBucket) {
        toast.success('Audio bucket exists, checking policies...', { id: 'storage-check' });
        
        // Test if we can access it
        try {
          const testFilePath = `${user.id}/test-file.txt`;
          
          // Try to upload a test file
          const { error: uploadError } = await supabase.storage
            .from('audio')
            .upload(testFilePath, new Blob(['test']), {
              contentType: 'text/plain',
              upsert: true
            });
            
          if (uploadError) {
            console.error('Access test failed:', uploadError);
            toast.error('Storage bucket exists but policies need to be fixed', { id: 'storage-check' });
            
            // Fix policies
            const result = await createAudioBucket();
            if (result.success) {
              toast.success('Audio bucket policies fixed successfully', { id: 'storage-check' });
            } else {
              toast.error(`Failed to fix audio policies: ${result.error}`, { id: 'storage-check' });
            }
          } else {
            // Clean up the test file
            await supabase.storage.from('audio').remove([testFilePath]);
            toast.success('Audio storage is working correctly', { id: 'storage-check' });
          }
        } catch (testError) {
          console.error('Error testing bucket access:', testError);
          toast.error('Failed to test bucket access', { id: 'storage-check' });
        }
      } else {
        toast.error('Audio bucket does not exist, creating it now...', { id: 'storage-check' });
        
        // Create the bucket and policies
        const result = await createAudioBucket();
        
        if (result.success) {
          toast.success('Audio bucket created successfully', { id: 'storage-check' });
        } else {
          toast.error(`Failed to create audio bucket: ${result.error}`, { id: 'storage-check' });
        }
      }
    } catch (error: any) {
      console.error('Error checking/fixing audio storage:', error);
      toast.error(`Error: ${error.message}`, { id: 'storage-check' });
    } finally {
      setIsFixing(false);
    }
  };
  
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Audio Storage Diagnostic</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertDescription>
            If you're having issues with audio storage, you can run this diagnostic tool to check and fix it.
          </AlertDescription>
        </Alert>
        <Button 
          onClick={checkAndFixAudioStorage}
          disabled={isFixing}
          className="mt-4"
        >
          {isFixing ? 'Checking...' : 'Check & Fix Audio Storage'}
        </Button>
      </CardContent>
    </Card>
  );
}
