import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Pause, Play, Trash2, Save, X, Check, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRecording } from '@/hooks/use-recording';
import { useTranscription } from '@/hooks/use-transcription';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { formatDate, formatTime } from '@/lib/utils';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { EmotionBadge } from '@/components/EmotionBadge';
import { JournalEntry } from '@/types/journal';
import { cn } from '@/lib/utils';

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
    refreshEntries
  } = useJournalEntries(user?.id);
  
  // Reset recording state when switching to record tab
  useEffect(() => {
    if (activeTab === 'record') {
      resetRecording();
      resetTranscription();
      setIsEditing(false);
      setEditingEntry(null);
    }
  }, [activeTab, resetRecording, resetTranscription]);
  
  // Handle save journal entry
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
        transcription: transcription || '',
        refined_text: refinedText || transcription || '',
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
  
  // Handle edit journal entry
  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEditedText(entry["refined text"] || entry.transcription || '');
    setIsEditing(true);
  };
  
  // Handle save edited entry
  const handleSaveEdit = async () => {
    if (!editingEntry || !user) return;
    
    try {
      await saveJournalEntry({
        id: editingEntry.id,
        user_id: user.id,
        audio_url: editingEntry.audio_url,
        transcription: editingEntry.transcription,
        refined_text: editedText,
        emotions: editingEntry.emotions,
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
  
  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingEntry(null);
  };
  
  // Handle delete journal entry
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
  
  // Handle refine transcription
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
  
  // Format recording time
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <ParticleBackground />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Journal</h1>
          <p className="text-muted-foreground mb-6">Record your thoughts and track your emotional journey</p>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-8">
              <TabsTrigger value="record">Record New Entry</TabsTrigger>
              <TabsTrigger value="entries">Past Entries</TabsTrigger>
            </TabsList>
            
            <TabsContent value="record" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Voice Journal</CardTitle>
                  <CardDescription>
                    Record your thoughts and feelings. Your voice will be transcribed automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <div className="relative">
                      <motion.div
                        className={cn(
                          "w-24 h-24 rounded-full flex items-center justify-center",
                          isRecording 
                            ? "bg-red-100 hover:bg-red-200" 
                            : "bg-primary/10 hover:bg-primary/20"
                        )}
                        whileTap={{ scale: 0.95 }}
                        onClick={isRecording ? stopRecording : startRecording}
                      >
                        {isRecording ? (
                          <Pause className="h-10 w-10 text-red-500" />
                        ) : (
                          <Mic className="h-10 w-10 text-primary" />
                        )}
                      </motion.div>
                      
                      {isRecording && (
                        <motion.div
                          className="absolute inset-0 rounded-full border-4 border-red-400"
                          initial={{ scale: 1, opacity: 1 }}
                          animate={{ 
                            scale: [1, 1.1, 1],
                            opacity: [1, 0.8, 1]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                      )}
                    </div>
                  </div>
                  
                  {isRecording && (
                    <div className="text-center">
                      <p className="text-lg font-semibold text-red-500">
                        Recording... {formatRecordingTime(recordingTime)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Click the button again to stop recording
                      </p>
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="mt-2 text-muted-foreground">Processing audio...</p>
                    </div>
                  )}
                  
                  {audioBlob && !isRecording && !isProcessing && !transcription && (
                    <div className="flex flex-col items-center gap-4">
                      <audio src={audioUrl} controls className="w-full max-w-md" />
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={resetRecording}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Discard
                        </Button>
                        
                        <Button 
                          size="sm"
                          onClick={() => transcribeAudio(audioBlob)}
                          disabled={isTranscribing}
                        >
                          {isTranscribing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Transcribing...
                            </>
                          ) : (
                            <>Transcribe</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {transcription && (
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Transcription</h3>
                        <p className="text-sm">{transcription}</p>
                      </div>
                      
                      {!refinedText && !isRefiningTranscription && (
                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            onClick={handleRefineTranscription}
                            disabled={isRefining}
                          >
                            {isRefining ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Refining...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refine with AI
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      
                      {isRefiningTranscription && (
                        <div className="text-center py-4">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                          <p className="mt-2 text-muted-foreground">AI is refining your journal entry...</p>
                        </div>
                      )}
                      
                      {refinedText && (
                        <div className="space-y-4">
                          <div className="border rounded-lg p-4 bg-primary/5">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Refined Entry</h3>
                            <p className="text-sm">{refinedText}</p>
                          </div>
                          
                          {emotions && emotions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {emotions.map((emotion, index) => (
                                <EmotionBadge key={index} emotion={emotion} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      resetRecording();
                      resetTranscription();
                    }}
                  >
                    Clear
                  </Button>
                  
                  <Button 
                    onClick={handleSaveEntry}
                    disabled={!transcription || isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Entry
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="entries">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Your Journal Entries</h2>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshEntries}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                
                {isLoadingEntries ? (
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
                                          'Save Changes'
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <p className="text-sm">
                                      {entry["refined text"] || entry.transcription}
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
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
