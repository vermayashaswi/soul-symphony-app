
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Database, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { EmbeddingGenerationService } from '@/services/embeddingGenerationService';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export const EmbeddingGenerationSection: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Query to check missing embeddings count
  const { 
    data: missingCount = 0, 
    refetch, 
    isLoading: isCheckingCount,
    error: countError 
  } = useQuery({
    queryKey: ['missing-embeddings-count'],
    queryFn: async () => {
      try {
        return await EmbeddingGenerationService.checkMissingEmbeddings();
      } catch (error) {
        console.error('[EmbeddingGenerationSection] Error checking missing embeddings:', error);
        toast.error('Failed to check embedding status');
        return 0;
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: 3,
    retryDelay: 1000,
  });

  const handleGenerateEmbeddings = async () => {
    setIsGenerating(true);
    setLastResult(null);
    
    try {
      const success = await EmbeddingGenerationService.generateWithToast();
      setLastResult(success ? 'success' : 'error');
      
      // Refetch the missing count after generation
      setTimeout(() => {
        refetch();
      }, 1000);
      
    } catch (error) {
      console.error('[EmbeddingGenerationSection] Generation error:', error);
      setLastResult('error');
      toast.error('Failed to generate embeddings');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefreshCount = () => {
    setLastResult(null);
    refetch();
  };

  const getStatusIcon = () => {
    if (isGenerating) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isCheckingCount) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (lastResult === 'success') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (lastResult === 'error' || countError) return <AlertCircle className="h-4 w-4 text-red-500" />;
    return <Database className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (isGenerating) return 'Processing...';
    if (isCheckingCount) return 'Checking...';
    if (lastResult === 'success') return 'Complete';
    if (lastResult === 'error') return 'Error';
    if (countError) return 'Check Failed';
    return 'Ready';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Journal Analysis System
        </CardTitle>
        <CardDescription>
          Manage embeddings for better AI chat analysis of your journal entries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <p className="text-sm font-medium">
              {countError ? (
                <span className="text-red-600">Error checking embeddings</span>
              ) : (
                `Entries without embeddings: ${missingCount}`
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {countError ? (
                "Unable to check embedding status"
              ) : missingCount === 0 ? (
                "All entries are ready for AI analysis"
              ) : (
                "Some entries need processing for optimal AI chat performance"
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm text-muted-foreground">
              {getStatusText()}
            </span>
            {countError && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshCount}
                disabled={isCheckingCount}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <Button 
          onClick={handleGenerateEmbeddings}
          disabled={isGenerating || isCheckingCount || (missingCount === 0 && !countError)}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Embeddings...
            </>
          ) : countError ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Check
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              {missingCount === 0 ? 'All Embeddings Ready' : `Generate Embeddings for ${missingCount} Entries`}
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Embeddings help the AI understand and search your journal entries</p>
          <p>• This process is required for personalized AI chat responses</p>
          <p>• Embeddings are generated automatically for new entries</p>
        </div>
      </CardContent>
    </Card>
  );
};
