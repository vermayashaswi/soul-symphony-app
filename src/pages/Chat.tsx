import React, { useEffect, useState } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/contexts/TranslationContext';
import { ConversationStateManager } from '@/utils/chat/conversationStateManager';
import { extractConversationInsights } from '@/utils/chat/messageProcessor';
import { ChatMessage } from '@/types/chat';
import { debugTimezoneInfo } from '@/utils/chat/dateUtils';
import { format } from 'date-fns';

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { translate, currentLanguage } = useTranslation();
  const [isInitialized, setIsInitialized] = useState(false);

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
    
    // Test "last week" calculation
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek; // How many days to go back to reach last Sunday
    
    // Last Sunday at end of day
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - daysToLastSunday);
    
    // Last Monday at start of day (7 days before last Sunday)
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    
    console.log("Manual 'last week' calculation:");
    console.log(`Today: ${format(today, 'yyyy-MM-dd')} (day of week: ${dayOfWeek})`);
    console.log(`Days to last Sunday: ${daysToLastSunday}`);
    console.log(`Last Sunday: ${format(lastSunday, 'yyyy-MM-dd')}`);
    console.log(`Last Monday: ${format(lastMonday, 'yyyy-MM-dd')}`);
    console.log(`Last week: ${format(lastMonday, 'yyyy-MM-dd')} to ${format(lastSunday, 'yyyy-MM-dd')}`);
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
  
  // Clean up stale processing sessions and initialize metadata for existing threads
  useEffect(() => {
    const initializeChat = async () => {
      if (!user?.id) return;
      
      try {
        console.log("Initializing chat system...");
        
        // Clean up stale sessions
        const { data: staleSessions, error } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('user_id', user.id)
          .eq('processing_status', 'processing');
          
        if (error) {
          console.error("Error checking for stale sessions:", error);
          return;
        }
        
        if (staleSessions && staleSessions.length > 0) {
          console.log(`Found ${staleSessions.length} stale processing sessions, cleaning up...`);
          
          for (const session of staleSessions) {
            await supabase
              .from('chat_threads')
              .update({ processing_status: 'idle' })
              .eq('id', session.id);
              
            await supabase
              .from('chat_messages')
              .delete()
              .eq('thread_id', session.id)
              .eq('is_processing', true);
          }
        }
        
        // Initialize metadata for existing threads without it
        const { data: threads } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('user_id', user.id)
          .is('metadata', null)
          .limit(10);
          
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
            
            // Initialize with default metadata
            await supabase
              .from('chat_threads')
              .update({
                metadata: {
                  timeContext,
                  topicContext,
                  intentType: 'new_query',
                  confidenceScore: 1.0,
                  needsClarity: false,
                  ambiguities: [],
                  lastQueryType: 'journal_specific',
                  lastUpdated: new Date().toISOString()
                }
              })
              .eq('id', thread.id);
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

  return (
    <div className="w-full h-full flex flex-col">
      <SmartChatInterface />
    </div>
  );
};

export default Chat;
