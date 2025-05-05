
import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { QueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { generateThreadTitle } from '@/utils/chat/threadUtils';
import { getPlanForQuery } from './threadService';
import { convertGptPlanToQueryPlan } from './queryPlannerService';
import { Json } from '@/integrations/supabase/types';
import { 
  addDays, 
  endOfDay, 
  endOfMonth, 
  endOfWeek, 
  endOfYear, 
  startOfDay, 
  startOfMonth, 
  startOfWeek, 
  startOfYear, 
  subDays, 
  subMonths, 
  subWeeks, 
  subYears 
} from "date-fns";

export interface ChatMessageType {
  id: string;
  threadId: string;
  content: string;
  sender: 'user' | 'assistant';
  createdAt: string;
  references?: any[] | Json | null;  // Updated to accept Json type as well
  isLoading?: boolean;
  isError?: boolean;
}

export interface ChatThreadType {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Calculates relative date ranges based on time expressions, using the client's local time
 * @param timePeriod - The time period expression (e.g., "this month", "last week")
 * @returns Date range with start and end dates in ISO format
 */
export function calculateClientDateRange(timePeriod: string): { startDate: string, endDate: string, periodName: string } {
  console.log(`Calculating client-side date range for "${timePeriod}"`);
  
  // Use the client's device time as the source of truth
  const now = new Date(); 
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  
  console.log(`Client local time: ${now.toISOString()} (${now.toLocaleDateString()})`);
  
  const lowerTimePeriod = timePeriod.toLowerCase();
  
  try {
    if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
      // Today
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      periodName = 'today';
    } 
    else if (lowerTimePeriod.includes('yesterday')) {
      // Yesterday
      const yesterday = subDays(now, 1);
      startDate = startOfDay(yesterday);
      endDate = endOfDay(yesterday);
      periodName = 'yesterday';
    } 
    else if (lowerTimePeriod.includes('this week')) {
      // This week (Monday to Sunday)
      startDate = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
      endDate = endOfWeek(now, { weekStartsOn: 1 }); // End on Sunday
      periodName = 'this week';
    } 
    else if (lowerTimePeriod.includes('last week')) {
      // Last week (previous Monday to Sunday)
      const lastWeek = subWeeks(now, 1);
      startDate = startOfWeek(lastWeek, { weekStartsOn: 1 }); // Start on last Monday
      endDate = endOfWeek(lastWeek, { weekStartsOn: 1 }); // End on last Sunday
      periodName = 'last week';
    } 
    else if (lowerTimePeriod.includes('this month')) {
      // This month
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      periodName = 'this month';
    } 
    else if (lowerTimePeriod.includes('last month')) {
      // Last month
      const lastMonth = subMonths(now, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      periodName = 'last month';
    } 
    else if (lowerTimePeriod.includes('this year')) {
      // This year
      startDate = startOfYear(now);
      endDate = endOfYear(now);
      periodName = 'this year';
    } 
    else if (lowerTimePeriod.includes('last year')) {
      // Last year
      const lastYear = subYears(now, 1);
      startDate = startOfYear(lastYear);
      endDate = endOfYear(lastYear);
      periodName = 'last year';
    } 
    else {
      // Default to last 30 days if no specific period matched
      startDate = startOfDay(subDays(now, 30));
      endDate = endOfDay(now);
      periodName = 'last 30 days';
    }
  } catch (calcError) {
    console.error('Error in date calculation:', calcError);
    // Fallback to a simple date range calculation
    startDate = startOfDay(subDays(now, 7));
    endDate = endOfDay(now);
    periodName = 'last 7 days (error fallback)';
  }

  // Convert to ISO format for consistent storage
  const isoStartDate = startDate.toISOString();
  const isoEndDate = endDate.toISOString();
  
  // Log the calculated dates for debugging
  console.log(`Client date range calculated: 
    Start: ${isoStartDate} (${startDate.toLocaleDateString()})
    End: ${isoEndDate} (${endDate.toLocaleDateString()})
    Period: ${periodName}
    Duration in days: ${Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))}`);
  
  return {
    startDate: isoStartDate,
    endDate: isoEndDate,
    periodName
  };
}

/**
 * Detects time-related expressions in a query and calculates a date range
 * @param query - The user's query text
 * @returns A date range object if a time expression is found, null otherwise
 */
export function detectTimeExpressionAndCalculateRange(query: string): { startDate: string, endDate: string, periodName: string } | null {
  // List of common time expressions to detect
  const timeExpressions = [
    'today', 'yesterday', 
    'this week', 'last week', 
    'this month', 'last month', 
    'this year', 'last year',
    'past week', 'past month', 'past year',
    'previous week', 'previous month', 'previous year',
    'recent', 'lately'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check for date expressions
  for (const expression of timeExpressions) {
    if (lowerQuery.includes(expression)) {
      console.log(`Detected time expression "${expression}" in query: "${query}"`);
      return calculateClientDateRange(expression);
    }
  }
  
  // Check for "last X days/weeks/months/years" pattern
  const lastNPattern = /last\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/i;
  const lastNMatch = lowerQuery.match(lastNPattern);
  
  if (lastNMatch) {
    const amount = parseInt(lastNMatch[1], 10);
    const unit = lastNMatch[2].toLowerCase();
    console.log(`Detected "last ${amount} ${unit}" in query`);
    
    const now = new Date();
    let startDate: Date;
    let endDate = endOfDay(now);
    
    if (unit.startsWith('day')) {
      startDate = startOfDay(subDays(now, amount));
    } else if (unit.startsWith('week')) {
      startDate = startOfDay(subWeeks(now, amount));
    } else if (unit.startsWith('month')) {
      startDate = startOfDay(subMonths(now, amount));
    } else if (unit.startsWith('year')) {
      startDate = startOfDay(subYears(now, amount));
    } else {
      return null;
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      periodName: `last ${amount} ${unit}`
    };
  }
  
  // Handle specific date
  const specificDatePattern = /(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}|\d{2}))?/;
  const dateMatch = lowerQuery.match(specificDatePattern);
  
  if (dateMatch) {
    try {
      // Try to parse the date, considering ambiguities in dd/mm vs mm/dd formats
      // Default to current year if not specified
      const now = new Date();
      let day = parseInt(dateMatch[1], 10);
      let month = parseInt(dateMatch[2], 10) - 1; // JS months are 0-indexed
      let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
      
      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      
      // Try to create a valid date object
      const specificDate = new Date(year, month, day);
      
      // Check if the date is valid
      if (isNaN(specificDate.getTime())) {
        console.error('Invalid date detected:', dateMatch[0]);
        return null;
      }
      
      const startOfSpecificDate = startOfDay(specificDate);
      const endOfSpecificDate = endOfDay(specificDate);
      
      return {
        startDate: startOfSpecificDate.toISOString(),
        endDate: endOfSpecificDate.toISOString(),
        periodName: `on ${specificDate.toLocaleDateString()}`
      };
    } catch (error) {
      console.error('Error parsing specific date:', error);
      return null;
    }
  }
  
  return null;
}

export function useChatPersistence(queryClient: QueryClient) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThreadType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    // Reset state when user changes
    if (!user) {
      setMessages([]);
      setActiveThread(null);
      setLoading(false);
    }
  }, [user]);

  // Function to create a new thread
  const createThread = useCallback(async () => {
    if (!user) {
      console.error("User must be authenticated to create a thread");
      return null;
    }

    setLoading(true);
    try {
      const threadId = uuidv4();
      const { error } = await supabase.from('chat_threads').insert({
        id: threadId,
        user_id: user.id,
        title: 'New Conversation'
      });

      if (error) throw error;

      const newThread: ChatThreadType = {
        id: threadId,
        userId: user.id,
        title: 'New Conversation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setActiveThread(newThread);
      setMessages([]);
      
      // Fix the InvalidateQueryFilters error by using the correct format
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      
      return threadId;
    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        title: "Error",
        description: "Failed to create a new conversation thread.",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, queryClient]);

  // Function to load a thread by ID
  const loadThread = useCallback(async (threadId: string) => {
    if (!user || !threadId) {
      return;
    }

    setLoading(true);
    try {
      // First fetch thread metadata
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single();

      if (threadError) throw threadError;
      
      if (!threadData) {
        console.error("Thread not found");
        setActiveThread(null);
        setMessages([]);
        return;
      }

      // Set active thread
      const thread: ChatThreadType = {
        id: threadData.id,
        userId: threadData.user_id,
        title: threadData.title,
        createdAt: threadData.created_at,
        updatedAt: threadData.updated_at
      };
      
      setActiveThread(thread);
      
      // Then fetch messages for this thread
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Fixed: Properly type the message data and handle references safely
      const formattedMessages: ChatMessageType[] = (messagesData || []).map(msg => ({
        id: msg.id,
        threadId: msg.thread_id,
        content: msg.content,
        sender: (msg.sender === 'user' || msg.sender === 'assistant') ? msg.sender : 'assistant',
        createdAt: msg.created_at,
        references: msg.reference_entries  // This can be any[] | Json | null
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error("Error loading thread:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation thread.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Function to add a user message and get a response
  const sendMessage = useCallback(async (content: string) => {
    if (!user) {
      console.error("User must be authenticated to send messages");
      return;
    }

    // Create a new thread if needed
    let threadId = activeThread?.id;
    let isFirstMessage = false;
    
    if (!threadId) {
      threadId = await createThread();
      if (!threadId) return;
      isFirstMessage = true;
    }

    setIsSaving(true);

    try {
      // Add user message to UI immediately with loading state
      const userMessageId = uuidv4();
      const userMessage: ChatMessageType = {
        id: userMessageId,
        threadId,
        content,
        sender: 'user',
        createdAt: new Date().toISOString(),
      };

      const assistantMessageId = uuidv4();
      const assistantMessage: ChatMessageType = {
        id: assistantMessageId,
        threadId,
        content: '',
        sender: 'assistant',
        createdAt: new Date().toISOString(),
        isLoading: true
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);

      // Save user message to database
      const { error: saveError } = await supabase.from('chat_messages').insert({
        id: userMessageId,
        thread_id: threadId,
        content,
        sender: 'user',
        role: 'user' // Make sure role is set correctly
      });

      if (saveError) throw saveError;
      
      // Dispatch event that message was created
      window.dispatchEvent(
        new CustomEvent('messageCreated', { 
          detail: { 
            threadId, 
            messageId: userMessageId,
            isFirstMessage
          } 
        })
      );
      
      // Update the thread's updated_at timestamp
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);

      // CLIENT-SIDE DATE RANGE CALCULATION
      // Check if the query contains time-related expressions and calculate date range
      const detectedDateRange = detectTimeExpressionAndCalculateRange(content);
      console.log("Detected date range from client:", detectedDateRange);
      
      // Get a JavaScript Date object for the user's local timezone
      const clientTime = new Date();
      console.log(`Client local time: ${clientTime.toISOString()} (${clientTime.toLocaleDateString()})`);
      
      // Call edge function to ensure persistence and include the client's current timestamp
      const { data: persistenceData, error: persistenceError } = await supabase.functions.invoke('ensure-chat-persistence', {
        body: {
          userId: user.id,
          threadId,
          messageId: userMessageId,
          content,
          clientTime: clientTime.toISOString(), // Send the client's current time as the source of truth
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone // Send the timezone name
        }
      });

      if (persistenceError) {
        console.error("Error ensuring persistence:", persistenceError);
      }

      // Get the conversation context for query planning
      const contextMessages = messages.map(msg => ({
        content: msg.content,
        sender: msg.sender
      }));

      // Get query plan based on user's message and include the client-detected date range
      const { plan, queryType, directResponse } = await getPlanForQuery(
        content, 
        user.id, 
        contextMessages, 
        detectedDateRange // Fixed: Passing the object directly as expected by getPlanForQuery
      );
      
      let apiResponse: any = null;
      let references: any[] = [];

      if (directResponse) {
        // If we got a direct response, use it
        apiResponse = { data: directResponse };
      } else if (queryType !== 'journal_specific' || !plan) {
        // If not a journal query or no plan, use the smart-chat endpoint
        const { data, error } = await supabase.functions.invoke('smart-chat', {
          body: {
            userId: user.id,
            message: content,
            threadId,
            clientDetectedTimeRange: detectedDateRange, // Use client-detected time range instead of server calculation
            clientTime: clientTime.toISOString() // Send client time as source of truth
          }
        });
        
        apiResponse = { data, error };
      } else {
        // For journal queries with a plan, use the chat-with-rag endpoint
        const queryPlan = convertGptPlanToQueryPlan(plan);
        
        // If the plan doesn't already have a date range but we detected one, add it
        if (!queryPlan.filters.dateRange && detectedDateRange) {
          queryPlan.filters.dateRange = detectedDateRange;
        }
        
        const { data, error } = await supabase.functions.invoke('chat-with-rag', {
          body: {
            userId: user.id,
            message: content,
            threadId,
            conversationContext: contextMessages,
            queryPlan,
            includeDiagnostics: false,
            clientTime: clientTime.toISOString() // Send client time as source of truth
          }
        });
        
        if (data?.references) {
          references = data.references;
        }
        
        apiResponse = { 
          data: data?.response || data?.data, 
          error,
          noEntriesForTimeRange: data?.noEntriesForTimeRange,
          entryDateRange: data?.entryDateRange
        };
      }

      if (apiResponse.error) {
        throw apiResponse.error;
      }

      // If we get a warning about no entries for a time range
      if (apiResponse.noEntriesForTimeRange) {
        console.log("No entries for specified time range");
      }
      
      // If we have entry date range info, log it
      if (apiResponse.entryDateRange) {
        console.log("Entry date range:", apiResponse.entryDateRange);
      }

      // Save assistant response to database
      const assistantContent = apiResponse.data || "I'm sorry, I couldn't generate a response.";
      
      const { error: assistantSaveError } = await supabase.from('chat_messages').insert({
        id: assistantMessageId,
        thread_id: threadId,
        content: assistantContent,
        sender: 'assistant',
        role: 'assistant', // Make sure role is set correctly
        reference_entries: references.length > 0 ? references : null
      });

      if (assistantSaveError) throw assistantSaveError;

      // Update assistant message in UI
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: assistantContent, isLoading: false, references }
          : msg
      ));

      // Update thread timestamp again after assistant response
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
      
      // Fix the InvalidateQueryFilters error by using the correct format
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      
      return {
        userMessageId,
        assistantMessageId,
        threadId,
        response: assistantContent
      };
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Update assistant message with error
      setMessages(prev => prev.map(msg => 
        msg.sender === 'assistant' && msg.isLoading 
          ? { 
              ...msg, 
              content: "I'm sorry, I encountered an error while processing your request. Please try again.", 
              isLoading: false,
              isError: true
            }
          : msg
      ));
      
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [user, activeThread, messages, createThread, queryClient]);

  // Function to generate or update thread title
  const updateThreadTitle = useCallback(async (threadId: string, newTitle?: string) => {
    if (!user || !threadId) return;
    
    try {
      let title = newTitle;
      
      // If no title provided, generate one
      if (!title) {
        title = await generateThreadTitle(threadId, user.id);
        if (!title) return;
      }
      
      // Update in database
      const { error } = await supabase
        .from('chat_threads')
        .update({ title })
        .eq('id', threadId);
      
      if (error) throw error;
      
      // Update local state if this is the active thread
      if (activeThread?.id === threadId) {
        setActiveThread(prev => prev ? { ...prev, title } : null);
      }
      
      // Fix the InvalidateQueryFilters error by using the correct format
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      
      // Dispatch event that thread title was updated
      window.dispatchEvent(
        new CustomEvent('threadTitleUpdated', { 
          detail: { threadId, title } 
        })
      );
      
      return title;
    } catch (error) {
      console.error("Error updating thread title:", error);
      return null;
    }
  }, [user, activeThread, queryClient]);

  return {
    messages,
    activeThread,
    loading,
    isSaving,
    createThread,
    loadThread,
    sendMessage,
    updateThreadTitle,
    setActiveThread
  };
}
