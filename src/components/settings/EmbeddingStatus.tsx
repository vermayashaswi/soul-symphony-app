import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { EmbeddingBackfillService } from '@/services/embeddingBackfillService';

export const EmbeddingStatus: React.FC = () => {
  const { user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [missing, setMissing] = useState(0);
  const [total, setTotal] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkEmbeddingStatus = async () => {
    if (!user) return;

    setIsChecking(true);
    try {
      const result = await EmbeddingBackfillService.checkMissingEmbeddings(user.id);
      setMissing(result.missing);
      setTotal(result.total);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Failed to check embedding status:', error);
      toast.error('Failed to check embedding status');
    } finally {
      setIsChecking(false);
    }
  };

  const generateMissingEmbeddings = async () => {
    if (!user) return;

    setIsGenerating(true);
    try {
      const result = await EmbeddingBackfillService.generateMissingEmbeddings(user.id);
      
      if (result.success) {
        toast.success(`Successfully generated ${result.processed} embeddings`);
        // Refresh status after generation
        await checkEmbeddingStatus();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      toast.error('Failed to generate embeddings');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkEmbeddingStatus();
    }
  }, [user]);

  if (!user) return null;

  const hasIssues = missing > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-theme-color flex items-center gap-2">
            <Database className="h-5 w-5" />
            <TranslatableText text="Embedding Status" />
          </h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={checkEmbeddingStatus}
            disabled={isChecking}
            className="flex items-center gap-1"
          >
            {isChecking ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <TranslatableText text="Check Status" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              <TranslatableText text="Journal Entries" />
            </span>
            <span className="text-sm text-muted-foreground">
              {total} total
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              <TranslatableText text="Missing Embeddings" />
            </span>
            <div className="flex items-center gap-2">
              {hasIssues ? (
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <span className={`text-sm font-medium ${hasIssues ? 'text-orange-600' : 'text-green-600'}`}>
                {missing}
              </span>
            </div>
          </div>

          {hasIssues && (
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                <TranslatableText text="Some journal entries are missing embeddings. This may affect chat and search functionality." />
              </p>
              <Button 
                onClick={generateMissingEmbeddings}
                disabled={isGenerating}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    <TranslatableText text="Generating Embeddings..." />
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    <TranslatableText text="Generate Missing Embeddings" />
                  </>
                )}
              </Button>
            </div>
          )}

          {!hasIssues && total > 0 && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300">
                <TranslatableText text="All journal entries have embeddings. Your chat and search functionality is optimized." />
              </p>
            </div>
          )}

          {lastChecked && (
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                <TranslatableText text="Last checked" />: {lastChecked.toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};