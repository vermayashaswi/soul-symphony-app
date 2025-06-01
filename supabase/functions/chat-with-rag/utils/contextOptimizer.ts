// Context optimization utilities for better performance
export class ContextOptimizer {
  
  // Summarize long conversation contexts
  static summarizeConversationContext(context: any[]): any[] {
    if (context.length <= 5) {
      return context;
    }
    
    // Keep the first and last 2 messages, summarize the middle
    const firstMessages = context.slice(0, 2);
    const lastMessages = context.slice(-2);
    const middleMessages = context.slice(2, -2);
    
    if (middleMessages.length > 0) {
      const summarizedMiddle = {
        role: 'system',
        content: `[Summary of ${middleMessages.length} messages: User discussed various topics including emotional patterns, journal analysis, and personal insights]`
      };
      
      return [...firstMessages, summarizedMiddle, ...lastMessages];
    }
    
    return context;
  }
  
  // Optimize query based on complexity
  static determineQueryComplexity(message: string): 'simple' | 'medium' | 'complex' {
    const lowerMessage = message.toLowerCase();
    
    // Simple queries (can use lightweight processing)
    const simplePatterns = [
      /^(how am i|how do i feel|what.*mood)/,
      /^(show me|tell me about).*today/,
      /^(latest|recent|last).*entry/
    ];
    
    // Complex queries (need full processing)
    const complexPatterns = [
      /compare.*with/,
      /over.*time|trend|pattern.*across/,
      /correlation|relationship.*between/,
      /analysis.*of.*multiple/
    ];
    
    if (simplePatterns.some(pattern => pattern.test(lowerMessage))) {
      return 'simple';
    }
    
    if (complexPatterns.some(pattern => pattern.test(lowerMessage))) {
      return 'complex';
    }
    
    return 'medium';
  }
  
  // Create lightweight processing path for simple queries
  static createLightweightPath(
    message: string,
    recentEntries: any[]
  ): { shouldUseLightweight: boolean; lightweightData?: any } {
    const complexity = this.determineQueryComplexity(message);
    
    if (complexity === 'simple' && recentEntries.length > 0) {
      // Use only the most recent entries for simple queries
      const recentData = recentEntries.slice(0, 5);
      
      return {
        shouldUseLightweight: true,
        lightweightData: {
          entries: recentData,
          summary: this.generateQuickSummary(recentData),
          emotions: this.extractTopEmotions(recentData)
        }
      };
    }
    
    return { shouldUseLightweight: false };
  }
  
  private static generateQuickSummary(entries: any[]): string {
    if (entries.length === 0) return 'No recent entries available.';
    
    const latestEntry = entries[0];
    const date = new Date(latestEntry.created_at).toLocaleDateString();
    const preview = latestEntry.content.substring(0, 150);
    
    return `Latest entry from ${date}: ${preview}...`;
  }
  
  private static extractTopEmotions(entries: any[]): any[] {
    const emotionCounts = new Map<string, { sum: number; count: number }>();
    
    entries.forEach(entry => {
      if (entry.emotions && typeof entry.emotions === 'object') {
        Object.entries(entry.emotions).forEach(([emotion, score]) => {
          if (typeof score === 'number' && score > 0.3) {
            const current = emotionCounts.get(emotion) || { sum: 0, count: 0 };
            emotionCounts.set(emotion, {
              sum: current.sum + score,
              count: current.count + 1
            });
          }
        });
      }
    });
    
    return Array.from(emotionCounts.entries())
      .map(([emotion, data]) => ({
        emotion,
        avgScore: data.sum / data.count,
        frequency: data.count
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3);
  }
  
  // Progressive context loading based on query needs
  static determineContextNeeds(message: string): {
    needsEmotion: boolean;
    needsVector: boolean;
    needsTimeRange: boolean;
    maxResults: number;
  } {
    const lowerMessage = message.toLowerCase();
    
    return {
      needsEmotion: /emotion|feel|mood|sentiment/.test(lowerMessage),
      needsVector: /about|topic|theme|content/.test(lowerMessage),
      needsTimeRange: /when|time|date|period|ago|since/.test(lowerMessage),
      maxResults: this.determineQueryComplexity(message) === 'simple' ? 5 : 
                  this.determineQueryComplexity(message) === 'medium' ? 10 : 15
    };
  }
}
