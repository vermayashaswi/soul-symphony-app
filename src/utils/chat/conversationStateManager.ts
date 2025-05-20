
import { supabase } from "@/integrations/supabase/client";

export interface ConversationState {
  topicContext: string | null;       // The current topic being discussed
  timeContext: string | null;        // Current time reference
  intentType: IntentType;            // Type of user intent
  ambiguities: string[];             // Things that need clarification
  confidenceScore: number;           // How confident we are about understanding
  needsClarity: boolean;             // Whether we need to ask a clarifying question
  referenceIds: string[];            // IDs of journal entries referenced
  entities: string[];                // Key entities mentioned
  lastQueryType: QueryType;          // Type of the last query
  isMentalHealthQuery?: boolean;     // IMPROVEMENT: Flag for mental health queries
  isPersonalQuery?: boolean;         // IMPROVEMENT: Flag for personal queries
  previousState?: ConversationState | null; // Previous state for tracking changes
}

export type IntentType = 
  | 'new_query'               // Brand new topic
  | 'followup_time'           // Follow-up changing time context only
  | 'followup_topic'          // Follow-up changing topic
  | 'followup_refinement'     // Follow-up asking for more details
  | 'clarification_response'  // Response to a clarification request
  | 'multi_part';             // Multiple questions in one

export type QueryType =
  | 'journal_specific'        // Query about journal entries
  | 'general_analysis'        // General analysis request
  | 'emotional_analysis'      // Analysis of emotions
  | 'pattern_detection'       // Looking for patterns
  | 'mental_health_support'   // IMPROVEMENT: Specific mental health support queries
  | 'personality_reflection'; // Reflections on personality

/**
 * Manages and persists conversation state for chat threads
 */
export class ConversationStateManager {
  private threadId: string;
  private userId: string;
  private currentState: ConversationState | null = null;

  constructor(threadId: string, userId: string) {
    this.threadId = threadId;
    this.userId = userId;
  }

  /**
   * Load existing conversation state from the database
   */
  async loadState(): Promise<ConversationState | null> {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('metadata')
        .eq('id', this.threadId)
        .single();
        
      if (error || !data || !data.metadata) {
        console.log('No existing conversation state found or error:', error);
        return null;
      }
      
      // Convert stored metadata to conversation state format
      const metadata = data.metadata as Record<string, any>;
      
      this.currentState = {
        topicContext: metadata.topicContext || null,
        timeContext: metadata.timeContext || null,
        intentType: metadata.intentType || 'new_query',
        ambiguities: metadata.ambiguities || [],
        confidenceScore: metadata.confidenceScore || 1.0,
        needsClarity: metadata.needsClarity || false,
        referenceIds: metadata.referenceIds || [],
        entities: metadata.entities || [],
        lastQueryType: metadata.lastQueryType || 'journal_specific',
        isMentalHealthQuery: metadata.isMentalHealthQuery || false,
        isPersonalQuery: metadata.isPersonalQuery || false
      };
      
      return this.currentState;
    } catch (error) {
      console.error('Error loading conversation state:', error);
      return null;
    }
  }

  /**
   * Save current conversation state to the database
   */
  async saveState(state: ConversationState): Promise<boolean> {
    try {
      // Create a serializable version of the state without circular references
      const serializableState = {
        topicContext: state.topicContext,
        timeContext: state.timeContext,
        intentType: state.intentType,
        ambiguities: state.ambiguities,
        confidenceScore: state.confidenceScore,
        needsClarity: state.needsClarity,
        referenceIds: state.referenceIds,
        entities: state.entities,
        lastQueryType: state.lastQueryType,
        isMentalHealthQuery: state.isMentalHealthQuery || false,
        isPersonalQuery: state.isPersonalQuery || false,
        lastUpdated: new Date().toISOString()
        // Note: We exclude the previousState to avoid circular references
      };
      
      const { error } = await supabase
        .from('chat_threads')
        .update({
          metadata: serializableState
        })
        .eq('id', this.threadId);
        
      if (error) {
        console.error('Error saving conversation state:', error);
        return false;
      }
      
      this.currentState = state;
      return true;
    } catch (error) {
      console.error('Error in saveState:', error);
      return false;
    }
  }

  /**
   * Determine if this query is a follow-up based on content and previous state
   */
  isFollowUpQuery(query: string, previousState: ConversationState | null): boolean {
    if (!previousState) return false;
    
    // Short queries are often follow-ups
    if (query.length < 15 && !query.includes('?')) return true;
    
    // Check for follow-up indicators
    const followUpIndicators = [
      'what about', 'how about', 'and what', 'also', 'additionally',
      'instead', 'rather', 'but what', 'but how', 'then what',
      'show me', 'tell me more', 'could you', 'can you'
    ];
    
    for (const indicator of followUpIndicators) {
      if (query.toLowerCase().startsWith(indicator)) return true;
    }
    
    // If query only mentions time change but not the topic, likely a follow-up
    if (isTimeOnlyQuery(query) && previousState.topicContext) return true;
    
    return false;
  }
  
  /**
   * Analyze intent type based on the query and previous state
   * IMPROVEMENT: Enhanced intent analysis with mental health awareness
   */
  async analyzeIntent(query: string): Promise<IntentType> {
    if (!this.currentState) await this.loadState();
    const previousState = this.currentState;
    
    // 1. Check if this is a multi-part query
    if (isMultiPartQuery(query)) return 'multi_part';
    
    // 2. Check if this is a response to a previous clarification request
    if (previousState?.needsClarity) return 'clarification_response';
    
    // IMPROVEMENT: Check if this is a mental health follow-up
    if (previousState?.isMentalHealthQuery && isMentalHealthQuery(query)) {
      return 'followup_refinement'; // Treat mental health follow-ups as refinement
    }
    
    // 3. Check if this is a follow-up query
    if (this.isFollowUpQuery(query, previousState)) {
      // If only time reference changes, it's a time follow-up
      if (isTimeOnlyQuery(query)) return 'followup_time';
      
      // Check if this is asking for more details on the same topic
      if (isRefinementQuery(query)) return 'followup_refinement';
      
      // Otherwise it's a topic change follow-up
      return 'followup_topic';
    }
    
    // Default to new query
    return 'new_query';
  }

  /**
   * Create a new state based on intent analysis and query plan
   * IMPROVEMENT: Preserve mental health context across states
   */
  async createState(
    query: string, 
    plan: any, 
    intent: IntentType
  ): Promise<ConversationState> {
    const previousState = await this.loadState();
    
    let newState: ConversationState = {
      topicContext: extractTopicContext(query, plan),
      timeContext: plan?.filters?.date_range?.periodName || null,
      intentType: intent,
      ambiguities: plan?.ambiguities || [],
      confidenceScore: calculateConfidence(plan, query),
      needsClarity: determineIfClarificationNeeded(plan, query),
      referenceIds: [],
      entities: extractEntities(plan),
      lastQueryType: plan?.queryType || 'journal_specific',
      isMentalHealthQuery: plan?.isMentalHealthQuery || isMentalHealthQuery(query),
      isPersonalQuery: plan?.isPersonalQuery || isPersonalQuery(query),
      previousState: previousState
    };
    
    // For time follow-ups, preserve the previous topic context
    if (intent === 'followup_time' && previousState?.topicContext) {
      newState.topicContext = previousState.topicContext;
    }
    
    // IMPROVEMENT: For mental health follow-ups, preserve the mental health context
    if (intent === 'followup_refinement' && previousState?.isMentalHealthQuery) {
      newState.isMentalHealthQuery = true;
      
      // If no new topic is extracted, preserve the previous one
      if (!newState.topicContext && previousState.topicContext) {
        newState.topicContext = previousState.topicContext;
      }
    }
    
    return newState;
  }
}

/**
 * Helper function to check if a query is only about time
 */
function isTimeOnlyQuery(query: string): boolean {
  const timeTerms = [
    'yesterday', 'today', 'this week', 'last week', 
    'this month', 'last month', 'this year', 'last year',
    'early', 'late', 'morning', 'afternoon', 'evening',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 
    'september', 'october', 'november', 'december'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check if the query contains mostly time terms
  const words = lowerQuery.split(/\s+/);
  let timeTermCount = 0;
  
  for (const word of words) {
    if (timeTerms.some(term => word.includes(term))) {
      timeTermCount++;
    }
  }
  
  // If more than half the query is time-related, or it's very short and contains time terms
  return (timeTermCount / words.length > 0.5) || 
         (words.length <= 4 && timeTermCount > 0);
}

/**
 * Helper function to check if a query is a refinement request
 */
function isRefinementQuery(query: string): boolean {
  const refinementPatterns = [
    'more detail', 'tell me more', 'elaborate', 'explain',
    'why', 'how', 'in what way', 'give me examples',
    'can you expand', 'more information', 'specifically'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  for (const pattern of refinementPatterns) {
    if (lowerQuery.includes(pattern)) return true;
  }
  
  return false;
}

/**
 * Helper function to check if a query has multiple questions
 */
function isMultiPartQuery(query: string): boolean {
  // Check for multiple question marks
  const questionMarks = (query.match(/\?/g) || []).length;
  if (questionMarks > 1) return true;
  
  // Check for question conjunctions
  const conjunctions = [
    'and also', 'also', 'additionally', 'moreover', 
    'furthermore', 'plus', 'in addition', 'besides',
    'what about', 'how about', 'tell me about', 'and'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  for (const conjunction of conjunctions) {
    // Only check if conjunction is not at the beginning of the query
    if (lowerQuery.indexOf(conjunction) > 10) return true;
  }
  
  return false;
}

/**
 * Helper function to extract topic context from query and plan
 */
function extractTopicContext(query: string, plan: any): string | null {
  // First look at plan's topic context
  if (plan?.topicContext) return plan.topicContext;
  if (plan?.topic_context) return plan.topic_context;
  
  // Try to extract from query themes
  if (plan?.filters?.themes && plan.filters.themes.length > 0) {
    return plan.filters.themes.join(', ');
  }
  
  // Fall back to a simplified form of the query
  const simplifiedQuery = query
    .replace(/\b(what|how|when|where|why|can|could|would|show|tell|give|list)\b/gi, '')
    .replace(/\babout\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  return simplifiedQuery.length > 5 ? simplifiedQuery : null;
}

/**
 * Helper function to extract entities from plan
 */
function extractEntities(plan: any): string[] {
  const entities: string[] = [];
  
  if (plan?.filters?.entities) {
    for (const entity of plan.filters.entities) {
      if (entity.name) entities.push(entity.name);
    }
  }
  
  return entities;
}

/**
 * Helper function to calculate confidence score
 */
function calculateConfidence(plan: any, query: string): number {
  // Start with a base score
  let score = 1.0;
  
  // Reduce confidence if there are known ambiguities
  if (plan?.ambiguities && plan.ambiguities.length > 0) {
    score -= 0.1 * plan.ambiguities.length;
  }
  
  // Reduce confidence for very short queries (under 5 words)
  const wordCount = query.split(/\s+/).length;
  if (wordCount < 5) {
    score -= 0.1;
  }
  
  // If query is extremely vague, further reduce confidence
  if (wordCount <= 2 && !query.includes('?')) {
    score -= 0.2;
  }
  
  // IMPROVEMENT: Increase confidence for mental health queries to ensure they get processed
  if (isMentalHealthQuery(query)) {
    score = Math.min(1.0, score + 0.1);
  }
  
  return Math.max(0.1, Math.min(score, 1.0)); // Keep between 0.1 and 1.0
}

/**
 * Helper function to determine if clarification is needed
 * IMPROVEMENT: More permissive for mental health queries
 */
function determineIfClarificationNeeded(plan: any, query: string): boolean {
  // Check if the query is mental health related
  const mentalHealthRelated = isMentalHealthQuery(query) || plan?.isMentalHealthQuery;
  
  // Be more permissive with clarification for mental health queries
  if (mentalHealthRelated) {
    // For mental health queries, only require clarification for extremely vague queries
    if (query.length <= 3) return true;
    return false;
  }
  
  // Standard clarification logic
  // Check if the plan explicitly requests more context
  if (plan?.needs_more_context) return true;
  
  // Check for ambiguities
  if (plan?.ambiguities && plan.ambiguities.length > 0) return true;
  
  // Check for very vague queries
  const wordCount = query.split(/\s+/).length;
  if (wordCount <= 2 && !query.includes('?')) return true;
  
  // Check if no specific filters were identified
  if ((!plan?.filters || Object.keys(plan.filters).length === 0) 
      && query.length < 15) {
    return true;
  }
  
  return false;
}

/**
 * IMPROVEMENT: Helper function to check if a query is mental health related
 */
function isMentalHealthQuery(query: string): boolean {
  const mentalHealthKeywords = [
    'mental health', 'anxiety', 'depression', 'stress', 'mood', 'emotion', 
    'feeling', 'therapy', 'therapist', 'psychiatrist', 'psychologist', 
    'counselor', 'counseling', 'wellbeing', 'well-being', 'wellness',
    'self-care', 'burnout', 'overwhelm', 'mindfulness', 'meditation',
    'coping', 'psychological', 'emotional health', 'distress'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check for mental health keywords
  for (const keyword of mentalHealthKeywords) {
    if (lowerQuery.includes(keyword)) {
      return true;
    }
  }
  
  // Check for phrases commonly used in mental health contexts
  const mentalHealthPatterns = [
    /\b(?:i (?:feel|am feeling|have been feeling))\b/i,
    /\b(?:help|improve) (?:my|with) (?:mental|emotional)/i,
    /\b(?:my|with) (?:mental|emotional) (?:health|state|wellbeing)/i,
    /\bhow (?:to|can i|should i) (?:feel better|improve|help)/i,
    /\badvice (?:for|on|about) (?:my|dealing with|handling)/i
  ];
  
  for (const pattern of mentalHealthPatterns) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  return false;
}

/**
 * IMPROVEMENT: Helper function to check if a query is seeking personal advice
 */
function isPersonalQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Check for first-person pronouns and possessives
  const personalIndicators = [
    /\bmy\b.*\b(?:advice|help|suggest|how|what|should)/i,
    /\bi\b.*\b(?:need|want|should|could|would|can)/i,
    /\bshould i\b/i, 
    /\bcan i\b/i, 
    /\bcould i\b/i,
    /\bwould i\b/i, 
    /\bdo i\b/i,
    /\badvice for me\b/i,
    /\bhelp me\b/i,
    /\b(?:advice|help|suggest|recommendation)s?\b.*\bfor\b.*\bme\b/i
  ];
  
  for (const pattern of personalIndicators) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  return false;
}
