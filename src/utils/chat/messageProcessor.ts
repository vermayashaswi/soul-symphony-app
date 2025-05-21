
import { ChatMessage } from '@/types/chat';

/**
 * Enhanced message processor to extract insights and context from conversations
 */

// Dictionary of mental health related terms and concepts
const MENTAL_HEALTH_TERMS = [
  // Emotional states
  'anxiety', 'anxious', 'depression', 'depressed', 'stress', 'stressed',
  'mood', 'emotion', 'feeling', 'mental health', 'wellbeing', 'well-being',
  'therapy', 'therapist', 'counseling', 'psychiatrist', 'psychologist',
  // Common concerns
  'sleep', 'insomnia', 'tired', 'exhaustion', 'burnout', 'overwhelm', 
  'overthinking', 'ruminating', 'worry', 'worrying', 'trauma',
  // Self-improvement
  'self-care', 'self care', 'mindfulness', 'meditation', 'breathing',
  'coping', 'cope', 'healing', 'recovery', 'growth', 'improve',
  // Relationships
  'relationship', 'friendship', 'family', 'partner', 'work-life',
  'balance', 'boundaries', 'communication'
];

/**
 * Extract key insights from conversation history
 * @param messages Array of chat messages
 * @returns Object containing extracted topics, times, and mental health content
 */
export function extractConversationInsights(messages: ChatMessage[]) {
  // Define patterns to look for
  const timePatterns = [
    /\b(today|yesterday|this week|last week|this month|last month|this year|last year)\b/i,
    /\b(past|previous|recent) (\d+) (days?|weeks?|months?|years?)\b/i
  ];
  
  // Results to accumulate
  const topics: string[] = [];
  const timeReferences: string[] = [];
  const mentalHealthTopics: string[] = [];
  
  // Track which messages contain which insights (for debugging)
  const topicSources: Record<string, number> = {};
  const timeSources: Record<string, number> = {};
  const mentalHealthSources: Record<string, number> = {};
  
  // Process each message
  messages.forEach((message, index) => {
    const content = message.content.toLowerCase();
    
    // Only process user messages for most insights
    if (message.role === 'user' || message.sender === 'user') {
      // Look for time references
      timePatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          const timeRef = matches[0];
          if (!timeReferences.includes(timeRef)) {
            timeReferences.push(timeRef);
            timeSources[timeRef] = index;
          }
        }
      });
      
      // Check for mental health terms
      MENTAL_HEALTH_TERMS.forEach(term => {
        if (content.includes(term.toLowerCase())) {
          if (!mentalHealthTopics.includes(term)) {
            mentalHealthTopics.push(term);
            mentalHealthSources[term] = index;
          }
        }
      });
    }
    
    // For both user and assistant messages, look for key topics
    // Focus on nouns and important concepts
    const topicPatterns = [
      // Look for patterns like "about X" or "regarding X" or "my X"
      /\b(?:about|regarding|my|on) ([a-z\s]{3,25})\b/i,
      // Look for capitalized terms (likely important)
      /\b([A-Z][a-z]{2,25})\b/,
      // Look for questions about specific topics
      /\b(?:how|what|why|when).{1,10}(anxiety|depression|stress|sleep|relationship|job|work|family|friend)/i
    ];
    
    topicPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches && matches[1]) {
        const topic = matches[1].trim();
        if (topic.length > 2 && !topics.includes(topic)) {
          topics.push(topic);
          topicSources[topic] = index;
        }
      }
    });
  });
  
  // Process assistant messages specifically to look for topic summaries
  // Assistant often categorizes or summarizes what the conversation is about
  messages.filter(m => m.role === 'assistant' || m.sender === 'assistant').forEach((message, index) => {
    const content = message.content;
    
    // Look for patterns where the assistant labels the conversation topic
    const topicLabelPatterns = [
      /based on your (journals?|entries?) about ([a-z\s]{3,25})/i,
      /regarding your ([a-z\s]{3,25})/i,
      /your ([a-z\s]{3,25}) (seems|appears|is|shows|indicates)/i
    ];
    
    topicLabelPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches && matches.length > 1) {
        // The last capture group should be the topic
        const lastIndex = matches.length - 1;
        const topic = matches[lastIndex].trim();
        if (topic.length > 2 && !topics.includes(topic)) {
          topics.push(topic);
          topicSources[topic] = index;
        }
      }
    });
  });
  
  // Sort results by relevance (most recent)
  const sortByRecency = (a: string, b: string, sources: Record<string, number>) => {
    return (sources[b] || 0) - (sources[a] || 0);
  };
  
  return {
    topics: topics.sort((a, b) => sortByRecency(a, b, topicSources)),
    timeReferences: timeReferences.sort((a, b) => sortByRecency(a, b, timeSources)),
    mentalHealthTopics: mentalHealthTopics.sort((a, b) => sortByRecency(a, b, mentalHealthSources))
  };
}

/**
 * Analyze a user message for personal mental health content
 * @param message The message to analyze
 * @returns Score indicating likelihood this is a mental health related message
 */
export function analyzeMentalHealthContent(message: string): number {
  const lowerMessage = message.toLowerCase();
  let score = 0;
  
  // Check for personal pronouns (indicates personal query)
  if (/\b(i|me|my|mine|myself)\b/i.test(lowerMessage)) {
    score += 0.2;
  }
  
  // Check for question patterns about personal wellbeing
  if (/\b(how|what|why|when) (am|is|was|were|do|does|did) (i|me|my)\b/i.test(lowerMessage)) {
    score += 0.3;
  }
  
  // Look for mental health terms
  let termCount = 0;
  MENTAL_HEALTH_TERMS.forEach(term => {
    if (lowerMessage.includes(term.toLowerCase())) {
      termCount++;
    }
  });
  
  // Add score based on mental health term count (max 0.5)
  score += Math.min(0.5, termCount * 0.1);
  
  return Math.min(1.0, score);
}

/**
 * Detect if a query is likely seeking personalized mental health insights
 */
export function isPersonalizedHealthQuery(message: string): boolean {
  // Get mental health content score
  const score = analyzeMentalHealthContent(message);
  
  // Check for explicit help requests
  const isExplicitHelp = /\b(help me|advice|suggestions?)\b/i.test(message.toLowerCase());
  
  // Either high mental health score or explicit help request
  return score > 0.4 || isExplicitHelp;
}
