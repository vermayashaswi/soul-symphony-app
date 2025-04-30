
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
  const { translate } = useTranslation();

  // Translate the app name to initialize the language support
  useEffect(() => {
    const initializeLanguageSupport = async () => {
      if (translate) {
        try {
          // Pre-translate common chat-related strings
          await translate("New Chat", "en");
          await translate("Ruh", "en");
          await translate("Your message...", "en");
          await translate("Send", "en");
        } catch (e) {
          console.error("Error pre-translating chat strings:", e);
        }
      }
    };
    
    initializeLanguageSupport();
  }, [translate]);

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
      }
      
      /* Add extra padding to chat area to prevent content from being hidden */
      .chat-messages-container {
        padding-bottom: 90px;
      }
      
      /* Ensure keyboard doesn't obscure input */
      .input-keyboard-active {
        position: sticky !important; 
        bottom: 0 !important;
        z-index: 9999 !important;
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
