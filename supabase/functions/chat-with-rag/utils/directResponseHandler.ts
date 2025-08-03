import { OptimizedApiClient } from './optimizedApiClient.ts';

/**
 * Direct Response Handler for non-journal queries
 * Provides immediate GPT responses for follow-up questions and general inquiries
 */
export class DirectResponseHandler {

  /**
   * Determine if a query should be handled directly without journal search
   */
  static shouldHandleDirectly(
    message: string, 
    conversationContext: any[] = [],
    queryPlan: any = null
  ): boolean {
    const lowerMessage = message.toLowerCase().trim();
    
    // Check if this is a follow-up question to a previous response
    if (this.isFollowUpQuestion(message, conversationContext)) {
      console.log('[DirectResponse] Detected follow-up question');
      return true;
    }

    // Check for general mental health/journaling questions
    if (this.isGeneralQuestion(lowerMessage)) {
      console.log('[DirectResponse] Detected general question');
      return true;
    }

    // Check for conversational/greeting messages
    if (this.isConversationalMessage(lowerMessage)) {
      console.log('[DirectResponse] Detected conversational message');
      return true;
    }

    // Check query plan confidence for direct response
    if (queryPlan && queryPlan.queryType === 'direct_response') {
      console.log('[DirectResponse] Query plan indicates direct response');
      return true;
    }

    return false;
  }

  /**
   * Generate direct response without journal search
   */
  static async generateDirectResponse(
    message: string,
    conversationContext: any[] = [],
    openaiApiKey: string,
    userProfile: any = {}
  ): Promise<any> {
    const startTime = Date.now();
    console.log(`[DirectResponse] Generating direct response for: "${message}"`);

    try {
      const responseType = this.categorizeQuery(message, conversationContext);
      const systemPrompt = this.getSystemPrompt(responseType, userProfile);
      
      const response = await this.callOpenAI(
        systemPrompt,
        message,
        conversationContext,
        openaiApiKey
      );

      const processingTime = Date.now() - startTime;
      console.log(`[DirectResponse] Generated response in ${processingTime}ms`);

      return {
        response,
        analysis: {
          responseType: 'direct',
          category: responseType,
          processingTime,
          usedJournalData: false,
          isDirectResponse: true
        },
        referenceEntries: []
      };

    } catch (error) {
      console.error('[DirectResponse] Error generating direct response:', error);
      throw error;
    }
  }

  /**
   * Check if message is a follow-up question
   */
  private static isFollowUpQuestion(message: string, conversationContext: any[]): boolean {
    if (conversationContext.length < 2) return false;

    const lowerMessage = message.toLowerCase();
    const followUpIndicators = [
      'what about', 'how about', 'tell me more', 'can you explain',
      'what does that mean', 'why is that', 'how does that work',
      'what should i do', 'how can i', 'what if', 'but what about',
      'that makes sense', 'i see', 'thanks', 'thank you', 'ok',
      'okay', 'got it', 'i understand', 'interesting', 'wow',
      'really?', 'is that right', 'and then', 'so', 'but'
    ];

    const hasFollowUpIndicator = followUpIndicators.some(indicator => 
      lowerMessage.includes(indicator)
    );

    const isShortQuestion = message.split(' ').length <= 8;
    const hasQuestionWords = /\b(what|how|why|when|where|can|should|would|could|is|are|do|does)\b/i.test(message);

    return hasFollowUpIndicator || (isShortQuestion && hasQuestionWords);
  }

  /**
   * Check if message is a general question
   */
  private static isGeneralQuestion(lowerMessage: string): boolean {
    const generalQuestionPatterns = [
      // Journaling advice
      /how.*journal|what.*journal|when.*journal|why.*journal/,
      /how.*write|what.*write|writing.*tips|writing.*advice/,
      /journal.*benefits|journaling.*help|journaling.*good/,
      
      // Mental health general advice
      /how.*anxiety|deal.*stress|manage.*depression|cope.*with/,
      /mental.*health|wellbeing|self.*care|mindfulness/,
      /what.*therapy|should.*see.*therapist|counseling.*help/,
      
      // App-related questions
      /how.*app.*work|what.*app.*do|app.*features|how.*use/,
      /what.*soulo|about.*soulo|soulo.*help/,
      
      // General advice
      /what.*should.*do|how.*can.*help|advice.*for|tips.*for/,
      /how.*improve|how.*get.*better|how.*feel.*better/
    ];

    return generalQuestionPatterns.some(pattern => pattern.test(lowerMessage));
  }

  /**
   * Check if message is conversational
   */
  private static isConversationalMessage(lowerMessage: string): boolean {
    const conversationalPatterns = [
      // Greetings
      /^(hi|hello|hey|good morning|good afternoon|good evening)/,
      
      // Short responses
      /^(ok|okay|thanks|thank you|yes|no|sure|alright|cool|nice)$/,
      
      // Emotional expressions
      /^(wow|amazing|great|awesome|terrible|horrible|sad|happy)$/,
      
      // Questions about the AI
      /who.*are.*you|what.*are.*you|are.*you.*ai|are.*you.*human|what.*can.*you.*do/
    ];

    return conversationalPatterns.some(pattern => pattern.test(lowerMessage));
  }

  /**
   * Categorize the query for appropriate response handling
   */
  private static categorizeQuery(message: string, conversationContext: any[]): string {
    const lowerMessage = message.toLowerCase();

    if (this.isFollowUpQuestion(message, conversationContext)) {
      return 'follow_up';
    }

    if (/journal|write|writing|entry|entries/.test(lowerMessage)) {
      return 'journaling_advice';
    }

    if (/anxiety|stress|depression|mental.*health|therapy|counseling/.test(lowerMessage)) {
      return 'mental_health_general';
    }

    if (/app|soulo|feature|help|how.*use/.test(lowerMessage)) {
      return 'app_guidance';
    }

    if (this.isConversationalMessage(lowerMessage)) {
      return 'conversational';
    }

    return 'general_advice';
  }

  /**
   * Get system prompt based on response type
   */
  private static getSystemPrompt(responseType: string, userProfile: any): string {
    const basePrompt = `You are SOuLO, a compassionate AI assistant for a voice journaling app. You help users with their emotional wellbeing and journaling practice.

Guidelines:
- Be warm, supportive, and understanding
- Keep responses concise but helpful (2-3 paragraphs max)
- Provide actionable advice when appropriate
- Acknowledge emotions and validate feelings
- Suggest journaling as a helpful practice when relevant
- If asked about personal journal data, gently suggest they could explore their journal entries for personalized insights`;

    const prompts = {
      follow_up: `${basePrompt}

You're responding to a follow-up question in an ongoing conversation. Reference the previous context naturally and provide helpful clarification or additional information.`,

      journaling_advice: `${basePrompt}

You're providing general advice about journaling practices. Share evidence-based benefits, practical tips, and encouraging guidance about developing a consistent journaling habit.`,

      mental_health_general: `${basePrompt}

You're offering general mental health support and information. Provide compassionate guidance while being clear that you're not a replacement for professional mental health care when serious issues are discussed.`,

      app_guidance: `${basePrompt}

You're helping with app-related questions about SOuLO. Explain features, benefits, and how to make the most of voice journaling while staying encouraging about their journey.`,

      conversational: `${basePrompt}

You're engaging in friendly conversation. Be warm and personable while gently steering toward how journaling or self-reflection might be helpful.`,

      general_advice: `${basePrompt}

You're providing general life advice or support. Be encouraging and suggest practical steps while highlighting how journaling could help process thoughts and emotions.`
    };

    return prompts[responseType] || prompts.general_advice;
  }

  /**
   * Call OpenAI for direct response
   */
  private static async callOpenAI(
    systemPrompt: string,
    userMessage: string,
    conversationContext: any[],
    openaiApiKey: string
  ): Promise<string> {
    try {
      // Build conversation history
      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add recent conversation context (last 4 messages)
      const recentContext = conversationContext.slice(-4);
      for (const msg of recentContext) {
        if (msg.role && msg.content) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        }
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: userMessage
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.7,
          max_tokens: 300 // Keep responses concise
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'I apologize, but I encountered an issue generating a response. Please try again.';

    } catch (error) {
      console.error('[DirectResponse] OpenAI call failed:', error);
      throw error;
    }
  }

  /**
   * Get a fallback response for errors
   */
  static getFallbackResponse(message: string): any {
    return {
      response: "I'd be happy to help you with that! However, I'm experiencing some technical difficulties right now. Please try asking your question again, or if you're looking for insights from your journal entries, I can search through them to provide personalized guidance.",
      analysis: {
        responseType: 'fallback',
        category: 'error_fallback',
        processingTime: 0,
        usedJournalData: false,
        isDirectResponse: true
      },
      referenceEntries: []
    };
  }
}