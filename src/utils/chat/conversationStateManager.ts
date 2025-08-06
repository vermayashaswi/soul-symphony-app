
import { ChatMessage } from '@/types/chat';
import { analyzeMentalHealthContent, extractConversationInsights, isPersonalizedHealthQuery } from './messageProcessor';
import { Json } from '@/integrations/supabase/types';
import { isThreadMetadata } from '@/services/chat/types';

// Export the IntentType type
export type IntentType = 'new_query' | 'followup_time' | 'multi_part' | 'mental_health' | 'clarification_response' | 'direct_response';

export class ConversationStateManager {
  messages: ChatMessage[];
  timeContext: string | null;
  topicContext: string | null;
  confidenceScore: number;
  needsClarity: boolean;
  intentType: IntentType;
  ambiguities: string[];
  domainContext: string | null;
  threadId: string | null;
  userId: string | null;
  
  constructor(threadId?: string, userId?: string) {
    this.messages = [];
    this.timeContext = null;
    this.topicContext = null;
    this.confidenceScore = 1.0;
    this.needsClarity = false;
    this.intentType = 'new_query';
    this.ambiguities = [];
    this.domainContext = null;
    this.threadId = threadId || null;
    this.userId = userId || null;
  }
  
  /**
   * Add a new message to the conversation and update state
   */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.analyzeConversationState();
  }
  
  /**
   * Analyze the conversation to determine state
   */
  private analyzeConversationState(): void {
    const insights = extractConversationInsights(this.messages);
    
    // Update time context if we have time references
    if (insights.timeReferences.length > 0) {
      this.timeContext = insights.timeReferences[0]; // Use most recent
    }
    
    // Update topic context if we have topics
    if (insights.topics.length > 0) {
      this.topicContext = insights.topics[0]; // Use most recent
    }
    
    // Check if the most recent user message needs clarity
    const userMessages = this.messages.filter(m => m.role === 'user' || m.sender === 'user');
    if (userMessages.length > 0) {
      const latestUserMessage = userMessages[userMessages.length - 1];
      this.needsClarity = this.checkIfNeedsClarification(latestUserMessage.content);
      
      // Analyze intent for the latest message
      this.analyzeIntent(latestUserMessage.content);
    }
    
    // Determine domain context
    if (insights.mentalHealthTopics.length > 0) {
      this.domainContext = 'mental_health';
    } else if (this.topicContext && this.messages.length > 0) {
      const lastMessage = this.messages[this.messages.length - 1];
      if (isPersonalizedHealthQuery(lastMessage.content)) {
        this.domainContext = 'mental_health';
      }
    }
  }
  
  /**
   * Check if a message needs clarification
   */
  private checkIfNeedsClarification(message: string): boolean {
    // Very short queries without questions likely need clarification
    if (message.length < 10 && !message.includes('?')) {
      this.ambiguities = ["Very short query"];
      return true;
    }
    
    // Check for vague requests that don't specify what to analyze
    if (/\b(analyze|check|tell me about)\b/i.test(message) && 
        !/(my|about) ([a-z\s]{3,25})/i.test(message)) {
      this.ambiguities = ["Vague request without specific topic"];
      return true;
    }
    
    return false;
  }
  
  /**
   * Analyze the intent of a message - Make it public for external use
   */
  public analyzeIntent(message: string): IntentType {
    const lowerMessage = message.toLowerCase();
    
    // Check if this is a clarification response
    if (this.needsClarity && this.messages.length > 1) {
      const prevMessages = this.messages.slice(-3); // Last 3 messages
      const prevAssistant = prevMessages.find(m => m.role === 'assistant' || m.sender === 'assistant');
      
      if (prevAssistant && this.containsClarificationRequest(prevAssistant.content)) {
        this.intentType = 'clarification_response';
        this.needsClarity = false;
        return this.intentType;
      }
    }
    
    // Check if this is a time-based follow-up
    if (this.isTimeFollowUp(message)) {
      this.intentType = 'followup_time';
      return this.intentType;
    }
    
    // Check if this is a multi-part question
    if (this.isMultiPartQuestion(message)) {
      this.intentType = 'multi_part';
      return this.intentType;
    }
    
    // Check if this is a mental health query
    if (analyzeMentalHealthContent(message) > 0.4) {
      this.intentType = 'mental_health';
      this.domainContext = 'mental_health';
      return this.intentType;
    }
    
    // Default to new query
    this.intentType = 'new_query';
    return this.intentType;
  }
  
  /**
   * Check if a message contains a clarification request
   */
  private containsClarificationRequest(message: string): boolean {
    const clarificationPatterns = [
      /could you (please )?(clarify|specify|provide more details)/i,
      /i('m| am) not sure (exactly )?what you('re| are) (asking|looking for)/i,
      /could you (please )?be more specific/i,
      /i need more (information|details|context)/i
    ];
    
    return clarificationPatterns.some(pattern => pattern.test(message));
  }
  
  /**
   * Check if a message is a time-based follow-up
   */
  private isTimeFollowUp(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    
    // Time reference patterns
    const timePatterns = [
      /^(what|how) about (yesterday|today|this week|last week|this month|last month)/i,
      /^(yesterday|today|this week|last week|this month|last month)(\?|\.)?$/i
    ];
    
    // Check if any pattern matches
    return timePatterns.some(pattern => pattern.test(lowerMessage));
  }
  
  /**
   * Check if a message is a multi-part question
   */
  private isMultiPartQuestion(message: string): boolean {
    // Check for multiple question marks
    if ((message.match(/\?/g) || []).length > 1) {
      return true;
    }
    
    // Check for conjunctions between different questions
    const parts = message.split(/\.|\?/).filter(p => p.trim().length > 0);
    if (parts.length > 1) {
      // Check if multiple parts contain question words
      const questionParts = parts.filter(p => 
        /(what|how|when|where|why|who|is|are|do|does|did)/i.test(p.trim())
      );
      if (questionParts.length > 1) {
        return true;
      }
    }
    
    // Check for "and" or "also" connecting different question topics
    return /\b(and|also)\b.+\b(what|how|when|where|why|who|is|are|do|does|did)\b/i.test(message);
  }
  
  /**
   * Get metadata for thread storage
   */
  getMetadata(): Record<string, any> {
    return {
      timeContext: this.timeContext,
      topicContext: this.topicContext,
      intentType: this.intentType,
      confidenceScore: this.confidenceScore,
      needsClarity: this.needsClarity,
      ambiguities: this.ambiguities,
      domainContext: this.domainContext,
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * Update state from stored metadata
   */
  loadFromMetadata(metadata: Record<string, any>): void {
    if (!metadata) return;
    
    this.timeContext = metadata.timeContext || null;
    this.topicContext = metadata.topicContext || null;
    this.intentType = (metadata.intentType as IntentType) || 'new_query';
    this.confidenceScore = metadata.confidenceScore || 1.0;
    this.needsClarity = metadata.needsClarity || false;
    this.ambiguities = metadata.ambiguities || [];
    this.domainContext = metadata.domainContext || null;
  }
  
  /**
   * Load state from database - public method for threadService
   */
  public async loadState(): Promise<Record<string, any> | null> {
    if (!this.threadId || !this.userId) return null;
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('chat_threads')
        .select('metadata')
        .eq('id', this.threadId)
        .eq('user_id', this.userId)
        .single();
        
      if (error || !data) {
        console.error('Error loading conversation state:', error);
        return null;
      }
      
      // Reset state for thread without metadata
      this.resetState();
      
      return null;
    } catch (error) {
      console.error('Error loading conversation state:', error);
      return null;
    }
  }
  
  /**
   * Create new state object from analysis
   */
  public async createState(query: string, queryPlan: any, intentType: IntentType): Promise<Record<string, any>> {
    // Combine existing state with new query plan insights
    return {
      timeContext: queryPlan.timeContext || this.timeContext,
      topicContext: queryPlan.topicContext || this.topicContext,
      intentType: intentType,
      confidenceScore: queryPlan.confidenceScore || 0.8,
      needsClarity: queryPlan.needsMoreContext || false,
      ambiguities: queryPlan.ambiguities || [],
      domainContext: queryPlan.domainContext || this.domainContext,
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * Save state to database
   */
  public async saveState(state: Record<string, any>): Promise<boolean> {
    if (!this.threadId || !this.userId) return false;
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase
        .from('chat_threads')
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq('id', this.threadId)
        .eq('user_id', this.userId);
        
      if (error) {
        console.error('Error saving conversation state:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error saving conversation state:', error);
      return false;
    }
  }

  /**
   * Reset state to defaults
   */
  private resetState(): void {
    this.timeContext = null;
    this.topicContext = null;
    this.confidenceScore = 1.0;
    this.needsClarity = false;
    this.intentType = 'new_query';
    this.ambiguities = [];
    this.domainContext = null;
  }
}
