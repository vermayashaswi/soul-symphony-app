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
  isMentalHealthQuery?: boolean;     // Flag for mental health queries
  isPersonalQuery?: boolean;         // Flag for personal queries
  previousState?: ConversationState | null; // Previous state for tracking changes
  previousQuery?: string | null;     // Previous query text for context
  lastUpdateTime?: string;           // Timestamp of last state update
  messageBuffer?: string[];          // Store recent messages for context
}

export type IntentType = 
  | 'new_query'               // Brand new topic
  | 'followup_time'           // Follow-up changing time context only
  | 'followup_topic'          // Follow-up changing topic
  | 'followup_refinement'     // Follow-up asking for more details
  | 'clarification_response'  // Response to a clarification request
  | 'multi_part'              // Multiple questions in one
  | 'mental_health_followup'; // Follow-up on mental health topic

export type QueryType =
  | 'journal_specific'        // Query about journal entries
  | 'general_analysis'        // General analysis request
  | 'emotional_analysis'      // Analysis of emotions
  | 'pattern_detection'       // Looking for patterns
  | 'mental_health_support'   // Specific mental health support queries
  | 'personality_reflection'; // Reflections on personality

/**
 * Manages and persists conversation state for chat threads
 */
export class ConversationStateManager {
  private threadId: string;
  private userId: string;
  private currentState: ConversationState | null = null;
  private messageBuffer: string[] = []; // Store recent messages for context

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
        isPersonalQuery: metadata.isPersonalQuery || false,
        previousQuery: metadata.previousQuery || null,
        lastUpdateTime: metadata.lastUpdateTime || new Date().toISOString(),
        messageBuffer: metadata.messageBuffer || []
      };
      
      // Load recent messages for context if not in metadata
      if (!metadata.messageBuffer) {
        await this.loadRecentMessages();
      } else {
        this.messageBuffer = metadata.messageBuffer;
      }
      
      return this.currentState;
    } catch (error) {
      console.error('Error loading conversation state:', error);
      return null;
    }
  }

  /**
   * Save current conversation state to the database
   */
  async saveState(state: ConversationState, currentQuery?: string): Promise<boolean> {
    try {
      // Update message buffer if we have a new query
      if (currentQuery) {
        this.messageBuffer.push(currentQuery);
        // Keep only last 5 messages
        if (this.messageBuffer.length > 5) {
          this.messageBuffer = this.messageBuffer.slice(-5);
        }
      }
      
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
        previousQuery: currentQuery || state.previousQuery,
        lastUpdateTime: new Date().toISOString(),
        messageBuffer: this.messageBuffer
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
   * Load recent messages to provide context
   */
  private async loadRecentMessages(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('content, sender')
        .eq('thread_id', this.threadId)
        .eq('sender', 'user')
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (error || !data) {
        console.error('Error loading recent messages:', error);
        return;
      }
      
      // Store user messages in reverse chronological order
      this.messageBuffer = data
        .map(msg => msg.content)
        .reverse();
        
    } catch (error) {
      console.error('Error in loadRecentMessages:', error);
    }
  }

  /**
   * Enhanced follow-up query detection with context awareness
   */
  isFollowUpQuery(query: string, previousState: ConversationState | null): boolean {
    if (!previousState) return false;
    
    // If there was a recent query (within last 3 minutes), it's more likely to be a follow-up
    const lastUpdateTime = previousState.lastUpdateTime ? 
      new Date(previousState.lastUpdateTime).getTime() : 0;
    const now = new Date().getTime();
    const timeDiff = now - lastUpdateTime;
    
    const isRecentInteraction = timeDiff < 3 * 60 * 1000; // 3 minutes
    
    // Short queries are often follow-ups, especially if recently active
    if (query.length < 20 && !query.includes('?') && isRecentInteraction) {
      return true;
    }
    
    // Check for explicit follow-up indicators
    const followUpIndicators = [
      'what about', 'how about', 'and what', 'also', 'additionally',
      'instead', 'rather', 'but what', 'but how', 'then what',
      'show me', 'tell me more', 'could you', 'can you', 'and',
      'why', 'how come', 'what else', 'is there more', 'go on',
      'continue', 'elaborate', 'explain further', 'more details',
      'specifically', 'exactly', 'precisely', 'in addition', 'moreover',
      'furthermore', 'besides', 'otherwise', 'nevertheless', 'so',
      'therefore', 'thus', 'hence', 'consequently', 'because',
      'why not', 'how so', 'and then', 'after that', 'so what', 'why is this'
    ];
    
    // Explicit terms that often start follow-ups
    for (const indicator of followUpIndicators) {
      if (query.toLowerCase().trim().startsWith(indicator)) {
        return true;
      }
    }
    
    // If query only mentions time change but not the topic, likely a follow-up
    if (isTimeOnlyQuery(query) && previousState.topicContext) {
      return true;
    }
    
    // Mental health follow-ups need special handling
    if (previousState.isMentalHealthQuery && 
        (isMentalHealthQuery(query) || containsPersonalFollowUp(query))) {
      return true;
    }
    
    // Very short queries with personal terms are likely follow-ups
    if (query.length < 25 && isPersonalQuery(query) && isRecentInteraction) {
      return true;
    }
    
    // Check for semantically similar content to previous query
    if (previousState.previousQuery && isSemanticallySimilar(query, previousState.previousQuery)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Analyze intent type based on the query and previous state
   * Enhanced with mental health awareness and context retention
   */
  async analyzeIntent(query: string): Promise<IntentType> {
    if (!this.currentState) await this.loadState();
    const previousState = this.currentState;
    
    // 1. Check if this is a multi-part query
    if (isMultiPartQuery(query)) return 'multi_part';
    
    // 2. Check if this is a response to a previous clarification request
    if (previousState?.needsClarity) return 'clarification_response';
    
    // 3. Check if this is a mental health follow-up
    if (previousState?.isMentalHealthQuery && 
        (isMentalHealthQuery(query) || containsPersonalFollowUp(query))) {
      return 'mental_health_followup';
    }
    
    // 4. Check if this is a follow-up query
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
   * Improved with enhanced context preservation
   */
  async createState(
    query: string, 
    plan: any, 
    intent: IntentType
  ): Promise<ConversationState> {
    const previousState = await this.loadState();
    
    // Detect mental health query with improved confidence
    const mentalHealthConfidence = calculateMentalHealthConfidence(query);
    const isMentalHealthTopic = mentalHealthConfidence > 0.3 || 
                               (plan?.isMentalHealthQuery === true) ||
                               (previousState?.isMentalHealthQuery && intent.includes('followup'));
    
    // Determine if query is personal (about the user)
    const personalConfidence = calculatePersonalQueryConfidence(query);
    const isPersonalTopic = personalConfidence > 0.3 || 
                           (plan?.isPersonalQuery === true) ||
                           (previousState?.isPersonalQuery && intent.includes('followup'));
    
    let newState: ConversationState = {
      topicContext: extractTopicContext(query, plan),
      timeContext: plan?.filters?.date_range?.periodName || null,
      intentType: intent,
      ambiguities: plan?.ambiguities || [],
      confidenceScore: calculateConfidence(plan, query, isMentalHealthTopic),
      needsClarity: determineIfClarificationNeeded(plan, query, isMentalHealthTopic),
      referenceIds: plan?.referenceIds || [],
      entities: extractEntities(plan),
      lastQueryType: determineQueryType(query, plan, isMentalHealthTopic),
      isMentalHealthQuery: isMentalHealthTopic,
      isPersonalQuery: isPersonalTopic,
      previousState: previousState,
      previousQuery: previousState?.previousQuery || null
    };
    
    // Context preservation for follow-ups
    if (intent.includes('followup') && previousState) {
      // For time-only follow-ups, preserve the previous topic context
      if (intent === 'followup_time' && previousState.topicContext) {
        newState.topicContext = previousState.topicContext;
      }
      
      // For mental health follow-ups, strengthen the mental health context
      if (intent === 'mental_health_followup' || 
          (previousState.isMentalHealthQuery && intent === 'followup_refinement')) {
        newState.isMentalHealthQuery = true;
        
        // If no new topic is extracted, preserve the previous one
        if (!newState.topicContext && previousState.topicContext) {
          newState.topicContext = previousState.topicContext;
        }
      }
      
      // For refinement queries, preserve topic and entities
      if (intent === 'followup_refinement') {
        if (!newState.topicContext && previousState.topicContext) {
          newState.topicContext = previousState.topicContext;
        }
        
        if (newState.entities.length === 0 && previousState.entities.length > 0) {
          newState.entities = previousState.entities;
        }
      }
    }
    
    // Save the query for future reference
    newState.previousQuery = query;
    
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
    'september', 'october', 'november', 'december', 'recently', 'lately',
    'past few days', 'last few days', 'earlier', 'later'
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
  return (timeTermCount / words.length > 0.4) || 
         (words.length <= 5 && timeTermCount > 0);
}

/**
 * Helper function to check if a query is a refinement request
 */
function isRefinementQuery(query: string): boolean {
  const refinementPatterns = [
    'more detail', 'tell me more', 'elaborate', 'explain',
    'why', 'how', 'in what way', 'give me examples',
    'can you expand', 'more information', 'specifically',
    'what do you mean', 'clarify', 'explain further',
    'give more context', 'go deeper', 'say more about',
    'be more specific', 'what exactly', 'precise',
    'can you be more', 'details about', 'expand on'
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
  
  // Check for enumeration patterns
  if (/(?:\d+\.|first|second|third|firstly|secondly|thirdly|finally|lastly)[,\s]/i.test(lowerQuery)) {
    return true;
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
    if (Array.isArray(plan.filters.entities)) {
      for (const entity of plan.filters.entities) {
        if (typeof entity === 'string') {
          entities.push(entity);
        } else if (entity && entity.name) {
          entities.push(entity.name);
        }
      }
    }
  }
  
  return entities;
}

/**
 * Helper function to calculate confidence score with mental health awareness
 */
function calculateConfidence(plan: any, query: string, isMentalHealthQuery: boolean): number {
  // Start with a base score
  let score = 1.0;
  
  // Reduce confidence if there are known ambiguities
  if (plan?.ambiguities && plan.ambiguities.length > 0) {
    score -= 0.1 * Math.min(plan.ambiguities.length, 3); // Cap at 0.3 reduction
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
  
  // Increase confidence for mental health queries to ensure they get processed
  if (isMentalHealthQuery) {
    score = Math.min(1.0, score + 0.15);
  }
  
  // Boost confidence if we have clear entities or themes
  if (plan?.filters?.themes && plan.filters.themes.length > 0) {
    score = Math.min(1.0, score + 0.1);
  }
  
  if (plan?.filters?.entities && plan.filters.entities.length > 0) {
    score = Math.min(1.0, score + 0.1);
  }
  
  return Math.max(0.2, Math.min(score, 1.0)); // Keep between 0.2 and 1.0
}

/**
 * Helper function to determine if clarification is needed
 * More permissive for mental health queries
 */
function determineIfClarificationNeeded(plan: any, query: string, isMentalHealthQuery: boolean): boolean {
  // Be more permissive with clarification for mental health queries
  if (isMentalHealthQuery) {
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
 * Helper function to check if a query is mental health related
 * Enhanced with more indicators and patterns
 */
function isMentalHealthQuery(query: string): boolean {
  const mentalHealthKeywords = [
    'mental health', 'anxiety', 'depression', 'stress', 'mood', 'emotion', 
    'feeling', 'therapy', 'therapist', 'psychiatrist', 'psychologist', 
    'counselor', 'counseling', 'wellbeing', 'well-being', 'wellness',
    'self-care', 'burnout', 'overwhelm', 'mindfulness', 'meditation',
    'coping', 'psychological', 'emotional health', 'distress', 'worried',
    'sad', 'upset', 'frustrated', 'angry', 'happiness', 'happy', 'unhappy',
    'content', 'discontent', 'satisfied', 'unsatisfied', 'fulfilled'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Direct keyword check
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
    /\badvice (?:for|on|about) (?:my|dealing with|handling)/i,
    /\bi (?:can't|cannot|don't|do not) (?:cope|handle|manage|deal)/i,
    /\bam i (?:okay|happy|sad|depressed|anxious|good enough)/i,
    /\bwhy (?:am i|do i feel|can't i|is it so hard)/i,
    /\bhow (?:do i|can i|should i|best|better to) (?:cope|handle|manage|deal)/i
  ];
  
  for (const pattern of mentalHealthPatterns) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate a confidence score for mental health query detection
 */
function calculateMentalHealthConfidence(query: string): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;
  
  // Check for explicit mental health terms
  const mentalHealthKeywords = [
    {term: 'mental health', weight: 1.0},
    {term: 'depression', weight: 1.0},
    {term: 'anxiety', weight: 1.0},
    {term: 'stress', weight: 0.7},
    {term: 'therapy', weight: 0.8},
    {term: 'therapist', weight: 0.9},
    {term: 'emotional', weight: 0.6},
    {term: 'feelings', weight: 0.5},
    {term: 'mood', weight: 0.6},
    {term: 'happy', weight: 0.4},
    {term: 'sad', weight: 0.5},
    {term: 'worried', weight: 0.5},
    {term: 'upset', weight: 0.5},
    {term: 'coping', weight: 0.7}
  ];
  
  for (const keyword of mentalHealthKeywords) {
    if (lowerQuery.includes(keyword.term)) {
      score += keyword.weight;
    }
  }
  
  // Check for "am I" type questions that often relate to mental health
  if (/\bam i\b.*\?/.test(lowerQuery)) {
    score += 0.3;
  }
  
  // Check for "I feel" statements
  if (/\bi (?:feel|am feeling)\b/.test(lowerQuery)) {
    score += 0.4;
  }
  
  // Normalize score between 0 and 1
  return Math.min(1.0, score);
}

/**
 * Helper function to check if a query is seeking personal advice
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
    /\bam i\b/i,
    /\b(?:advice|help|suggest|recommendation)s?\b.*\bfor\b.*\bme\b/i
  ];
  
  for (const pattern of personalIndicators) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate a confidence score for personal query detection
 */
function calculatePersonalQueryConfidence(query: string): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;
  
  // Check for first-person pronouns (high confidence)
  if (/\bi\b/.test(lowerQuery)) score += 0.4;
  if (/\bmy\b/.test(lowerQuery)) score += 0.4;
  if (/\bme\b/.test(lowerQuery)) score += 0.3;
  
  // Check for direct questions about self (highest confidence)
  if (/\bam i\b/.test(lowerQuery)) score += 0.6;
  if (/\bshould i\b/.test(lowerQuery)) score += 0.6;
  if (/\bdo i\b/.test(lowerQuery)) score += 0.5;
  if (/\bcan i\b/.test(lowerQuery)) score += 0.5;
  
  // Check for seeking personal advice
  if (/\badvice\b/.test(lowerQuery) && 
      (/\bme\b/.test(lowerQuery) || /\bmy\b/.test(lowerQuery))) {
    score += 0.5;
  }
  
  // Check for specific help or insight requests
  if (/\bhelp\b.*\bme\b/.test(lowerQuery)) score += 0.4;
  if (/\binsight\b.*\bmy\b/.test(lowerQuery)) score += 0.4;
  
  // Normalize score between 0 and 1
  return Math.min(1.0, score);
}

/**
 * Determine if the query contains personal follow-up markers
 */
function containsPersonalFollowUp(query: string): boolean {
  const personalFollowUpPatterns = [
    /\bwhy\b.*\?/i,
    /\bhow\b.*\bcan i\b/i,
    /\bwhat\b.*\bshould i\b/i,
    /\bcould you explain\b/i,
    /\bmore about\b/i,
    /\bwhat do you mean\b/i,
    /\bagain\b/i,
    /\breally\b/i,
    /^oh\b/i,
    /^hmm\b/i,
    /^i see\b/i,
    /\bbut\b/i,
    /\band\b/i,
    /\bso\b/i
  ];
  
  for (const pattern of personalFollowUpPatterns) {
    if (pattern.test(query)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if two queries are semantically similar
 * Simplified version - in production you would use embedding comparison
 */
function isSemanticallySimilar(query1: string, query2: string): boolean {
  const q1 = query1.toLowerCase();
  const q2 = query2.toLowerCase();
  
  // Simple word overlap calculation
  const words1 = new Set(q1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(q2.split(/\s+/).filter(w => w.length > 3));
  
  let overlapCount = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      overlapCount++;
    }
  }
  
  // Calculate Jaccard similarity
  const union = new Set([...words1, ...words2]);
  const similarityScore = overlapCount / union.size;
  
  // Consider similar if at least 30% of unique words overlap
  return similarityScore > 0.3;
}

/**
 * Determine the query type based on content analysis
 */
function determineQueryType(query: string, plan: any, isMentalHealthQuery: boolean): QueryType {
  // If already classified in the plan, use that
  if (plan?.queryType) {
    return plan.queryType;
  }
  
  // Mental health queries get special treatment
  if (isMentalHealthQuery) {
    return 'mental_health_support';
  }
  
  // Check for patterns indicating emotional analysis
  if (/\bemotions?\b|\bfeel(?:ing)?\b|\bsentiment\b|\bmood\b/i.test(query)) {
    return 'emotional_analysis';
  }
  
  // Check for patterns indicating pattern detection
  if (/\bpattern\b|\btrend\b|\bover time\b|\bregularly\b|\boften\b|\bfrequent\b/i.test(query)) {
    return 'pattern_detection';
  }
  
  // Check for personality-related queries
  if (/\bam i\b|\btype of person\b|\bpersonality\b|\bcharacter\b|\bwho am i\b/i.test(query)) {
    return 'personality_reflection';
  }
  
  // Default to journal-specific if there are filters, otherwise general
  return plan?.filters && Object.keys(plan.filters).length > 0 
    ? 'journal_specific' 
    : 'general_analysis';
}
