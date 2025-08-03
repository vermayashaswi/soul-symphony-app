
import React, { useEffect, useState } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import MobileChatInterface from '@/components/chat/mobile/MobileChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/contexts/TranslationContext';
import { ConversationStateManager } from '@/utils/chat/conversationStateManager';
import { extractConversationInsights } from '@/utils/chat/messageProcessor';
import { ChatMessage } from '@/types/chat';
import { debugTimezoneInfo, getCurrentWeekDates } from '@/utils/chat/dateUtils';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { PremiumFeatureGuard } from '@/components/subscription/PremiumFeatureGuard';
import { useIsMobile } from '@/hooks/use-mobile';
import { v4 as uuidv4 } from 'uuid';

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { translate, currentLanguage } = useTranslation();
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Debug timezone information on load
  useEffect(() => {
    console.log("Chat component mounted, debugging timezone info:");
    debugTimezoneInfo();
    
    // Additional current date debug
    const now = new Date();
    console.log("Current date details:");
    console.log(`Date object: ${now}`);
    console.log(`ISO string: ${now.toISOString()}`);
    console.log(`Local string: ${now.toString()}`);
    console.log(`Formatted: ${format(now, 'yyyy-MM-dd HH:mm:ss')}`);
    console.log(`Date: ${now.getDate()}, Month: ${now.getMonth() + 1}, Year: ${now.getFullYear()}`);
    console.log(`Day of week: ${now.getDay()} (0=Sunday, 1=Monday, ..., 6=Saturday)`);
    
    // Test current week calculation
    console.log("Current week dates calculation:");
    const currentWeek = getCurrentWeekDates();
    console.log(`Current week dates: ${currentWeek}`);
    
    // Get timezone from Intl API
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log(`Browser timezone: ${timeZone}`);
      
      // Format date in detected timezone
      const zonedDate = toZonedTime(now, timeZone);
      console.log(`Date in ${timeZone}: ${format(zonedDate, 'yyyy-MM-dd HH:mm:ss')}`);
    } catch (e) {
      console.error("Error getting timezone:", e);
    }
  }, []);

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
          
          // New clarification-related phrases
          await translate("I need more information", "en");
          await translate("Could you clarify", "en");
          await translate("Can you be more specific", "en");
          await translate("Which time period", "en");
          await translate("What aspect specifically", "en");
          
          console.log("Chat strings pre-translated successfully");
        } catch (e) {
          console.error("Error pre-translating chat strings:", e);
        }
      }
      
      setIsInitialized(true);
    };
    
    initializeLanguageSupport();
  }, [translate, currentLanguage]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/app/auth');
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
  
  // Clean up stale processing sessions and initialize metadata for existing threads
  useEffect(() => {
    const initializeChat = async () => {
      if (!user?.id) return;
      
      try {
        console.log("Initializing chat system...");
        
        // Clean up stale sessions (processing_status column removed)
        const { data: staleSessions, error } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('user_id', user.id)
          .limit(0); // No stale sessions to clean since column doesn't exist
          
        if (error) {
          console.error("Error checking for stale sessions:", error);
          return;
        }
        
        if (staleSessions && staleSessions.length > 0) {
          console.log(`Found ${staleSessions.length} stale processing sessions, cleaning up...`);
          
          // No cleanup needed since processing_status column doesn't exist
        }
        
        // Initialize metadata for existing threads without it (metadata column removed)
        const { data: threads } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('user_id', user.id)
          .limit(0); // No metadata to initialize since column doesn't exist
          
        if (threads && threads.length > 0) {
          console.log(`Initializing metadata for ${threads.length} threads`);
          
          for (const thread of threads) {
            // Get messages to extract context
            const { data: messages } = await supabase
              .from('chat_messages')
              .select('content, sender, created_at, id, thread_id')
              .eq('thread_id', thread.id)
              .order('created_at', { ascending: true });
              
            let topicContext = null;
            let timeContext = null;
            
            if (messages && messages.length > 0) {
              // Convert to proper ChatMessage type before passing to extractConversationInsights
              const typedMessages: ChatMessage[] = messages.map(msg => ({
                id: msg.id,
                thread_id: msg.thread_id,
                content: msg.content,
                sender: msg.sender as 'user' | 'assistant' | 'error',
                role: msg.sender as 'user' | 'assistant' | 'error',
                created_at: msg.created_at
              }));
              
              // Try to extract insights from messages
              const insights = extractConversationInsights(typedMessages);
              
              if (insights.topics.length > 0) {
                topicContext = insights.topics[0];
              }
              
              if (insights.timeReferences.length > 0) {
                timeContext = insights.timeReferences[0];
              }
            }
            
            // No metadata to initialize since column doesn't exist
          }
        }
        
        console.log("Chat system initialization complete");
      } catch (err) {
        console.error("Error initializing chat system:", err);
      }
    };
    
    if (user?.id && isInitialized) {
      initializeChat();
    }
  }, [user?.id, isInitialized]);

  // Add CSS override to improve chat UI
  useEffect(() => {
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
      
      /* Add styling for clarification questions */
      .assistant-clarification {
        border-left: 3px solid var(--primary) !important;
        background-color: rgba(var(--primary-rgb), 0.05) !important;
        font-style: italic;
      }
      
      /* Add special styling for follow-up context */
      .context-preserved {
        position: relative;
      }
      
      .context-preserved::before {
        content: '';
        position: absolute;
        top: -5px;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(var(--primary-rgb), 0.3), transparent);
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Load the last active thread on component mount
  useEffect(() => {
    const loadLastThread = async () => {
      if (!user?.id) return;
      
      const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
      if (storedThreadId) {
        // Verify the thread exists and belongs to the user
        const { data: thread, error } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('id', storedThreadId)
          .eq('user_id', user.id)
          .single();
          
        if (!error && thread) {
          setCurrentThreadId(storedThreadId);
          return;
        }
      }
      
      // If no stored thread or it doesn't exist, get the most recent thread
      const { data: threads, error } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
        
      if (!error && threads && threads.length > 0) {
        setCurrentThreadId(threads[0].id);
        localStorage.setItem("lastActiveChatThreadId", threads[0].id);
      }
    };
    
    loadLastThread();
  }, [user?.id]);

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
    localStorage.setItem("lastActiveChatThreadId", threadId);
  };

  const handleCreateNewThread = async (): Promise<string | null> => {
    if (!user?.id) return null;
    
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
      
      if (error) {
        console.error("Error creating new thread:", error);
        toast({
          title: "Error",
          description: "Failed to create new conversation",
          variant: "destructive"
        });
        return null;
      }
      
      setCurrentThreadId(newThreadId);
      localStorage.setItem("lastActiveChatThreadId", newThreadId);
      return newThreadId;
    } catch (error) {
      console.error("Error creating new thread:", error);
      return null;
    }
  };

  console.log("[Chat] Rendering with mobile detection:", isMobile.isMobile);

  return (
    <PremiumFeatureGuard feature="chat">
      <div className="w-full h-full flex flex-col">
        {isMobile.isMobile ? (
          <MobileChatInterface
            currentThreadId={currentThreadId}
            onSelectThread={handleSelectThread}
            onCreateNewThread={handleCreateNewThread}
            userId={user?.id}
          />
        ) : (
          <SmartChatInterface />
        )}
      </div>
    </PremiumFeatureGuard>
  );
};

export default Chat;
