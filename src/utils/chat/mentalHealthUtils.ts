
import { supabase } from '@/integrations/supabase/client';

/**
 * Analyze journal entries for mental health insights
 */
export async function analyzeMentalHealthEntries(userId: string, timeRange?: { startDate?: string; endDate?: string; periodName?: string }) {
  try {
    // Query for the most recent entries
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('*, emotions, sentiment, master_themes')
      // RLS policies automatically filter to user's entries
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) {
      console.error('Error fetching mental health entries:', error);
      return null;
    }
    
    if (!entries || entries.length === 0) {
      return {
        hasEntries: false,
        message: "No journal entries found. Please create some entries to get personalized mental health insights."
      };
    }
    
    // Extract emotions from entries
    const emotionMap = new Map<string, { count: number, totalScore: number }>();
    let overallSentiment = 0;
    let sentimentCount = 0;
    
    entries.forEach(entry => {
      // Process sentiment
      if (entry.sentiment) {
        const sentimentValue = Number(entry.sentiment);
        if (!isNaN(sentimentValue)) {
          overallSentiment += sentimentValue;
          sentimentCount++;
        }
      }
      
      // Process emotions
      if (entry.emotions) {
        try {
          const emotions = typeof entry.emotions === 'string' ? JSON.parse(entry.emotions) : entry.emotions;
          
          if (emotions) {
            if (Array.isArray(emotions.emotions)) {
              // Handle array format
              emotions.emotions.forEach((emotion: any) => {
                if (emotion && emotion.name && emotion.intensity) {
                  const name = emotion.name.toLowerCase();
                  if (!emotionMap.has(name)) {
                    emotionMap.set(name, { count: 0, totalScore: 0 });
                  }
                  const current = emotionMap.get(name)!;
                  current.count++;
                  current.totalScore += emotion.intensity;
                  emotionMap.set(name, current);
                }
              });
            } else {
              // Handle object format
              Object.entries(emotions).forEach(([key, value]) => {
                if (typeof value === 'number') {
                  const name = key.toLowerCase();
                  if (!emotionMap.has(name)) {
                    emotionMap.set(name, { count: 0, totalScore: 0 });
                  }
                  const current = emotionMap.get(name)!;
                  current.count++;
                  current.totalScore += value as number;
                  emotionMap.set(name, current);
                }
              });
            }
          }
        } catch (e) {
          console.error('Error processing emotions:', e);
        }
      }
    });
    
    // Calculate the average sentiment
    const avgSentiment = sentimentCount > 0 ? overallSentiment / sentimentCount : 0;
    
    // Get dominant emotions
    const dominantEmotions = [...emotionMap.entries()]
      .map(([name, data]) => ({ 
        name, 
        score: data.count > 0 ? data.totalScore / data.count : 0,
        count: data.count
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    // Collect themes from entries
    const allThemes = new Set<string>();
    const themeCountMap = new Map<string, number>();
    
    entries.forEach(entry => {
      if (entry.master_themes && Array.isArray(entry.master_themes)) {
        entry.master_themes.forEach(theme => {
          allThemes.add(theme);
          const currentCount = themeCountMap.get(theme) || 0;
          themeCountMap.set(theme, currentCount + 1);
        });
      }
    });
    
    // Sort themes by frequency
    const sortedThemes = [...allThemes].sort((a, b) => 
      (themeCountMap.get(b) || 0) - (themeCountMap.get(a) || 0)
    );
    
    // Get entry samples for personalized context
    const entrySamples = entries.slice(0, 3).map(entry => ({
      content: entry["refined text"] || entry["transcription text"],
      created_at: entry.created_at,
      sentiment: entry.sentiment,
      themes: entry.master_themes
    }));
    
    // Return the analysis
    return {
      hasEntries: true,
      entryCount: entries.length,
      averageSentiment: avgSentiment,
      dominantEmotions,
      themes: sortedThemes,
      timeRange: timeRange?.periodName || 'recent',
      entrySamples,
      recentEntryCount: entries.length
    };
  } catch (error) {
    console.error('Error analyzing mental health entries:', error);
    return null;
  }
}

/**
 * Generate mental health recommendations based on journal analysis
 * with more personalization
 */
export async function generateMentalHealthRecommendations(analysis: any, userMessage: string) {
  if (!analysis || !analysis.hasEntries) {
    return "I don't have enough journal entries to provide personalized recommendations. Consider adding more entries about your feelings and experiences.";
  }
  
  const userFirstName = "you"; // This could be replaced with actual user name if available
  
  let recommendations = "";
  
  // Add personalized greeting
  recommendations += `Based on analyzing your ${analysis.entryCount} journal entries, here are some personalized insights and recommendations:\n\n`;
  
  // Based on dominant emotions with more personalized context
  if (analysis.dominantEmotions && analysis.dominantEmotions.length > 0) {
    const topEmotion = analysis.dominantEmotions[0];
    
    recommendations += `Your journals show that you've been experiencing ${topEmotion.name} quite frequently. `;
    
    // Different recommendations based on emotion type
    if (topEmotion.name === 'happy' || topEmotion.name === 'joy' || topEmotion.name === 'content') {
      recommendations += `That's wonderful! To maintain this positive state, consider: \n` +
        `- Continuing activities that bring you joy\n` +
        `- Documenting what specifically makes you feel good so you can return to these activities\n` +
        `- Practicing gratitude journaling to reinforce positive experiences\n`;
    } else if (topEmotion.name === 'sad' || topEmotion.name === 'depressed' || topEmotion.name === 'melancholy') {
      recommendations += `I notice this in entries like "${truncateText(analysis.entrySamples?.[0]?.content)}". Some strategies that might help: \n` +
        `- Reaching out to friends or family for support\n` +
        `- Setting small, achievable daily goals to build momentum\n` +
        `- Engaging in activities that have helped lift your mood in the past\n` +
        `- Getting some physical exercise, even just a short walk\n`;
    } else if (topEmotion.name === 'anxious' || topEmotion.name === 'worried' || topEmotion.name === 'stressed') {
      recommendations += `I can see this reflected in your writing patterns. These techniques may help: \n` +
        `- Practice deep breathing exercises (inhale for 4, hold for 4, exhale for 6)\n` +
        `- Break large tasks into smaller, manageable steps\n` +
        `- Limit caffeine and prioritize sleep\n` +
        `- Consider scheduling "worry time" to contain anxious thoughts\n`;
    } else if (topEmotion.name === 'angry' || topEmotion.name === 'frustrated' || topEmotion.name === 'irritated') {
      recommendations += `Your entries reflect this emotion. These approaches might help: \n` +
        `- Remove yourself from triggering situations when possible\n` +
        `- Practice expressing feelings assertively rather than aggressively\n` +
        `- Use physical exercise to release tension\n` +
        `- Try journaling specifically about what triggers these feelings\n`;
    }
    
    // Add secondary emotion insights if available
    if (analysis.dominantEmotions.length > 1) {
      const secondEmotion = analysis.dominantEmotions[1];
      recommendations += `\nYou also frequently experience ${secondEmotion.name}. `;
      recommendations += `This combination of ${topEmotion.name} and ${secondEmotion.name} suggests you might benefit from activities that provide both emotional release and stability.\n`;
    }
  }
  
  // Add theme-based personalized recommendations
  if (analysis.themes && analysis.themes.length > 0) {
    const relevantThemes = analysis.themes.filter((theme: string) => 
      theme.toLowerCase().includes('stress') ||
      theme.toLowerCase().includes('anxiety') ||
      theme.toLowerCase().includes('sleep') ||
      theme.toLowerCase().includes('relation') ||
      theme.toLowerCase().includes('work') ||
      theme.toLowerCase().includes('health')
    );
    
    if (relevantThemes.length > 0) {
      recommendations += `\nYour journal entries frequently mention these themes: ${relevantThemes.slice(0, 3).join(", ")}. Based on these patterns, you might benefit from: \n` +
        `- Setting clearer boundaries around work and personal time\n` +
        `- Creating a relaxing bedtime routine that helps with sleep quality\n` +
        `- Scheduling short breaks throughout your day for mental refreshment\n` +
        `- Finding support communities related to your specific challenges\n`;
    }
  }
  
  // Add general wellness practices based on sentiment
  if (analysis.averageSentiment < -0.3) {
    recommendations += "\nYour overall mood has been on the lower side lately. Consider these general wellness practices: \n" +
      "- Ensure you're getting enough sleep (7-9 hours for most adults)\n" +
      "- Spend at least 20 minutes in nature when possible\n" +
      "- Limit exposure to negative news and social media\n" +
      "- Practice small acts of self-care daily, even just 5-10 minutes\n";
  } else if (analysis.averageSentiment > 0.3) {
    recommendations += "\nYour overall mood has been positive lately. To maintain this: \n" +
      "- Continue your current positive habits\n" +
      "- Share your effective techniques with others (which can reinforce them for you)\n" +
      "- Document what's working well for future reference when challenges arise\n";
  }
  
  // Return formatted recommendations with a personalized conclusion
  return recommendations + 
    "\nRemember that consistency with small positive changes often leads to the greatest improvements in mental wellbeing. Based on your journal patterns, focus first on addressing " + 
    (analysis.dominantEmotions?.[0]?.name || "your most prominent emotions") + 
    " through the suggested techniques.\n\n" +
    "Would you like more specific strategies for any of these areas?";
}

// Helper function to safely truncate text
function truncateText(text: string | undefined, maxLength = 50): string {
  if (!text) return "...";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}
