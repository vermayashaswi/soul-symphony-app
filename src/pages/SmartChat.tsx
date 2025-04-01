
import { useEffect, useState } from "react";
import SmartChatInterface from "@/components/chat/SmartChatInterface";
import MobileChatInterface from "@/components/chat/mobile/MobileChatInterface";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import MobilePreviewFrame from "@/components/MobilePreviewFrame";
import Navbar from "@/components/Navbar";
import ChatThreadList from "@/components/chat/ChatThreadList";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";

export default function SmartChat() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { entries, loading } = useJournalEntries(user?.id, 0, true);
  const navigate = useNavigate();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  
  // Check if we're in mobile preview mode
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  useEffect(() => {
    document.title = "Roha | SOULo";
    
    // Force proper viewport setup for mobile
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    // Check for active thread or create one
    const checkOrCreateThread = async () => {
      if (!user?.id) return;

      try {
        // Get most recent thread
        const { data: threads, error } = await supabase
          .from('chat_threads')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (threads && threads.length > 0) {
          setCurrentThreadId(threads[0].id);
        } else {
          // Create a new thread if none exists
          await createNewThread();
        }
      } catch (error) {
        console.error("Error checking threads:", error);
      }
    };

    checkOrCreateThread();
  }, [isMobile, mobileDemo, user]);

  const hasEnoughEntries = !loading && entries.length > 0;

  const createNewThread = async () => {
    if (!user?.id) return;
    
    try {
      const newThreadId = uuidv4();
      const { error } = await supabase
        .from('chat_threads')
        .insert({
          id: newThreadId,
          user_id: user.id,
          title: "New Conversation",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      setCurrentThreadId(newThreadId);
    } catch (error) {
      console.error("Error creating thread:", error);
    }
  };

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  // Desktop content
  const desktopContent = (
    <>
      <Navbar />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="smart-chat-container w-full h-[calc(100vh-4rem)] flex pt-16" // Added pt-16 to create space below navbar
      >
        {!hasEnoughEntries && !loading && (
          <Alert className="absolute z-10 top-20 left-1/2 transform -translate-x-1/2 w-max mb-6 border-amber-300 bg-amber-50 text-amber-800"> {/* Adjusted top position */}
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No journal entries found</AlertTitle>
            <AlertDescription className="mt-2">
              <p>The AI Assistant works best when you have journal entries to analyze. Create some journal entries to get personalized insights.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => navigate('/journal')}
              >
                Go to Journal
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="w-72 h-full border-r">
          <ChatThreadList 
            userId={user?.id} 
            onSelectThread={handleSelectThread}
            onStartNewThread={createNewThread}
            currentThreadId={currentThreadId}
          />
        </div>
        
        <div className="flex-1 p-4">
          <SmartChatInterface />
        </div>
      </motion.div>
    </>
  );

  // Mobile content
  const mobileContent = (
    <>
      <Navbar />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="smart-chat-container h-[calc(100vh-4rem)] flex flex-col pt-16" // Added pt-16 for consistent spacing
      >
        {!hasEnoughEntries && !loading && (
          <Alert className="mx-3 mt-3 border-amber-300 bg-amber-50 text-amber-800">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm">No journal entries found</AlertTitle>
            <AlertDescription className="mt-1 text-xs">
              <p>Create journal entries to get personalized insights.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-1 h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => navigate('/journal')}
              >
                Go to Journal
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex-1 min-h-0">
          <MobileChatInterface />
        </div>
      </motion.div>
    </>
  );
  
  // Decide which content to render based on mobile status
  const content = (isMobile || mobileDemo) ? mobileContent : desktopContent;
  
  // If we're in mobile demo mode, wrap the content in the MobilePreviewFrame
  return mobileDemo ? <MobilePreviewFrame>{content}</MobilePreviewFrame> : content;
}
