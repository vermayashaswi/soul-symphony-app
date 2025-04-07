
import React, { useEffect, useState, useCallback } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [key, setKey] = useState<number>(0); // Add a key to force re-render when needed

  // Get thread from URL if present
  useEffect(() => {
    const threadParam = searchParams.get('thread');
    if (threadParam) {
      setThreadId(threadParam);
      // Dispatch event to select this thread
      window.dispatchEvent(
        new CustomEvent('threadSelected', { 
          detail: { threadId: threadParam } 
        })
      );
    }
  }, [searchParams]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Set up a callback for handling event listeners to prevent closure issues
  const handleForceRefresh = useCallback(() => {
    // Force re-render of the entire component
    setKey(prevKey => prevKey + 1);
  }, []);

  // Listen for various thread events to refresh the component
  useEffect(() => {
    const handleThreadDeleted = handleForceRefresh;
    const handleThreadTitleUpdated = handleForceRefresh;
    const handleDialogClosed = handleForceRefresh;
    
    window.addEventListener('threadDeleted', handleThreadDeleted as EventListener);
    window.addEventListener('threadTitleUpdated', handleThreadTitleUpdated as EventListener);
    window.addEventListener('dialogClosed', handleDialogClosed as EventListener);
    
    return () => {
      window.removeEventListener('threadDeleted', handleThreadDeleted as EventListener);
      window.removeEventListener('threadTitleUpdated', handleThreadTitleUpdated as EventListener);
      window.removeEventListener('dialogClosed', handleDialogClosed as EventListener);
    };
  }, [handleForceRefresh]);

  return (
    <div className="w-full h-full flex flex-col" key={key}>
      <SmartChatInterface />
    </div>
  );
};

export default Chat;
