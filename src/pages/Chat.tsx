
import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import SmartChat from './SmartChat';

const Chat = () => {
  const { threadId } = useParams();
  
  // Chat page is just a wrapper around SmartChat for backward compatibility
  // If there's a threadId, pass it through to SmartChat
  if (threadId) {
    // Navigate to smart-chat with the threadId to maintain consistency
    return <Navigate to={`/app/smart-chat/${threadId}`} replace />;
  }
  
  // For base /app/chat route, redirect to smart-chat
  return <Navigate to="/app/smart-chat" replace />;
};

export default Chat;
