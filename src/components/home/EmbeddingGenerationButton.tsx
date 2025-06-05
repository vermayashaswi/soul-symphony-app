
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const EmbeddingGenerationButton: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();

  const generateMissingEmbeddings = async () => {
    if (!user) {
      toast.error('Please log in to generate embeddings');
      return;
    }

    setIsGenerating(true);
    console.log('[EmbeddingGenerationButton] Starting embedding generation for user:', user.id);

    try {
      const { data, error } = await supabase.functions.invoke('generate-missing-embeddings', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('[EmbeddingGenerationButton] Error:', error);
        toast.error('Failed to generate embeddings');
        return;
      }

      console.log('[EmbeddingGenerationButton] Result:', data);
      
      if (data.processed > 0) {
        toast.success(`Successfully generated embeddings for ${data.processed} entries!`);
      } else if (data.total === 0) {
        toast.info('All entries already have embeddings');
      } else {
        toast.warning(`Processed ${data.processed} entries with ${data.errors} errors`);
      }

    } catch (error) {
      console.error('[EmbeddingGenerationButton] Function call error:', error);
      toast.error('Failed to generate embeddings');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generateMissingEmbeddings}
      disabled={isGenerating}
      className="fixed bottom-4 right-4 z-50 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
      size="sm"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-2" />
          Fix RAG
        </>
      )}
    </Button>
  );
};

export default EmbeddingGenerationButton;
