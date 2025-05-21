import React from 'react';
// Import the MobileChatInterfaceProps type
import { MobileChatInterfaceProps } from '@/types/chat-interfaces'; 

const MobileChatInterface: React.FC<MobileChatInterfaceProps> = ({
  currentThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  mentalHealthInsights,
  timezoneOffset,
  timezone
}) => {
  
  return (
    
    <div>Mobile Chat Interface</div>
  );
};

export default MobileChatInterface;
