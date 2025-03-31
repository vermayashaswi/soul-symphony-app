
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Sparkles, Smile, Meh, Frown, Tag, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmotionChart from '@/components/EmotionChart';
import EmotionBubbles from '@/components/EmotionBubbles';
import ThemeBoxes from '@/components/journal/ThemeBoxes';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Type for JournalEntry matching Supabase table schema
export type JournalEntry = {
  id: number;
  "transcription text": string;
  "refined text": string;
  created_at: string;
  audio_url: string | null;
  user_id: string | null;
  "foreign key": string | null;
  emotions?: Record<string, number>;
  duration?: number;
  master_themes?: string[];
  sentiment?: string;
  entities?: { type: string, name: string }[];
};

interface JournalEntryCardProps {
  entry: JournalEntry;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ entry }) => {
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [bubbleDisturbance, setBubbleDisturbance] = useState(false);
  const [isRefreshingThemes, setIsRefreshingThemes] = useState(false);
  const { toast: uiToast } = useToast();

  // Helper function to determine sentiment color
  const getSentimentColor = () => {
    if (!entry.sentiment) return "text-gray-400";
    
    const score = parseFloat(entry.sentiment);
    if (score > 0.25) return "text-green-500";
    if (score < -0.25) return "text-red-500";
    return "text-amber-500";
  };

  // Helper function to get sentiment label
  const getSentimentLabel = () => {
    if (!entry.sentiment) return "Neutral";
    
    const score = parseFloat(entry.sentiment);
    if (score > 0.5) return "Very Positive";
    if (score > 0.25) return "Positive";
    if (score < -0.5) return "Very Negative";
    if (score < -0.25) return "Negative";
    return "Neutral";
  };

  // Helper function to get sentiment emoji
  const getSentimentEmoji = () => {
    if (!entry.sentiment) return <Meh className="h-5 w-5 text-gray-400" />;
    
    const score = parseFloat(entry.sentiment);
    if (score > 0.25) return <Smile className="h-5 w-5 text-green-500" />;
    if (score < -0.25) return <Frown className="h-5 w-5 text-red-500" />;
    return <Meh className="h-5 w-5 text-amber-500" />;
  };

  // Get the badge color based on entity type
  const getEntityBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'person':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'organization':
      case 'company':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'location':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'project':
        return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
      case 'event':
        return 'bg-pink-100 text-pink-800 hover:bg-pink-200';
      case 'product':
        return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200';
      case 'technology':
        return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  // Handle the bubble box click to create disturbance
  const handleBubbleBoxClick = () => {
    setBubbleDisturbance(true);
    setTimeout(() => setBubbleDisturbance(false), 3000); // Reset after 3 seconds
  };

  // Filter out empty entities and get unique names
  const uniqueEntities = React.useMemo(() => {
    if (!entry.entities || entry.entities.length === 0) return [];
    
    // Get unique entity names (case insensitive)
    const uniqueNames = new Map<string, { type: string, name: string }>();
    
    entry.entities.forEach(entity => {
      const lowerName = entity.name.toLowerCase();
      if (!uniqueNames.has(lowerName)) {
        uniqueNames.set(lowerName, entity);
      }
    });
    
    return Array.from(uniqueNames.values());
  }, [entry.entities]);

  // Function to manually refresh themes
  const refreshThemes = async () => {
    if (isRefreshingThemes) return;

    setIsRefreshingThemes(true);
    toast.info("Refreshing themes...");

    try {
      // Extract themes using our edge function
      const { data, error } = await supabase.functions.invoke('generate-themes', {
        body: {
          text: entry["refined text"] || entry["transcription text"],
          entryId: entry.id
        }
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success("Themes updated successfully");
      } else {
        throw new Error(data.error || "Failed to update themes");
      }
    } catch (error: any) {
      console.error("Error refreshing themes:", error);
      toast.error("Failed to refresh themes: " + (error.message || "Unknown error"));
    } finally {
      setIsRefreshingThemes(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">
              {format(new Date(entry.created_at), 'MMMM d, yyyy - h:mm a')}
            </CardTitle>
            <div className="flex items-center gap-2">
              {entry.sentiment && (
                <div className="flex items-center gap-1">
                  {getSentimentEmoji()}
                  <span className={`text-sm font-medium ${getSentimentColor()}`}>
                    {getSentimentLabel()}
                  </span>
                </div>
              )}
              {entry.duration && (
                <span className="text-sm text-muted-foreground">
                  {Math.floor(entry.duration / 60)}:{(entry.duration % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div>
                <h3 className="font-medium mb-2">Your Recording</h3>
                {entry.audio_url ? (
                  <audio controls className="w-full">
                    <source src={entry.audio_url} type="audio/webm" />
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <p className="text-muted-foreground">No audio recording available</p>
                )}
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Journal Entry</h3>
                <motion.p 
                  className="whitespace-pre-line"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {entry["refined text"] || "No refined text available"}
                </motion.p>
              </div>

              {/* Entities section - now displayed as a flat list of badges without explicit type labels */}
              {uniqueEntities.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-blue-500" />
                    Key Elements
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {uniqueEntities.map((entity, idx) => (
                      <Badge 
                        key={`${entity.name}-${idx}`} 
                        variant="outline"
                        className={`${getEntityBadgeColor(entity.type)}`}
                      >
                        {entity.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Themes
                </h3>
                
                <button
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  onClick={refreshThemes}
                  disabled={isRefreshingThemes}
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshingThemes ? 'animate-spin' : ''}`} />
                  {isRefreshingThemes ? 'Updating...' : 'Refresh'}
                </button>
              </div>
              
              <motion.div 
                className="h-80 mb-4 flex items-center justify-center p-4 border border-muted rounded-lg shadow-sm bg-white cursor-pointer"
                whileHover={{ boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                transition={{ duration: 0.2 }}
                onClick={handleBubbleBoxClick}
              >
                {entry.emotions && Object.keys(entry.emotions).length > 0 ? (
                  <EmotionBubbles 
                    emotions={entry.emotions} 
                    className="w-full h-full"
                    preventOverlap={true}
                    isDisturbed={bubbleDisturbance}
                  />
                ) : entry.master_themes && entry.master_themes.length > 0 ? (
                  <ThemeBoxes 
                    themes={entry.master_themes} 
                    className="w-full h-full items-center justify-center" 
                    isDisturbed={bubbleDisturbance}
                  />
                ) : (
                  <ThemeBoxes 
                    themes={[]} 
                    className="w-full h-full items-center justify-center"
                    isDisturbed={bubbleDisturbance}
                  />
                )}
              </motion.div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default JournalEntryCard;
