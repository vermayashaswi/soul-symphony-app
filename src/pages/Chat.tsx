
import React, { useEffect, useState } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/contexts/TranslationContext';
import { useFontLoading } from '@/main';

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { translate, currentLanguage } = useTranslation();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Get font loading status
  const fontStatus = useFontLoading ? useFontLoading() : { 
    fontsLoaded: true, 
    fontsError: false,
    devanagariReady: true
  };

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
          
          console.log("Chat strings pre-translated successfully");
          setIsInitialized(true);
        } catch (e) {
          console.error("Error pre-translating chat strings:", e);
          // Set initialized even in case of error to not block the UI
          setIsInitialized(true);
        }
      } else {
        // For English, no translation needed
        setIsInitialized(true);
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
    `;
    document.head.appendChild(style);
    
    // Clean up on unmount
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Show loading state if not initialized or fonts not loaded for non-Latin scripts
  const isLoading = !isInitialized || (currentLanguage === 'hi' && !fontStatus.devanagariReady);

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground">Loading chat interface...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SmartChatInterface />
    </div>
  );
};

export default Chat;
