
/**
 * Utility functions for processing chat messages and enhancing conversation intelligence
 */

import { ChatMessage } from '@/types/chat';

/**
 * Extract key information from chat history for context enrichment
 */
export function extractConversationInsights(messages: ChatMessage[]): {
  topics: string[];
  emotions: string[];
  timeReferences: string[];
  entities: string[];
  clarificationRequests: string[];
  userPreferences: Record<string, any>;
} {
  const insights = {
    topics: [],
    emotions: [],
    timeReferences: [],
    entities: [],
    clarificationRequests: [],
    userPreferences: {}
  };
  
  if (!messages || messages.length === 0) return insights;
  
  // Process each message to extract key information
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const content = message.content || '';
    
    // Skip processing messages without content
    if (!content) continue;
    
    // Extract topics from assistant responses
    if (message.sender === 'assistant') {
      extractTopicsFromAssistantMessage(content, insights.topics);
      extractEntitiesFromAssistantMessage(content, insights.entities);
      
      // Check if this was a clarification question
      if (isClarificationQuestion(content)) {
        insights.clarificationRequests.push(content);
      }
    }
    
    // Extract user preferences and information from user messages
    if (message.sender === 'user') {
      extractTimeReferences(content, insights.timeReferences);
      extractEmotionsFromUserMessage(content, insights.emotions);
      extractUserPreferences(content, insights.userPreferences);
    }
  }
  
  // Remove duplicates
  insights.topics = Array.from(new Set(insights.topics));
  insights.emotions = Array.from(new Set(insights.emotions));
  insights.timeReferences = Array.from(new Set(insights.timeReferences));
  insights.entities = Array.from(new Set(insights.entities));
  
  return insights;
}

/**
 * Extract main topics from assistant responses
 */
function extractTopicsFromAssistantMessage(content: string, topicsArray: string[]): void {
  // Look for indicators of the main topic in the assistant response
  const topicIndicators = [
    "regarding your ([^,.]+)",
    "about your ([^,.]+)",
    "related to ([^,.]+)",
    "concerning your ([^,.]+)",
    "your ([^,.]+) shows",
    "your journals about ([^,.]+)",
    "your entries about ([^,.]+)"
  ];
  
  for (const indicator of topicIndicators) {
    const regex = new RegExp(indicator, "i");
    const match = content.match(regex);
    if (match && match[1]) {
      const topic = match[1].trim();
      if (topic.length > 3 && topic.length < 40) {
        topicsArray.push(topic);
      }
    }
  }
}

/**
 * Check if a message is a clarification question from the assistant
 */
function isClarificationQuestion(content: string): boolean {
  const clarificationPatterns = [
    "could you clarify",
    "could you be more specific",
    "I'm not sure what you mean",
    "can you provide more details",
    "what specifically",
    "which time period",
    "when exactly",
    "can you tell me more about"
  ];
  
  const lowerContent = content.toLowerCase();
  
  // Check for question marks and clarification patterns
  if (content.includes("?")) {
    for (const pattern of clarificationPatterns) {
      if (lowerContent.includes(pattern)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Extract time references from user messages
 */
function extractTimeReferences(content: string, timeArray: string[]): void {
  const timePatterns = [
    "today",
    "yesterday",
    "last week",
    "this week",
    "last month",
    "this month",
    "last year",
    "this year",
    "morning",
    "afternoon",
    "evening",
    "night",
    "\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}", // Date patterns like 01/15/2023
    "january|february|march|april|may|june|july|august|september|october|november|december",
    "monday|tuesday|wednesday|thursday|friday|saturday|sunday",
    // New time-of-day patterns
    "\\d{1,2}( )?([ap]m)",
    "midnight",
    "noon",
    "dawn",
    "dusk",
    "sunrise",
    "sunset",
    "o'clock",
    "hour",
    "minute"
  ];
  
  const lowerContent = content.toLowerCase();
  
  for (const pattern of timePatterns) {
    const regex = new RegExp(`\\b${pattern}\\b`, "i");
    const match = lowerContent.match(regex);
    if (match) {
      timeArray.push(match[0]);
    }
  }
}

/**
 * Extract entities (people, places) from assistant messages
 */
function extractEntitiesFromAssistantMessage(content: string, entitiesArray: string[]): void {
  // Simple extraction based on common patterns
  const entityPatterns = [
    "([A-Z][a-z]+) mentioned",
    "your ([A-Z][a-z]+)",
    "with ([A-Z][a-z]+)",
    "about ([A-Z][a-z]+)"
  ];
  
  for (const pattern of entityPatterns) {
    const regex = new RegExp(pattern);
    const matches = content.match(new RegExp(regex, "g"));
    if (matches) {
      for (const match of matches) {
        const entityMatch = match.match(new RegExp(pattern));
        if (entityMatch && entityMatch[1]) {
          const entity = entityMatch[1].trim();
          if (entity.length > 1) {
            entitiesArray.push(entity);
          }
        }
      }
    }
  }
}

/**
 * Extract emotional content from user messages
 */
function extractEmotionsFromUserMessage(content: string, emotionsArray: string[]): void {
  const emotionWords = [
    "happy", "sad", "angry", "anxious", "excited", "worried", 
    "stressed", "relaxed", "frustrated", "content", "depressed",
    "overwhelmed", "grateful", "lonely", "loved", "afraid",
    "calm", "tired", "energetic", "confident", "insecure"
  ];
  
  const lowerContent = content.toLowerCase();
  
  for (const emotion of emotionWords) {
    if (lowerContent.includes(emotion)) {
      emotionsArray.push(emotion);
    }
  }
}

/**
 * Extract user preferences from messages
 */
function extractUserPreferences(content: string, preferences: Record<string, any>): void {
  // Look for explicit preference indicators
  const preferencePatterns = [
    { regex: /I prefer ([^.,]+)/, key: "general" },
    { regex: /I like when ([^.,]+)/, key: "likes" },
    { regex: /I don't like when ([^.,]+)/, key: "dislikes" },
    { regex: /don't (tell|show|give) me ([^.,]+)/, key: "dislikes" },
    { regex: /I want (more|less) ([^.,]+)/, key: "contentPreference" },
    // New time preference patterns
    { regex: /I (like|prefer) to journal in the (morning|afternoon|evening|night)/, key: "journalingTime" },
    { regex: /I usually (write|journal|log) (at|in the) ([^.,]+)/, key: "journalingTime" }
  ];
  
  for (const pattern of preferencePatterns) {
    const match = content.match(pattern.regex);
    if (match) {
      if (!preferences[pattern.key]) {
        preferences[pattern.key] = [];
      }
      preferences[pattern.key].push(match[1]);
    }
  }
}

/**
 * Construct a context-enhanced query for the AI based on message history
 */
export function enhanceQueryWithContext(
  query: string, 
  previousMessages: ChatMessage[],
  conversationState: any
): string {
  // For short follow-up queries, add more context
  if (query.length < 15 && !query.includes('?') && previousMessages.length > 0) {
    const insights = extractConversationInsights(previousMessages);
    
    // Get the last topic discussed
    const lastTopic = conversationState?.topicContext || 
                     (insights.topics.length > 0 ? insights.topics[insights.topics.length - 1] : null);
    
    if (lastTopic) {
      return `${query} (in the context of our conversation about ${lastTopic})`;
    }
  }
  
  return query;
}

/**
 * Check if a new user message is a direct response to a clarification request
 */
export function isResponseToClarification(
  newMessage: string,
  previousMessages: ChatMessage[]
): boolean {
  if (previousMessages.length === 0) return false;
  
  // Get the last assistant message
  let lastAssistantMessage: ChatMessage | null = null;
  for (let i = previousMessages.length - 1; i >= 0; i--) {
    if (previousMessages[i].sender === 'assistant') {
      lastAssistantMessage = previousMessages[i];
      break;
    }
  }
  
  // If last assistant message was a question, this is likely a response
  if (lastAssistantMessage && 
      lastAssistantMessage.content && 
      lastAssistantMessage.content.includes('?')) {
    return true;
  }
  
  return false;
}

/**
 * Generate a suitable clarification question based on the query and plan
 */
export function generateClarificationQuestion(query: string, plan: any): string {
  // Check if the plan has a specific clarification reason
  if (plan?.clarificationReason) {
    return `${plan.clarificationReason} Could you provide more details about what you're looking for?`;
  }
  
  // Handle very short queries
  if (query.length < 10) {
    return "I'd like to help you with that. Could you provide more details about what specifically you'd like to know from your journal entries?";
  }
  
  // Handle ambiguous time references
  if (!plan?.filters?.date_range) {
    return "Which time period would you like me to focus on? For example, last week, this month, or a specific date?";
  }
  
  // Default clarification question
  return "I want to make sure I understand your question correctly. Could you provide a bit more detail about what you're looking for?";
}

/**
 * Analyze the mental health content of a message
 * Returns a score from 0 to 1, where higher values indicate more mental health relevance
 */
export function analyzeMentalHealthContent(message: string): number {
  if (!message) return 0;
  
  const lowerMessage = message.toLowerCase();
  
  // Mental health related terms
  const mentalHealthTerms = [
    "mental health", "wellbeing", "wellness", "therapy", "counseling", 
    "anxiety", "depression", "stress", "mood", "emotion",
    "feelings", "psychological", "psychiatric", "diagnosis",
    "treatment", "medication", "self-care", "mindfulness",
    "meditation", "coping", "trauma", "trigger", "crisis",
    "burnout", "overwhelm", "healing", "recovery"
  ];
  
  // Count the number of mental health terms in the message
  let mentalHealthTermCount = 0;
  for (const term of mentalHealthTerms) {
    if (lowerMessage.includes(term)) {
      mentalHealthTermCount++;
    }
  }
  
  // Count the number of personal pronouns
  const personalPronouns = ["i", "me", "my", "mine", "myself"];
  let personalPronounCount = 0;
  
  for (const pronoun of personalPronouns) {
    const regex = new RegExp(`\\b${pronoun}\\b`, "ig");
    const matches = lowerMessage.match(regex);
    if (matches) {
      personalPronounCount += matches.length;
    }
  }
  
  // Calculate a score based on the presence of terms and personal context
  let score = 0;
  
  // Base score from mental health terms (max 0.6)
  if (mentalHealthTermCount > 0) {
    score += Math.min(0.6, mentalHealthTermCount * 0.15);
  }
  
  // Additional score from personal pronouns (max 0.4)
  if (personalPronounCount > 0) {
    score += Math.min(0.4, personalPronounCount * 0.1);
  }
  
  // Personal questions get a minimum score
  if (lowerMessage.includes("am i") || 
      lowerMessage.includes("do i") || 
      lowerMessage.includes("should i")) {
    score = Math.max(score, 0.3);
  }
  
  // Strong personal mental health indicators get a high score
  if ((lowerMessage.includes("my") || lowerMessage.includes("i")) && 
      (lowerMessage.includes("mental health") || 
       lowerMessage.includes("anxiety") || 
       lowerMessage.includes("depression") || 
       lowerMessage.includes("emotions"))) {
    score = Math.max(score, 0.7);
  }
  
  return Math.min(1, score);
}
