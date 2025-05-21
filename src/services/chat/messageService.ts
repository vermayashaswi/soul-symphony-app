import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatThread, SubQueryResponse, TimeAnalysis } from './types';
import { Json } from "@/integrations/supabase/types";

/**
 * Process a user message with structured prompt approach
 * This supports more complex analysis, especially for mental health queries
 */
export async function processWithStructuredPrompt(
  message: string,
  userId: string,
  references: any[],
  threadId: string
): Promise<{ data: string, analysis?: TimeAnalysis }> {
  try {
    console.log(`Processing with structured prompt for thread ${threadId}`);
    
    // Generate time analysis based on provided references
    const timeAnalysis = generateTimeAnalysis(references);
    
    // Detect if this is a mental health query
    const isMentalHealthQuery = detectMentalHealthQuery(message);
    
    // Create a structured prompt based on the journal entries
    const promptData = {
      query: message,
      references: references.map(ref => ({
        date: ref.date || ref.created_at,
        content: ref.content || ref.transcription_text || ref.refined_text || ref.snippet,
        emotions: ref.emotions,
        themes: ref.themes || ref.master_themes,
      })),
      userId,
      threadId,
      timeAnalysis,
      isMentalHealthQuery,
    };

    // Call the structured-chat edge function with our data
    const { data, error } = await supabase.functions.invoke('structured-chat', {
      body: promptData
    });

    if (error) {
      console.error("Error calling structured-chat function:", error);
      throw new Error(`Error processing message: ${error.message}`);
    }

    // Return the response data
    return { 
      data: data?.response || "I couldn't analyze your journal entries at this time.",
      analysis: timeAnalysis
    };
  } catch (error) {
    console.error("Error in processWithStructuredPrompt:", error);
    return { 
      data: "I encountered an issue analyzing your journal entries. Please try again later."
    };
  }
}

/**
 * Generate time analysis based on journal entries
 */
function generateTimeAnalysis(references: any[]): TimeAnalysis {
  // Initialize counters
  const hourCounts: Record<number, number> = {};
  const timePeriods = {
    morning: 0,   // 5am-11:59am
    afternoon: 0, // 12pm-4:59pm
    evening: 0,   // 5pm-8:59pm
    night: 0      // 9pm-4:59am
  };
  
  // Process each entry
  references.forEach(entry => {
    if (!entry.date && !entry.created_at) return;
    
    const date = new Date(entry.date || entry.created_at);
    const hour = date.getHours();
    
    // Count by hour
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    
    // Count by time period
    if (hour >= 5 && hour < 12) {
      timePeriods.morning++;
    } else if (hour >= 12 && hour < 17) {
      timePeriods.afternoon++;
    } else if (hour >= 17 && hour < 21) {
      timePeriods.evening++;
    } else {
      timePeriods.night++;
    }
  });
  
  // Find peak hours (top 3)
  const hourEntries = Object.entries(hourCounts)
    .map(([hour, count]) => ({
      hour: parseInt(hour),
      count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  
  // Format peak hours with labels
  const peakHours = hourEntries.map(entry => {
    let label;
    const hour = entry.hour;
    if (hour === 0) {
      label = "12am";
    } else if (hour < 12) {
      label = `${hour}am`;
    } else if (hour === 12) {
      label = "12pm";
    } else {
      label = `${hour - 12}pm`;
    }
    return { hour, label, count: entry.count };
  });
  
  return {
    totalEntries: references.length,
    peakHours,
    timePeriods
  };
}

/**
 * Enhanced detection of mental health related queries
 */
function detectMentalHealthQuery(message: string): boolean {
  const mentalHealthKeywords = [
    'mental health', 'anxiety', 'depression', 'stress', 'mood', 'emotion', 
    'feeling', 'therapy', 'therapist', 'psychiatrist', 'psychologist', 
    'counselor', 'counseling', 'wellbeing', 'well-being', 'wellness',
    'self-care', 'burnout', 'overwhelm', 'mindfulness', 'meditation',
    'coping', 'psychological', 'emotional health', 'distress', 'worried',
    'sad', 'upset', 'frustrated', 'angry', 'happiness', 'happy', 'unhappy',
    'content', 'discontent', 'satisfied', 'unsatisfied', 'fulfilled'
  ];
  
  const lowerMessage = message.toLowerCase();
  
  // Direct keyword check
  for (const keyword of mentalHealthKeywords) {
    if (lowerMessage.includes(keyword)) {
      return true;
    }
  }
  
  // Check for phrases commonly used in mental health contexts
  const mentalHealthPatterns = [
    /\b(?:i (?:feel|am feeling|have been feeling))\b/i,
    /\b(?:help|improve) (?:my|with) (?:mental|emotional)/i,
    /\b(?:my|with) (?:mental|emotional) (?:health|state|wellbeing)/i,
    /\bhow (?:to|can i|should i) (?:feel better|improve|help)/i,
    /\badvice (?:for|on|about) (?:my|dealing with|handling)/i,
    /\bi (?:can't|cannot|don't|do not) (?:cope|handle|manage|deal)/i,
    /\bam i (?:okay|happy|sad|depressed|anxious|good enough)/i,
    /\bwhy (?:am i|do i feel|can't i|is it so hard)/i,
    /\bhow (?:do i|can i|should i|best|better to) (?:cope|handle|manage|deal)/i
  ];
  
  for (const pattern of mentalHealthPatterns) {
    if (pattern.test(lowerMessage)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Process a complex query by breaking it into sub-queries and assembling the responses
 */
export async function processComplexQuery(
  query: string, 
  userId: string,
  threadId: string
): Promise<SubQueryResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('segment-complex-query', {
      body: { query, userId }
    });
    
    if (error) throw error;
    
    // If the query couldn't be segmented, treat it as a single query
    if (!data || !data.segments || data.segments.length === 0) {
      return {
        message: "Could not process complex query"
      };
    }
    
    const segments = data.segments;
    const responses: any[] = [];
    
    // Process each segment
    for (const segment of segments) {
      try {
        // Process each segment as its own message
        const response = await processMessageForSegment(segment, userId, threadId);
        responses.push({
          segment: segment,
          response: response
        });
      } catch (segError) {
        console.error(`Error processing segment "${segment}":`, segError);
        responses.push({
          segment: segment,
          error: segError.message
        });
      }
    }
    
    // Combine the responses
    const { data: combinedData, error: combineError } = await supabase.functions.invoke('combine-segment-responses', {
      body: { 
        originalQuery: query, 
        segmentResponses: responses,
        userId
      }
    });
    
    if (combineError) throw combineError;
    
    return {
      message: combinedData.response,
      query: query,
      response: combinedData.response,
      subQueries: segments,
      subResponses: responses.map(r => r.response),
    };
    
  } catch (error) {
    console.error("Error processing complex query:", error);
    return {
      message: "Error processing your complex question. Please try asking one question at a time."
    };
  }
}

// Helper function to process a single segment
async function processMessageForSegment(message: string, userId: string, threadId: string) {
  // This is simplified - you would use your main message processing logic here
  return "Segment response placeholder";
}

// Basic CRUD functions for chat threads and messages
export async function getUserChatThreads(userId: string): Promise<ChatThread[]> {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
      
    if (error) throw error;
    
    // Convert database response to ChatThread[] type with proper typing for metadata
    return data ? data.map(thread => ({
      ...thread,
      processing_status: thread.processing_status as 'idle' | 'processing' | 'failed',
      metadata: thread.metadata ? 
        (typeof thread.metadata === 'string' ? 
          JSON.parse(thread.metadata) : 
          thread.metadata) as ChatThread['metadata']
    })) : [];
  } catch (error) {
    console.error('Error fetching user chat threads:', error);
    return [];
  }
}

export async function getThreadMessages(threadId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    // Convert database response to ChatMessage[] type with proper type conversions
    return data ? data.map(msg => {
      // Safely parse JSON fields or keep as is if already parsed
      const reference_entries = msg.reference_entries ? 
        (typeof msg.reference_entries === 'string' ? 
          JSON.parse(msg.reference_entries) : 
          msg.reference_entries) as any[] | null : null;
          
      const analysis_data = msg.analysis_data ? 
        (typeof msg.analysis_data === 'string' ? 
          JSON.parse(msg.analysis_data) : 
          msg.analysis_data) : null;
          
      const sub_query_responses = msg.sub_query_responses ? 
        (typeof msg.sub_query_responses === 'string' ? 
          JSON.parse(msg.sub_query_responses) : 
          msg.sub_query_responses) as SubQueryResponse[] | null : null;

      return {
        ...msg,
        sender: msg.sender as 'user' | 'assistant' | 'error',
        role: msg.role as 'user' | 'assistant' | 'error',
        reference_entries: reference_entries,
        analysis_data: analysis_data,
        references: reference_entries,
        analysis: analysis_data,
        hasNumericResult: msg.has_numeric_result,
        sub_query_responses: sub_query_responses
      } as ChatMessage;
    }) : [];
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    return [];
  }
}

export async function saveMessage(
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant' | 'error',
  references?: any[] | null, 
  analysis?: any | null,
  hasNumericResult?: boolean,
  isInteractive?: boolean,
  interactiveOptions?: any[]
): Promise<ChatMessage | null> {
  try {
    // Prepare data for database insertion
    const messageData = {
      thread_id: threadId,
      content: content,
      sender: sender,
      role: sender,
      created_at: new Date().toISOString(),
      reference_entries: references || null,
      analysis_data: analysis || null,
      has_numeric_result: hasNumericResult || false,
      is_processing: false
    };
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();
      
    if (error) throw error;
    
    if (!data) throw new Error('No data returned from message insert');
    
    // Convert the response to our ChatMessage type
    const reference_entries = data.reference_entries ? 
      (typeof data.reference_entries === 'string' ? 
        JSON.parse(data.reference_entries) : 
        data.reference_entries) : null;
        
    const analysis_data = data.analysis_data ? 
      (typeof data.analysis_data === 'string' ? 
        JSON.parse(data.analysis_data) : 
        data.analysis_data) : null;

    const chatMessage: ChatMessage = {
      ...data,
      sender: data.sender as 'user' | 'assistant' | 'error',
      role: data.role as 'user' | 'assistant' | 'error',
      reference_entries: reference_entries as any[] | null,
      references: reference_entries as any[] | null,
      analysis_data: analysis_data,
      analysis: analysis_data,
      hasNumericResult: data.has_numeric_result,
      isInteractive: isInteractive || false,
      interactiveOptions: interactiveOptions || []
    };
    
    return chatMessage;
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

export async function createThread(userId: string, title: string = 'New Conversation'): Promise<ChatThread> {
  try {
    const threadId = uuidv4();
    const thread = {
      id: threadId,
      user_id: userId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      processing_status: 'idle' as const
    };
    
    const { data, error } = await supabase
      .from('chat_threads')
      .insert(thread)
      .select()
      .single();
      
    if (error) throw error;
    
    if (!data) throw new Error('No data returned from thread insert');
    
    // Convert the response to our ChatThread type
    const metadata = data.metadata ? 
      (typeof data.metadata === 'string' ? 
        JSON.parse(data.metadata) : 
        data.metadata) : undefined;

    return {
      ...data,
      processing_status: data.processing_status as 'idle' | 'processing' | 'failed',
      metadata: metadata as ChatThread['metadata']
    };
  } catch (error) {
    console.error('Error creating thread:', error);
    throw error;
  }
}

export async function updateThreadTitle(threadId: string, title: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', threadId);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error updating thread title:', error);
    throw error;
  }
}

// Add timezone utility function
export function getUserTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

// Re-export the existing function
export * from './types';
