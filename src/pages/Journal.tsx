import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Pause, Play, Trash2, Save, X, Check, Loader2, RefreshCw, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRecording } from '@/hooks/use-recording';
import { useTranscription } from '@/hooks/use-transcription';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { formatDate, formatTime, cn } from '@/lib/utils';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { EmotionBadge } from '@/components/EmotionBadge';
import { JournalEntry } from '@/types/journal';
import { JournalSearch } from '@/components/journal/JournalSearch';

export default function Journal() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('record');
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editedText, setEditedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<number | null>(null);
  const [isProcessingEmbeddings, setIsProcessingEmbeddings] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const { 
    isRecording, 
    audioBlob, 
    recordingTime, 
    startRecording, 
    stopRecording, 
    resetRecording,
    isProcessing,
    audioUrl
  } = useRecording();
  
  const {
    transcription,
    isTranscribing,
    transcribeAudio,
    resetTranscription,
    refinedText,
    emotions,
    refineTranscription,
    isRefiningTranscription
  } = useTranscription();
  
  const {
    journalEntries,
    isLoading: isLoadingEntries,
    saveJournalEntry,
    isSaving,
    deleteJournalEntry,
    refreshEntries,
    processAllEmbeddings
  } = useJournalEntries(user?.id);
  
  useEffect(() => {
    if (activeTab === 'record') {
      resetRecording();
      resetTranscription();
      setIsEditing(false);
      setEditingEntry(null);
    }
  }, [activeTab, resetRecording, resetTranscription]);
  
  const handleSaveEntry = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save journal entries",
        variant: "destructive"
      });
      return;
    }
    
    if (!refinedText && !transcription) {
      toast({
        title: "No content to save",
        description: "Please record or type something first",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await saveJournalEntry({
        user_id: user.id,
        audio_url: audioUrl,
        "transcription text": transcription || '',
        "refined text": refinedText || transcription || '',
        emotions: emotions || [],
        created_at: new Date().toISOString()
      });
      
      toast({
        title: "Journal entry saved",
        description: "Your thoughts have been recorded successfully",
      });
      
      resetRecording();
      resetTranscription();
      setActiveTab('entries');
    } catch (error) {
      console.error('Error saving journal entry:', error);
      toast({
        title: "Failed to save entry",
        description: "There was an error saving your journal entry. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEditedText(entry["refined text"] || entry["transcription text"] || '');
    setIsEditing(true);
  };
  
  const handleSaveEdit = async () => {
    if (!editingEntry || !user) return;
    
    try {
      await saveJournalEntry({
        id: editingEntry.id,
        user_id: user.id,
        audio_url: editingEntry.audio_url || null,
        "transcription text": editingEntry["transcription text"] || '',
        "refined text": editedText,
        emotions: editingEntry.emotions || [],
        created_at: editingEntry.created_at
      });
      
      toast({
        title: "Journal entry updated",
        description: "Your changes have been saved successfully",
      });
      
      setIsEditing(false);
      setEditingEntry(null);
    } catch (error) {
      console.error('Error updating journal entry:', error);
      toast({
        title: "Failed to update entry",
        description: "There was an error updating your journal entry. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingEntry(null);
  };
  
  const handleDeleteEntry = async (id: number) => {
    setIsDeleting(id);
    try {
      await deleteJournalEntry(id);
      toast({
        title: "Journal entry deleted",
        description: "Your entry has been permanently removed",
      });
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      toast({
        title: "Failed to delete entry",
        description: "There was an error deleting your journal entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(null);
      setShowConfirmDelete(null);
    }
  };
  
  const handleRefineTranscription = async () => {
    if (!transcription) {
      toast({
        title: "No transcription to refine",
        description: "Please record something first",
        variant: "destructive"
      });
      return;
    }
    
    setIsRefining(true);
    try {
      await refineTranscription(transcription);
    } catch (error) {
      console.error('Error refining transcription:', error);
      toast({
        title: "Failed to refine transcription",
        description: "There was an error processing your recording. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRefining(false);
    }
  };
  
  const handleProcessAllEmbeddings = async () => {
    setIsProcessingEmbeddings(true);
    try {
      await processAllEmbeddings();
    } catch (error) {
      console.error('Error processing embeddings:', error);
    } finally {
      setIsProcessingEmbeddings(false);
    }
  };
  
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  const handleSearchEntrySelect = (entryId: number) => {
    const entry = journalEntries.find(e => e.id === entryId);
    if (entry) {
      setSelectedEntry(entry);
    }
  };
  
  return (
    <div className="flex-1 container py-4 md:py-8">
      <div className="grid gap-6">
        <JournalHeader 
          onCreateJournal={handleCreateJournal} 
          onViewInsights={handleViewInsights} 
          onProcessAllEmbeddings={handleProcessAllEmbeddings}
          isProcessingEmbeddings={isProcessingEmbeddings}
        />
        
        <JournalSearch userId={userId} onSelectEntry={handleSearchEntrySelect} />
        
        <div className="grid gap-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : journalEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">You haven't created any journal entries yet</p>
                <Button onClick={() => setActiveTab('record')}>Create Your First Entry</Button>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-4 pr-4">
                <AnimatePresence>
                  {journalEntries.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">
                                {formatDate(entry.created_at)}
                              </CardTitle>
                              <CardDescription>
                                {formatTime(entry.created_at)}
                              </CardDescription>
                            </div>
                            
                            {!isEditing && (
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditEntry(entry)}
                                >
                                  Edit
                                </Button>
                                
                                {showConfirmDelete === entry.id ? (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteEntry(entry.id)}
                                      disabled={isDeleting === entry.id}
                                    >
                                      {isDeleting === entry.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Check className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setShowConfirmDelete(null)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowConfirmDelete(entry.id)}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        
                        <CardContent>
                          {isEditing && editingEntry?.id === entry.id ? (
                            <div className="space-y-4">
                              <Textarea
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                className="min-h-[150px]"
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleSaveEdit}
                                  disabled={isSaving}
                                >
                                  {isSaving ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-4 w-4 mr-2" />
                                      Save Changes
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-sm">
                                {entry["refined text"] || entry["transcription text"]}
                              </p>
                              
                              {entry.emotions && entry.emotions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                  {entry.emotions.map((emotion, index) => (
                                    <EmotionBadge key={index} emotion={emotion} />
                                  ))}
                                </div>
                              )}
                              
                              {entry.audio_url && (
                                <div className="mt-4">
                                  <Separator className="mb-4" />
                                  <audio src={entry.audio_url} controls className="w-full" />
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
      
      {/* ... keep existing dialog components */}
    </div>
  );
}
