
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
      .eq('user_id', userId)
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
        const sentimentValue = parseFloat(entry.sentiment);
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
    entries.forEach(entry => {
      if (entry.master_themes && Array.isArray(entry.master_themes)) {
        entry.master_themes.forEach(theme => allThemes.add(theme));
      }
    });
    
    // Return the analysis
    return {
      hasEntries: true,
      entryCount: entries.length,
      averageSentiment: avgSentiment,
      dominantEmotions,
      themes: [...allThemes],
      timeRange: timeRange?.periodName || 'recent'
    };
  } catch (error) {
    console.error('Error analyzing mental health entries:', error);
    return null;
  }
}

/**
 * Generate mental health recommendations based on journal analysis
 */
export async function generateMentalHealthRecommendations(analysis: any, userMessage: string) {
  if (!analysis || !analysis.hasEntries) {
    return "I don't have enough journal entries to provide personalized recommendations. Consider adding more entries about your feelings and experiences.";
  }
  
  let recommendations = "";
  
  // Base recommendations on dominant emotions
  if (analysis.dominantEmotions && analysis.dominantEmotions.length > 0) {
    const topEmotion = analysis.dominantEmotions[0];
    
    if (topEmotion.name === 'happy' || topEmotion.name === 'joy' || topEmotion.name === 'content') {
      recommendations += "Based on your journal entries, you've been experiencing positive emotions like " + 
        topEmotion.name + ". To maintain this positive state, consider: \n" +
        "- Continuing activities that bring you joy\n" +
        "- Sharing your positive experiences with others\n" +
        "- Practicing gratitude journaling\n";
    } else if (topEmotion.name === 'sad' || topEmotion.name === 'depressed' || topEmotion.name === 'melancholy') {
      recommendations += "Your entries suggest you've been feeling " + topEmotion.name + 
        ". Some strategies that might help: \n" +
        "- Reach out to friends or family for support\n" +
        "- Consider speaking with a mental health professional\n" +
        "- Engage in small, enjoyable activities daily\n" +
        "- Get some physical exercise, even just a short walk\n";
    } else if (topEmotion.name === 'anxious' || topEmotion.name === 'worried' || topEmotion.name === 'stressed') {
      recommendations += "I notice a pattern of " + topEmotion.name + 
        " in your journals. These techniques may help: \n" +
        "- Practice deep breathing or meditation\n" +
        "- Break large tasks into smaller steps\n" +
        "- Limit caffeine and prioritize sleep\n" +
        "- Consider scheduling worry time to contain anxious thoughts\n";
    } else if (topEmotion.name === 'angry' || topEmotion.name === 'frustrated' || topEmotion.name === 'irritated') {
      recommendations += "Your entries indicate feelings of " + topEmotion.name + 
        ". These approaches might help: \n" +
        "- Remove yourself from triggering situations when possible\n" +
        "- Practice expressing feelings assertively rather than aggressively\n" +
        "- Use physical exercise to release tension\n" +
        "- Try journaling specifically about what triggers these feelings\n";
    }
  }
  
  // Add general recommendations based on sentiment
  if (analysis.averageSentiment < -0.3) {
    recommendations += "\nI notice your overall mood has been low. Consider these general wellness practices: \n" +
      "- Ensure you're getting enough sleep\n" +
      "- Spend time in nature when possible\n" +
      "- Limit exposure to negative news and social media\n" +
      "- Practice small acts of self-care daily\n";
  } else if (analysis.averageSentiment > 0.3) {
    recommendations += "\nYour overall mood has been positive lately. To maintain this: \n" +
      "- Continue your current positive habits\n" +
      "- Share your effective techniques with others\n" +
      "- Document what's working well for future reference\n";
  }
  
  // Add theme-based recommendations
  if (analysis.themes && analysis.themes.length > 0) {
    const relevantThemes = analysis.themes.filter((theme: string) => {
      const lowerTheme = theme.toLowerCase();
      return lowerTheme.includes('stress') || 
             lowerTheme.includes('anxiety') || 
             lowerTheme.includes('sleep') || 
             lowerTheme.includes('relation') || 
             lowerTheme.includes('work') || 
             lowerTheme.includes('health');
    });
    
    if (relevantThemes.length > 0) {
      recommendations += "\nBased on themes in your journal like " + 
        relevantThemes.join(", ") + ", you might benefit from: \n" +
        "- Setting boundaries around work/personal time\n" +
        "- Creating a relaxing bedtime routine\n" +
        "- Scheduling short breaks throughout your day\n" +
        "- Finding support groups related to your specific challenges\n";
    }
  }
  
  // Return formatted recommendations
  return "Based on analyzing your journal entries, here are some personalized mental health recommendations:\n\n" + 
    recommendations + 
    "\nRemember that consistency with small positive changes often leads to the greatest improvements in mental wellbeing.";
}
