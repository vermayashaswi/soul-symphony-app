import React, { useEffect } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/contexts/TranslationContext';

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { translate, currentLanguage } = useTranslation();

  // Pre-translate common chat-related strings more comprehensively 
  useEffect(() => {
    const initializeLanguageSupport = async () => {
      if (translate && currentLanguage !== 'en') {
        try {
          console.log("Pre-translating chat strings for language:", currentLanguage);
          // Common UI strings
          await translate("New Chat", "en");
          await translate("Ruh", "en");
          await translate("Your message...", "en");
          await translate("Send", "en");
          await translate("Chat", "en");
          await translate("Loading...", "en");
          
          // Chat message related strings
          await translate("Analysis:", "en");
          await translate("SQL Query:", "en");
          await translate("journal entries", "en");
          await translate("Unknown date", "en");
          await translate("more entries", "en");
          
          // Error messages
          await translate("Error loading messages", "en");
          await translate("Could not load conversation history.", "en");
          await translate("Authentication required", "en");
          await translate("Please sign in to use the chat feature.", "en");
          
          // Processing messages
          await translate("Analyzing your question...", "en");
          await translate("Analyzing patterns in your journal...", "en");
          await translate("Planning search strategy...", "en");
          await translate("Searching for insights...", "en");
          await translate("Processing your request...", "en");
          await translate("Retrieving information...", "en");
          
          // Time-related terms for better translation
          await translate("today", "en");
          await translate("yesterday", "en");
          await translate("this week", "en");
          await translate("last week", "en");
          await translate("this month", "en");
          await translate("last month", "en");
          await translate("previous month", "en");
          
          console.log("Chat strings pre-translated successfully");
        } catch (e) {
          console.error("Error pre-translating chat strings:", e);
        }
      }
    };
    
    initializeLanguageSupport();
  }, [translate, currentLanguage]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Check connection to Supabase
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('chat_threads').select('id').limit(1);
        
        if (error) {
          console.error("Database connection error:", error);
          toast({
            title: "Connection Error",
            description: "Having trouble connecting to the server. Some data might not load properly.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Supabase connection error:", err);
      }
    };
    
    if (user) {
      checkConnection();
    }
  }, [user, toast]);
  
  // Check and clean up any stale 'processing' threads
  useEffect(() => {
    const cleanupStaleSessions = async () => {
      if (!user?.id) return;
      
      try {
        // Find any threads that might be stuck in processing status
        const { data: staleSessions, error } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('user_id', user.id)
          .eq('processing_status', 'processing');
          
        if (error) {
          console.error("Error checking for stale sessions:", error);
          return;
        }
        
        // Reset any threads that were left in processing status
        if (staleSessions && staleSessions.length > 0) {
          console.log(`Found ${staleSessions.length} stale processing sessions, cleaning up...`);
          
          for (const session of staleSessions) {
            await supabase
              .from('chat_threads')
              .update({ processing_status: 'idle' })
              .eq('id', session.id);
              
            // Also clean up any processing messages
            await supabase
              .from('chat_messages')
              .delete()
              .eq('thread_id', session.id)
              .eq('is_processing', true);
          }
        }
      } catch (err) {
        console.error("Error cleaning up stale sessions:", err);
      }
    };
    
    cleanupStaleSessions();
  }, [user?.id]);

  // Add column for storing temporal context if not exists
  useEffect(() => {
    const checkAndUpdateMetadata = async () => {
      if (!user?.id) return;
      
      try {
        // Check if metadata is being used in threads
        const { data: threads, error } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('user_id', user.id)
          .limit(5);
          
        if (error) {
          console.error("Error checking thread metadata:", error);
          return;
        }
        
        // If threads exist, ensure they have metadata for storing context
        if (threads && threads.length > 0) {
          for (const thread of threads) {
            // This will add a default metadata JSON if it doesn't exist
            await supabase
              .from('chat_threads')
              .update({
                metadata: { 
                  timeContext: null,
                  topicContext: null,
                  lastUpdated: new Date().toISOString()
                }
              })
              .eq('id', thread.id)
              .is('metadata', null);
          }
          
          console.log("Initialized metadata for threads if needed");
        }
      } catch (err) {
        console.error("Error updating thread metadata:", err);
      }
    };
    
    checkAndUpdateMetadata();
  }, [user?.id]);

  // Add CSS override to hide duplicate close button in chat sidebar
  useEffect(() => {
    // Create a style element to inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
      .chat-sidebar-close-duplicate {
        display: none !important;
      }
      
      /* Ensure chat input is always visible */
      .mobile-chat-input-container {
        padding-bottom: calc(env(safe-area-inset-bottom, 16px) + 5px);
        z-index: 9999;
        bottom: 3.6rem !important; /* Adjusted to match the new navbar height */
      }
      
      /* Add extra padding to chat area to prevent content from being hidden */
      .chat-messages-container {
        padding-bottom: 100px;
      }
      
      /* Ensure keyboard doesn't obscure input */
      .input-keyboard-active {
        position: sticky !important; 
        bottom: 0 !important;
        z-index: 9999 !important;
      }
      
      /* Make sidebar header compact */
      .sheet-header {
        padding: 12px !important;
        margin-bottom: 0 !important;
      }
      
      /* Reduce space after sidebar header */
      .sheet-content .mt-5 {
        margin-top: 0.5rem !important;
      }
      
      /* Ensure chat suggestions are visible during tutorial */
      body.tutorial-active .empty-chat-suggestion,
      body.tutorial-active .chat-suggestion-button {
        opacity: 1 !important;
        visibility: visible !important;
        display: block !important;
        pointer-events: auto !important;
      }
      
      /* Add extra styling to first suggestion button for tutorial */
      .chat-suggestion-button:first-child,
      .empty-chat-suggestion:first-child {
        position: relative;
      }
    `;
    document.head.appendChild(style);
    
    // Clean up on unmount
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <SmartChatInterface />
    </div>
  );
};

export default Chat;
