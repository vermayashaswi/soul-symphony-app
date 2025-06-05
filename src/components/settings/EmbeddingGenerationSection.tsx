
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Database, CheckCircle, AlertCircle } from 'lucide-react';
import { EmbeddingGenerationService } from '@/services/embeddingGenerationService';
import { useQuery } from '@tanstack/react-query';

export const EmbeddingGenerationSection: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Query to check missing embeddings count
  const { data: missingCount = 0, refetch } = useQuery({
    queryKey: ['missing-embeddings-count'],
    queryFn: EmbeddingGenerationService.checkMissingEmbeddings,
    refetchInterval: 30000, // Check every 30 seconds
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
      setLastResult('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusIcon = () => {
    if (isGenerating) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (lastResult === 'success') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (lastResult === 'error') return <AlertCircle className="h-4 w-4 text-red-500" />;
    return <Database className="h-4 w-4" />;
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
              Entries without embeddings: {missingCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {missingCount === 0 
                ? "All entries are ready for AI analysis" 
                : "Some entries need processing for optimal AI chat performance"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm text-muted-foreground">
              {isGenerating ? 'Processing...' : 
               lastResult === 'success' ? 'Complete' :
               lastResult === 'error' ? 'Error' : 'Ready'}
            </span>
          </div>
        </div>

        <Button 
          onClick={handleGenerateEmbeddings}
          disabled={isGenerating || missingCount === 0}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Embeddings...
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
