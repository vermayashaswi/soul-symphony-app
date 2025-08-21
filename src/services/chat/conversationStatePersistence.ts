import { supabase } from '@/integrations/supabase/client';
import { ConversationalFlowManager } from './conversationalFlowManager';
import { ConversationStateManager, IntentType } from '@/utils/chat/conversationStateManager';

export interface ConversationPersistenceState {
  threadId: string;
  userId: string;
  conversationState?: any;
  flowState?: any;
  lastInteraction?: string;
  sessionContext?: any;
}

export class ConversationStatePersistence {
  private stateManager: ConversationStateManager;
  private flowManager: ConversationalFlowManager;
  
  constructor(threadId: string, userId: string) {
    this.stateManager = new ConversationStateManager(threadId, userId);
    this.flowManager = new ConversationalFlowManager();
  }

  /**
   * PHASE 1: Load conversation state from database when resuming a session
   */
  async loadConversationState(): Promise<void> {
    try {
      console.log('[ConversationPersistence] Loading conversation state');
      
      // Load conversation state manager data
      await this.stateManager.loadState();
      
      // Load thread metadata for additional context
      const { data: threadData, error } = await supabase
        .from('chat_threads')
        .select('metadata, updated_at')
        .eq('id', this.stateManager.threadId)
        .eq('user_id', this.stateManager.userId)
        .single();

      if (error || !threadData) {
        console.warn('[ConversationPersistence] No existing thread state found');
        return;
      }

      // Load the last few messages for context restoration
      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('content, sender, created_at')
        .eq('thread_id', this.stateManager.threadId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentMessages && recentMessages.length > 0) {
        console.log('[ConversationPersistence] Restored conversation context with', recentMessages.length, 'messages');
        
        // Analyze flow state from recent messages
        const conversationContext = recentMessages.reverse().map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.created_at
        }));

        // Re-analyze conversational flow to restore state
        if (this.stateManager.threadId) {
          this.flowManager.analyzeConversationalFlow(
            this.stateManager.threadId,
            conversationContext[conversationContext.length - 1]?.content || '',
            conversationContext
          );
        }
      }

    } catch (error) {
      console.error('[ConversationPersistence] Error loading conversation state:', error);
    }
  }

  /**
   * PHASE 2: Save conversation state after each interaction
   */
  async saveConversationState(
    userMessage: string, 
    assistantResponse: string,
    intentType: IntentType,
    additionalContext: Record<string, any> = {}
  ): Promise<void> {
    try {
      console.log('[ConversationPersistence] Saving conversation state');

      // Update conversation state manager
      this.stateManager.analyzeIntent(userMessage);
      
      // Get current metadata
      const currentMetadata = this.stateManager.getMetadata();
      
      // Get conversation insights from flow manager
      const conversationInsights = this.stateManager.threadId ? 
        this.flowManager.getConversationInsights(this.stateManager.threadId) : null;

      // Combine all state data
      const enhancedMetadata = {
        ...currentMetadata,
        lastUserMessage: userMessage,
        lastAssistantResponse: assistantResponse.slice(0, 200), // Store truncated version
        lastInteractionAt: new Date().toISOString(),
        intentType,
        conversationInsights,
        ...additionalContext
      };

      // Save to thread metadata
      await this.stateManager.saveState(enhancedMetadata);
      
      console.log('[ConversationPersistence] State saved successfully');

    } catch (error) {
      console.error('[ConversationPersistence] Error saving conversation state:', error);
    }
  }

  /**
   * PHASE 3: Detect follow-up intentions based on previous context
   */
  detectFollowUpIntent(currentMessage: string): {
    isFollowUp: boolean;
    followUpType: string | null;
    contextualHints: string[];
  } {
    const metadata = this.stateManager.getMetadata();
    const lowerMessage = currentMessage.toLowerCase();
    
    // Check for sports/activity follow-up
    if (metadata.lastAssistantResponse && 
        /\b(sport|football|activity|exercise|physical)\b/i.test(metadata.lastAssistantResponse)) {
      if (lowerMessage.includes('football') || lowerMessage.includes('sport')) {
        return {
          isFollowUp: true,
          followUpType: 'sports_activity',
          contextualHints: ['Continue sports conversation', 'Focus on motivation and wellbeing']
        };
      }
    }

    // Check for emotional follow-up
    if (metadata.lastAssistantResponse && 
        /\b(feel|emotion|mood|mental health)\b/i.test(metadata.lastAssistantResponse)) {
      if (/\b(yes|no|better|worse|same)\b/i.test(lowerMessage)) {
        return {
          isFollowUp: true,
          followUpType: 'emotional_check_in',
          contextualHints: ['Continue emotional conversation', 'Provide supportive response']
        };
      }
    }

    // Check for time-based follow-up
    if (metadata.timeContext && 
        /\b(yesterday|today|this week|last week)\b/i.test(lowerMessage)) {
      return {
        isFollowUp: true,
        followUpType: 'temporal',
        contextualHints: ['Time-based follow-up', 'Reference previous time context']
      };
    }

    return {
      isFollowUp: false,
      followUpType: null,
      contextualHints: []
    };
  }

  /**
   * PHASE 4: Get conversation state for external use
   */
  getConversationState() {
    return {
      stateManager: this.stateManager,
      flowManager: this.flowManager,
      metadata: this.stateManager.getMetadata()
    };
  }

  /**
   * PHASE 4: Validate conversation continuity
   */
  validateConversationContinuity(): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const metadata = this.stateManager.getMetadata();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if there's a significant time gap
    if (metadata.lastUpdated) {
      const lastUpdate = new Date(metadata.lastUpdated);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        issues.push('Long time gap since last interaction');
        recommendations.push('Refresh conversation context');
      }
    }

    // Check if conversation context is missing
    if (!metadata.topicContext && !metadata.timeContext) {
      issues.push('Missing conversation context');
      recommendations.push('Re-establish conversation flow');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }
}