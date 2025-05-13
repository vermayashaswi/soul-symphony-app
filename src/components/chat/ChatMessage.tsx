import React, { useState, useEffect } from 'react';
import { ChatMessage as ChatMessageType } from '@/services/chat';
import { Loader2, ChevronDown, ChevronUp, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { JournalEntryReference } from '@/types/journal';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { extractReferenceDateInfo } from '@/utils/chat/threadUtils';

// Ensure a component exists for SmartChatInterface.tsx to render

// Keep using the existing ChatMessage component, but add the ability 
// to have a tutorial-specific class for highlighting in Step 6
const ChatMessage = ({ 
  message, 
  isLastMessage,
  isComplete = true,
  threadId
}: { 
  message: ChatMessageType;
  isLastMessage?: boolean;
  isComplete?: boolean;
  threadId?: string | null;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isAnalysisCollapsed, setIsAnalysisCollapsed] = useState(true);
  const isAssistant = message.role === 'assistant';
  const isError = message.role === 'error';
  const hasReferences = message.reference_entries && message.reference_entries.length > 0;
  const hasAnalysis = message.analysis_data && Object.keys(message.analysis_data).length > 0;
  const maxReferencesToShowCollapsed = 2;
  
  // Add tutorial-specific class for Step 6 highlighting
  useEffect(() => {
    if (isAssistant && isLastMessage) {
      const messageElement = document.getElementById(`message-${message.id}`);
      if (messageElement) {
        messageElement.classList.add('chat-ai-response');
        
        // Also add class to the content for alternative targeting
        const contentElement = messageElement.querySelector('.message-content');
        if (contentElement) {
          contentElement.classList.add('chat-response-content');
        }
      }
    }
  }, [message.id, isAssistant, isLastMessage]);
  
  // Function to format and structure message content with code blocks, lists, etc
  const formatMessageContent = (content: string) => {
    if (!content) return '';
    
    // Process for SQL blocks
    content = content.replace(/```sql\s*([\s\S]*?)\s*```/g, (match, sql) => {
      return `<div class="bg-gray-100 p-2 my-2 rounded overflow-auto text-sm font-mono dark:bg-gray-800">
                <div class="text-xs text-gray-500 mb-1">SQL Query:</div>
                ${sql.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </div>`;
    });
    
    // Process for code blocks
    content = content.replace(/```(\w*)\s*([\s\S]*?)\s*```/g, (match, language, code) => {
      return `<div class="bg-gray-100 p-2 my-2 rounded overflow-auto text-sm font-mono dark:bg-gray-800">
                ${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </div>`;
    });
    
    // Process for bold text
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Process for italic text
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Process for unordered lists
    content = content.replace(/^\s*[-*]\s+(.*)/gm, '<li>$1</li>');
    content = content.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc ml-5 my-2">$&</ul>');
    
    // Process for ordered lists
    content = content.replace(/^\s*(\d+)\.\s+(.*)/gm, '<li>$2</li>');
    content = content.replace(/(<li>.*<\/li>\n?)+/g, '<ol class="list-decimal ml-5 my-2">$&</ol>');
    
    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    content = content.replace(urlRegex, '<a href="$1" class="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Convert newlines to <br>
    content = content.replace(/\n/g, '<br>');
    
    return content;
  };
  
  const renderReferences = () => {
    if (!hasReferences || !message.reference_entries) return null;
    
    const referencesToShow = isCollapsed 
      ? message.reference_entries.slice(0, maxReferencesToShowCollapsed)
      : message.reference_entries;
      
    const remainingCount = message.reference_entries.length - maxReferencesToShowCollapsed;
    
    return (
      <div className="mt-3 border-t border-gray-200 pt-2">
        <div 
          className="text-sm font-medium text-gray-700 flex items-center cursor-pointer"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <FileSpreadsheet className="w-4 h-4 mr-1" />
          <TranslatableText text="References" />:
          {remainingCount > 0 && isCollapsed && (
            <span className="ml-1 text-xs text-gray-500">
              <TranslatableText 
                text="{count} more entries" 
                values={{ count: remainingCount }} 
              />
            </span>
          )}
          {message.reference_entries.length > maxReferencesToShowCollapsed && (
            <button className="ml-auto text-gray-500 hover:text-gray-700">
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
        
        <div className="mt-2 space-y-2">
          {referencesToShow.map((ref: JournalEntryReference, i) => {
            const { formattedDate, daysAgo, isDateInvalid } = extractReferenceDateInfo(ref.date);
            
            return (
              <div key={i} className="bg-gray-50 p-2 rounded-md text-sm border border-gray-100">
                <div className="flex justify-between items-center">
                  <div className="font-medium">
                    {isDateInvalid ? (
                      <TranslatableText text="Unknown date" />
                    ) : (
                      <>
                        {formattedDate} 
                        <span className="text-xs text-gray-500 ml-1">
                          ({daysAgo})
                        </span>
                      </>
                    )}
                  </div>
                  {ref.sentiment && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {ref.sentiment}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 line-clamp-2">{ref.content}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAnalysisData = () => {
    if (!hasAnalysis || !message.analysis_data) return null;
    
    return (
      <div className="mt-3 border-t border-gray-200 pt-2">
        <div 
          className="text-sm font-medium text-gray-700 flex items-center cursor-pointer"
          onClick={() => setIsAnalysisCollapsed(!isAnalysisCollapsed)}
        >
          <TranslatableText text="Analysis" />:
          <button className="ml-auto text-gray-500 hover:text-gray-700">
            {isAnalysisCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
        
        {!isAnalysisCollapsed && (
          <div className="mt-2 bg-gray-50 p-2 rounded-md text-sm border border-gray-100">
            <pre className="whitespace-pre-wrap text-xs">
              {JSON.stringify(message.analysis_data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      id={`message-${message.id}`}
      className={`p-4 ${isAssistant ? 'bg-white' : 'bg-gray-50'} rounded-lg mb-4 shadow-sm ${
        isLastMessage && isAssistant ? 'chat-ai-response' : ''
      }`}
    >
      <div className="flex items-start">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
          isAssistant ? 'bg-primary/20' : 'bg-gray-200'
        }`}>
          <span className={`text-xs font-bold ${isAssistant ? 'text-primary' : ''}`}>
            {isAssistant ? 'Rūḥ' : 'You'}
          </span>
        </div>
        
        <div className="flex-1 message-content">
          <div className="text-sm text-gray-500 mb-1">
            {message.created_at && (
              <span title={format(new Date(message.created_at), 'PPpp')}>
                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
              </span>
            )}
          </div>
          
          {isError ? (
            <div className="flex items-center text-red-500">
              <AlertTriangle className="w-4 h-4 mr-1" />
              <span>Error</span>
            </div>
          ) : null}
          
          <div 
            className={`prose max-w-none ${isComplete ? '' : 'animate-pulse'}`}
            dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
          />
          
          {/* Optional statistical visualizations for numeric results */}
          {message.has_numeric_result && !isError && (
            <div className="mt-3">
              {/* Visualization would go here */}
            </div>
          )}
          
          {/* References section */}
          {renderReferences()}
          
          {/* Analysis data (for debugging) */}
          {renderAnalysisData()}
          
          {/* Loading spinner for incomplete messages */}
          {!isComplete && (
            <div className="mt-2 flex items-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              <span className="text-sm text-gray-500">
                <TranslatableText text="Thinking..." />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
