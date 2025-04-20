
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get OpenAI API key from environment variable
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

// Define CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, functionName, params } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!functionName) {
      throw new Error('Function name is required');
    }

    console.log(`Processing ${functionName} for user ${userId}`);
    
    let result;
    
    // Route to the appropriate function
    switch (functionName) {
      case 'detect_emotional_volatility':
        result = await detectEmotionalVolatility(userId, params);
        break;
      case 'summarize_life_areas_by_theme':
        result = await summarizeLifeAreasByTheme(userId, params);
        break;
      case 'suggest_reflection_prompts':
        result = await suggestReflectionPrompts(userId, params);
        break;
      case 'compare_with_past_periods':
        result = await compareWithPastPeriods(userId, params);
        break;
      case 'recommend_microhabits':
        result = await recommendMicrohabits(userId, params);
        break;
      case 'detect_silence_periods':
        result = await detectSilencePeriods(userId, params);
        break;
      case 'recommend_shared_entries':
        result = await recommendSharedEntries(userId, params);
        break;
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

/**
 * 1. Detect Emotional Volatility
 * Identify periods of emotional instability or fluctuations
 */
async function detectEmotionalVolatility(userId: string, params: any = {}) {
  const { timeframe = '30days' } = params;
  
  // Parse timeframe to determine date range
  const now = new Date();
  let startDate = new Date();
  
  if (timeframe === '7days') {
    startDate.setDate(now.getDate() - 7);
  } else if (timeframe === '30days') {
    startDate.setDate(now.getDate() - 30);
  } else if (timeframe === '90days') {
    startDate.setDate(now.getDate() - 90);
  } else {
    startDate.setDate(now.getDate() - 30); // Default to 30 days
  }
  
  // Get journal entries for the specified time period
  const { data: entries, error } = await supabase
    .from('Journal Entries')
    .select('id, created_at, emotions, sentiment')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error('Error fetching entries:', error);
    throw new Error('Failed to fetch journal entries');
  }

  if (!entries || entries.length < 3) {
    return {
      hasVolatility: false,
      message: "Not enough journal entries to detect emotional volatility patterns.",
      volatilityScore: 0,
      emotionTimeline: []
    };
  }

  // Process emotions for each day
  const dailyEmotions: Record<string, { 
    date: string; 
    sentimentScore: number; 
    dominantEmotion?: string;
    dominantEmotionScore?: number; 
    emotionCount: number;
  }> = {};
  
  // First pass: collect all emotions by day
  entries.forEach(entry => {
    if (!entry.created_at) return;
    
    const dateStr = entry.created_at.split('T')[0];
    
    if (!dailyEmotions[dateStr]) {
      dailyEmotions[dateStr] = {
        date: dateStr,
        sentimentScore: 0,
        emotionCount: 0
      };
    }
    
    // Process sentiment
    if (entry.sentiment) {
      const sentimentValue = parseFloat(entry.sentiment);
      if (!isNaN(sentimentValue)) {
        dailyEmotions[dateStr].sentimentScore += sentimentValue;
        dailyEmotions[dateStr].emotionCount++;
      }
    }
    
    // Process emotions
    if (entry.emotions) {
      try {
        let emotions;
        if (typeof entry.emotions === 'string') {
          emotions = JSON.parse(entry.emotions);
        } else {
          emotions = entry.emotions;
        }
        
        // Handle different emotion formats
        if (Array.isArray(emotions.emotions)) {
          // Format: { emotions: [{name: "happy", intensity: 0.8}, ...] }
          const topEmotion = emotions.emotions.sort((a, b) => b.intensity - a.intensity)[0];
          if (topEmotion && dailyEmotions[dateStr].dominantEmotionScore === undefined || 
              (topEmotion.intensity > (dailyEmotions[dateStr].dominantEmotionScore || 0))) {
            dailyEmotions[dateStr].dominantEmotion = topEmotion.name;
            dailyEmotions[dateStr].dominantEmotionScore = topEmotion.intensity;
          }
        } else {
          // Format: {happy: 0.8, sad: 0.2, ...}
          Object.entries(emotions).forEach(([emotion, score]) => {
            if (typeof score === 'number' && (dailyEmotions[dateStr].dominantEmotionScore === undefined || 
                score > (dailyEmotions[dateStr].dominantEmotionScore || 0))) {
              dailyEmotions[dateStr].dominantEmotion = emotion;
              dailyEmotions[dateStr].dominantEmotionScore = score;
            }
          });
        }
      } catch (e) {
        console.error('Error processing emotions:', e);
      }
    }
  });
  
  // Second pass: calculate daily averages
  const dailyEmotionArray = Object.values(dailyEmotions).map(day => {
    if (day.emotionCount > 0) {
      day.sentimentScore = day.sentimentScore / day.emotionCount;
    }
    return day;
  });
  
  // Calculate volatility score
  let volatilityScore = 0;
  const sentimentChanges = [];
  
  if (dailyEmotionArray.length >= 2) {
    for (let i = 1; i < dailyEmotionArray.length; i++) {
      const today = dailyEmotionArray[i];
      const yesterday = dailyEmotionArray[i-1];
      
      const sentimentChange = Math.abs(today.sentimentScore - yesterday.sentimentScore);
      sentimentChanges.push({
        from: yesterday.date,
        to: today.date,
        change: sentimentChange,
        fromEmotion: yesterday.dominantEmotion,
        toEmotion: today.dominantEmotion
      });
      
      // Add to volatility score if change is significant
      if (sentimentChange > 0.4) { // Threshold for significant change
        volatilityScore += sentimentChange;
      }
    }
  }
  
  // Sort changes by magnitude
  sentimentChanges.sort((a, b) => b.change - a.change);
  
  // Get highest volatility periods (up to 3)
  const topChanges = sentimentChanges.slice(0, 3);
  
  // Normalize volatility score between 0-100
  const normalizedScore = Math.min(100, Math.round(volatilityScore * 50));
  
  // Final result
  return {
    hasVolatility: normalizedScore > 30,
    volatilityScore: normalizedScore,
    significantChanges: topChanges,
    emotionTimeline: dailyEmotionArray,
    summary: generateVolatilitySummary(normalizedScore, topChanges, dailyEmotionArray)
  };
}

function generateVolatilitySummary(score: number, topChanges: any[], timeline: any[]) {
  if (score < 20) {
    return "Your emotional state has been relatively stable during this period, with minimal fluctuations.";
  } else if (score < 50) {
    return "You've experienced some emotional shifts during this period, with a few notable changes in your mood.";
  } else if (score < 75) {
    return "Your emotional landscape shows significant volatility, with several major shifts in your emotional state.";
  } else {
    return "You're experiencing a highly dynamic emotional period with frequent and intense emotional shifts.";
  }
}

/**
 * 2. Summarize Life Areas by Theme
 * Cluster journal entries into life categories
 */
async function summarizeLifeAreasByTheme(userId: string, params: any = {}) {
  const { timeframe = '30days' } = params;
  
  // Parse timeframe to determine date range
  const now = new Date();
  let startDate = new Date();
  
  if (timeframe === '7days') {
    startDate.setDate(now.getDate() - 7);
  } else if (timeframe === '30days') {
    startDate.setDate(now.getDate() - 30);
  } else if (timeframe === '90days') {
    startDate.setDate(now.getDate() - 90);
  } else {
    startDate.setDate(now.getDate() - 30); // Default to 30 days
  }
  
  // Get journal entries with themes for the specified time period
  const { data: entries, error } = await supabase
    .from('Journal Entries')
    .select('id, created_at, master_themes, emotions, sentiment, refined text, transcription text')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching entries:', error);
    throw new Error('Failed to fetch journal entries');
  }

  if (!entries || entries.length === 0) {
    return {
      lifeAreas: [],
      message: "No journal entries found for the specified time period."
    };
  }

  // Define common life categories to map themes to
  const lifeCategoryMappings = {
    work: ['work', 'job', 'career', 'business', 'professional', 'workplace', 'colleague', 'boss', 'coworker', 'office'],
    relationships: ['relationship', 'partner', 'spouse', 'boyfriend', 'girlfriend', 'husband', 'wife', 'marriage', 'date', 'romantic'],
    family: ['family', 'parent', 'child', 'mother', 'father', 'sibling', 'brother', 'sister', 'son', 'daughter'],
    health: ['health', 'fitness', 'exercise', 'workout', 'gym', 'diet', 'nutrition', 'sleep', 'medical', 'sick', 'illness'],
    mentalHealth: ['anxiety', 'stress', 'depression', 'therapy', 'counseling', 'mental health', 'emotions', 'feelings', 'mood', 'meditation', 'mindfulness'],
    finance: ['money', 'finance', 'financial', 'budget', 'saving', 'investment', 'expense', 'debt', 'income', 'wealth'],
    leisure: ['hobby', 'leisure', 'fun', 'entertainment', 'vacation', 'travel', 'game', 'sport', 'relax', 'recreation'],
    creativity: ['creative', 'art', 'write', 'writing', 'music', 'paint', 'craft', 'design', 'create', 'project'],
    spirituality: ['spiritual', 'religion', 'faith', 'belief', 'pray', 'meditation', 'soul', 'spirit', 'divine', 'universe'],
    learning: ['learn', 'study', 'education', 'course', 'school', 'university', 'college', 'knowledge', 'skill', 'growth'],
    social: ['friend', 'social', 'party', 'gathering', 'community', 'network', 'connection', 'people', 'group', 'society']
  };
  
  // Initialize life areas
  const lifeAreas: Record<string, {
    category: string;
    entryCount: number;
    averageSentiment: number;
    dominantEmotions: Record<string, number>;
    recentEntry?: {
      date: string;
      snippet: string;
    };
    keyThemes: string[];
  }> = {};
  
  // Initialize each category
  Object.keys(lifeCategoryMappings).forEach(category => {
    lifeAreas[category] = {
      category,
      entryCount: 0,
      averageSentiment: 0,
      dominantEmotions: {},
      keyThemes: []
    };
  });

  // Map entries to life areas
  entries.forEach(entry => {
    const themes = entry.master_themes || [];
    const content = entry.refined text || entry.transcription text || '';
    const sentimentValue = entry.sentiment ? parseFloat(entry.sentiment) : null;
    const emotions = entry.emotions || {};
    
    // Track which categories this entry matched
    const matchedCategories = new Set<string>();
    
    // Check themes for category matches
    themes.forEach(theme => {
      Object.entries(lifeCategoryMappings).forEach(([category, keywords]) => {
        const themeStr = theme.toLowerCase();
        if (keywords.some(keyword => themeStr.includes(keyword))) {
          matchedCategories.add(category);
        }
      });
    });
    
    // Check content for category matches if no themes matched
    if (matchedCategories.size === 0 && content) {
      const contentLower = content.toLowerCase();
      Object.entries(lifeCategoryMappings).forEach(([category, keywords]) => {
        if (keywords.some(keyword => contentLower.includes(keyword))) {
          matchedCategories.add(category);
        }
      });
    }
    
    // Update matched categories
    matchedCategories.forEach(category => {
      const area = lifeAreas[category];
      area.entryCount++;
      
      // Update sentiment
      if (sentimentValue !== null) {
        const currentTotal = area.averageSentiment * (area.entryCount - 1);
        area.averageSentiment = (currentTotal + sentimentValue) / area.entryCount;
      }
      
      // Update emotions
      if (emotions) {
        try {
          let emotionsData;
          if (typeof emotions === 'string') {
            emotionsData = JSON.parse(emotions);
          } else {
            emotionsData = emotions;
          }
          
          if (Array.isArray(emotionsData.emotions)) {
            // Format: { emotions: [{name: "happy", intensity: 0.8}, ...] }
            emotionsData.emotions.forEach((emotion: any) => {
              if (emotion.name && emotion.intensity) {
                area.dominantEmotions[emotion.name] = (area.dominantEmotions[emotion.name] || 0) + emotion.intensity;
              }
            });
          } else {
            // Format: {happy: 0.8, sad: 0.2, ...}
            Object.entries(emotionsData).forEach(([emotion, score]) => {
              if (typeof score === 'number') {
                area.dominantEmotions[emotion] = (area.dominantEmotions[emotion] || 0) + score;
              }
            });
          }
        } catch (e) {
          console.error('Error processing emotions:', e);
        }
      }
      
      // Update themes
      themes.forEach(theme => {
        if (!area.keyThemes.includes(theme)) {
          area.keyThemes.push(theme);
        }
      });
      
      // Update recent entry
      if (!area.recentEntry || new Date(entry.created_at) > new Date(area.recentEntry.date)) {
        area.recentEntry = {
          date: entry.created_at,
          snippet: content.substring(0, 150) + (content.length > 150 ? '...' : '')
        };
      }
    });
  });
  
  // Process areas for final results
  const results = Object.values(lifeAreas)
    .filter(area => area.entryCount > 0)
    .map(area => {
      // Sort emotions by frequency
      const sortedEmotions = Object.entries(area.dominantEmotions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([emotion, score]) => ({ emotion, score: score / area.entryCount }));
      
      // Update the dominantEmotions property with the sorted array
      return {
        ...area,
        dominantEmotions: sortedEmotions,
        keyThemes: area.keyThemes.slice(0, 5)
      };
    })
    .sort((a, b) => b.entryCount - a.entryCount);

  return {
    timeframe,
    lifeAreas: results,
    summary: generateLifeAreasSummary(results)
  };
}

function generateLifeAreasSummary(areas: any[]) {
  if (areas.length === 0) {
    return "No life areas identified in your journal entries.";
  }
  
  const topAreas = areas.slice(0, 3);
  const areaNames = topAreas.map(a => a.category.charAt(0).toUpperCase() + a.category.slice(1)).join(', ');
  
  return `Your journal entries mainly focus on ${areaNames}. ${topAreas[0].category.charAt(0).toUpperCase() + topAreas[0].category.slice(1)} appears to be your primary focus with ${topAreas[0].entryCount} entries.`;
}

/**
 * 3. Suggest Reflection Prompts
 * Based on recurring themes or gaps in journaling
 */
async function suggestReflectionPrompts(userId: string, params: any = {}) {
  const { timeframe = '30days', count = 5 } = params;
  
  // Parse timeframe to determine date range
  const now = new Date();
  let startDate = new Date();
  
  if (timeframe === '7days') {
    startDate.setDate(now.getDate() - 7);
  } else if (timeframe === '30days') {
    startDate.setDate(now.getDate() - 30);
  } else if (timeframe === '90days') {
    startDate.setDate(now.getDate() - 90);
  } else {
    startDate.setDate(now.getDate() - 30); // Default to 30 days
  }
  
  // Get journal entries for the specified time period
  const { data: entries, error } = await supabase
    .from('Journal Entries')
    .select('id, created_at, master_themes, emotions, refined text, transcription text')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching entries:', error);
    throw new Error('Failed to fetch journal entries');
  }

  if (!entries || entries.length === 0) {
    return {
      prompts: getGeneralPrompts(count),
      message: "No journal entries found. Here are some general reflection prompts."
    };
  }
  
  // Analyze content and themes
  const allThemes = new Set<string>();
  const themeCounts: Record<string, number> = {};
  const emotionCounts: Record<string, number> = {};
  let totalContent = '';
  
  entries.forEach(entry => {
    // Process themes
    const themes = entry.master_themes || [];
    themes.forEach(theme => {
      allThemes.add(theme);
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    });
    
    // Process emotions
    if (entry.emotions) {
      try {
        let emotions;
        if (typeof entry.emotions === 'string') {
          emotions = JSON.parse(entry.emotions);
        } else {
          emotions = entry.emotions;
        }
        
        if (Array.isArray(emotions.emotions)) {
          // Format: { emotions: [{name: "happy", intensity: 0.8}, ...] }
          emotions.emotions.forEach((emotion: any) => {
            if (emotion.name) {
              emotionCounts[emotion.name] = (emotionCounts[emotion.name] || 0) + 1;
            }
          });
        } else {
          // Format: {happy: 0.8, sad: 0.2, ...}
          Object.keys(emotions).forEach(emotion => {
            if (emotion.length > 1 && !emotion.match(/^\d+$/)) {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
            }
          });
        }
      } catch (e) {
        console.error('Error processing emotions:', e);
      }
    }
    
    // Add content
    const content = entry.refined text || entry.transcription text || '';
    if (content) {
      totalContent += ' ' + content;
    }
  });
  
  // Get top themes and emotions
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);
    
  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emotion]) => emotion);
  
  // Find infrequent emotions (to encourage exploration)
  const infrequentEmotions = Object.entries(emotionCounts)
    .filter(([_, count]) => count <= 2)
    .map(([emotion]) => emotion);
  
  // Generate prompts based on analysis
  const reflectionPrompts = [];
  
  // Add theme-based prompts
  if (topThemes.length > 0) {
    topThemes.forEach(theme => {
      reflectionPrompts.push(`How has your perspective on ${theme.toLowerCase()} evolved since you first wrote about it?`);
      reflectionPrompts.push(`What specific actions could you take to improve your experience with ${theme.toLowerCase()}?`);
    });
  }
  
  // Add emotion-based prompts
  if (topEmotions.length > 0) {
    topEmotions.forEach(emotion => {
      reflectionPrompts.push(`You often mention feeling ${emotion.toLowerCase()}. What triggers this emotion for you?`);
      reflectionPrompts.push(`When you feel ${emotion.toLowerCase()}, what strategies help you navigate this emotion?`);
    });
  }
  
  // Add prompts for exploring less-mentioned emotions
  if (infrequentEmotions.length > 0) {
    infrequentEmotions.slice(0, 3).forEach(emotion => {
      reflectionPrompts.push(`You rarely mention feeling ${emotion.toLowerCase()}. Can you recall a recent situation where you experienced this emotion?`);
    });
  }
  
  // Add time-based reflection
  reflectionPrompts.push("What patterns or cycles have you noticed in your life over the past month?");
  reflectionPrompts.push("How do your emotions typically shift throughout your day?");
  
  // Add growth-focused prompts
  reflectionPrompts.push("What's one small step you could take today toward a goal you care about?");
  reflectionPrompts.push("What's a lesson you've learned recently that you want to remember?");
  
  // Add prompts using OpenAI to generate personalized prompts
  if (topThemes.length > 0 || totalContent.length > 0) {
    try {
      const aiPrompts = await generateAIPrompts(
        totalContent.substring(0, 2000), 
        topThemes, 
        topEmotions
      );
      
      if (aiPrompts.length > 0) {
        reflectionPrompts.push(...aiPrompts);
      }
    } catch (e) {
      console.error('Error generating AI prompts:', e);
    }
  }
  
  // Shuffle and limit to requested count
  const shuffled = reflectionPrompts.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);
  
  return {
    prompts: selected,
    topThemes,
    topEmotions
  };
}

async function generateAIPrompts(contentSample: string, themes: string[], emotions: string[]) {
  try {
    const themesStr = themes.join(', ');
    const emotionsStr = emotions.join(', ');
    
    const prompt = `Create 3 insightful and specific journaling prompts based on these themes: ${themesStr} and emotions: ${emotionsStr}. The prompts should be thought-provoking, personal, and help with self-discovery. Each prompt should be a single sentence ending with a question mark. Don't include numbers, bullet points, or any formatting.`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a thoughtful journaling assistant that creates deep, meaningful prompts.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });
    
    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      return [];
    }
    
    // Process the response to extract individual prompts
    const content = data.choices[0].message.content;
    
    // Split by lines and clean each line
    let prompts = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5 && line.includes('?'))
      .map(line => {
        // Remove numbers, bullets, or other prefixes
        return line.replace(/^\d+\.|\*|-|\–|\—/g, '').trim();
      });
    
    return prompts;
  } catch (error) {
    console.error('Error generating AI prompts:', error);
    return [];
  }
}

function getGeneralPrompts(count: number) {
  const generalPrompts = [
    "What brought you joy today and why?",
    "What's something you're looking forward to, and what about it excites you?",
    "What are three things you're grateful for today?",
    "How did you practice self-care today?",
    "What was challenging today and how did you handle it?",
    "What's something you learned recently that changed your perspective?",
    "If you could talk to your past self from one year ago, what would you say?",
    "What boundaries do you need to set or maintain in your life right now?",
    "What does your ideal day look like, from morning to night?",
    "When do you feel most like yourself? What are you doing and who are you with?",
    "What are you currently worried about, and what's one small step you could take to address it?",
    "What's a recent change you've noticed in yourself?",
    "What makes you feel truly alive and present?",
    "What would you attempt if you knew you couldn't fail?",
    "How are you different today than you were a year ago?",
    "What patterns or habits have you noticed in your life recently?",
    "What's a small win you had recently that you haven't acknowledged?",
    "What are you avoiding dealing with, and why?",
    "If your emotions from today were weather, what would the forecast be?",
    "What relationships in your life need more attention right now?"
  ];
  
  // Shuffle and limit to requested count
  const shuffled = generalPrompts.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * 4. Compare with Past Periods
 * Compare current period with previous ones to detect growth, stagnation, or decline
 */
async function compareWithPastPeriods(userId: string, params: any = {}) {
  const { 
    currentPeriod = '30days',
    comparisonPeriod = 'previous'  // 'previous' or 'year_ago'
  } = params;
  
  // Determine date ranges
  const now = new Date();
  let currentStartDate = new Date();
  let currentEndDate = new Date(now);
  let previousStartDate: Date;
  let previousEndDate: Date;
  
  // Set current period range
  if (currentPeriod === '7days') {
    currentStartDate.setDate(now.getDate() - 7);
  } else if (currentPeriod === '30days') {
    currentStartDate.setDate(now.getDate() - 30);
  } else if (currentPeriod === '90days') {
    currentStartDate.setDate(now.getDate() - 90);
  } else {
    currentStartDate.setDate(now.getDate() - 30); // Default to 30 days
  }
  
  // Calculate duration in days
  const durationDays = Math.round((currentEndDate.getTime() - currentStartDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Set comparison period range
  if (comparisonPeriod === 'previous') {
    // Previous period of the same length
    previousEndDate = new Date(currentStartDate);
    previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousEndDate.getDate() - durationDays);
  } else if (comparisonPeriod === 'year_ago') {
    // Same period but a year ago
    previousStartDate = new Date(currentStartDate);
    previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
    previousEndDate = new Date(currentEndDate);
    previousEndDate.setFullYear(previousEndDate.getFullYear() - 1);
  } else {
    // Default to previous period
    previousEndDate = new Date(currentStartDate);
    previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousEndDate.getDate() - durationDays);
  }
  
  // Format dates for queries
  const currentStartString = currentStartDate.toISOString();
  const currentEndString = currentEndDate.toISOString();
  const previousStartString = previousStartDate.toISOString();
  const previousEndString = previousEndDate.toISOString();
  
  // Get current period entries
  const { data: currentEntries, error: currentError } = await supabase
    .from('Journal Entries')
    .select('id, created_at, master_themes, emotions, sentiment, refined text, transcription text')
    .eq('user_id', userId)
    .gte('created_at', currentStartString)
    .lte('created_at', currentEndString)
    .order('created_at', { ascending: false });
    
  if (currentError) {
    console.error('Error fetching current entries:', currentError);
    throw new Error('Failed to fetch current period journal entries');
  }

  // Get previous period entries
  const { data: previousEntries, error: previousError } = await supabase
    .from('Journal Entries')
    .select('id, created_at, master_themes, emotions, sentiment, refined text, transcription text')
    .eq('user_id', userId)
    .gte('created_at', previousStartString)
    .lte('created_at', previousEndString)
    .order('created_at', { ascending: false });
    
  if (previousError) {
    console.error('Error fetching previous entries:', previousError);
    throw new Error('Failed to fetch previous period journal entries');
  }

  // Analyze periods
  const currentPeriodData = analyzeJournalPeriod(currentEntries || []);
  const previousPeriodData = analyzeJournalPeriod(previousEntries || []);
  
  // Compare and calculate changes
  const comparison = compareJournalPeriods(currentPeriodData, previousPeriodData);
  
  // Generate summary
  const summary = generateComparisonSummary(comparison, currentPeriodData, previousPeriodData);
  
  return {
    currentPeriod: {
      startDate: currentStartString,
      endDate: currentEndString,
      durationDays,
      ...currentPeriodData
    },
    previousPeriod: {
      startDate: previousStartString,
      endDate: previousEndString,
      durationDays,
      ...previousPeriodData
    },
    comparison,
    summary
  };
}

function analyzeJournalPeriod(entries: any[]) {
  if (!entries || entries.length === 0) {
    return {
      entryCount: 0,
      averageSentiment: null,
      emotionFrequency: {},
      topThemes: [],
      entryFrequency: 0
    };
  }
  
  // Basic metrics
  const entryCount = entries.length;
  
  // Calculate sentiment average
  let sentimentSum = 0;
  let sentimentCount = 0;
  
  // Track emotions
  const emotionCounts: Record<string, number> = {};
  
  // Track themes
  const themeCounts: Record<string, number> = {};
  
  // Process all entries
  entries.forEach(entry => {
    // Process sentiment
    if (entry.sentiment) {
      const sentimentValue = parseFloat(entry.sentiment);
      if (!isNaN(sentimentValue)) {
        sentimentSum += sentimentValue;
        sentimentCount++;
      }
    }
    
    // Process emotions
    if (entry.emotions) {
      try {
        let emotions;
        if (typeof entry.emotions === 'string') {
          emotions = JSON.parse(entry.emotions);
        } else {
          emotions = entry.emotions;
        }
        
        if (Array.isArray(emotions.emotions)) {
          // Format: { emotions: [{name: "happy", intensity: 0.8}, ...] }
          emotions.emotions.forEach((emotion: any) => {
            if (emotion.name) {
              emotionCounts[emotion.name] = (emotionCounts[emotion.name] || 0) + 1;
            }
          });
        } else {
          // Format: {happy: 0.8, sad: 0.2, ...}
          Object.keys(emotions).forEach(emotion => {
            if (emotion.length > 1 && !emotion.match(/^\d+$/)) {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
            }
          });
        }
      } catch (e) {
        console.error('Error processing emotions:', e);
      }
    }
    
    // Process themes
    const themes = entry.master_themes || [];
    themes.forEach((theme: string) => {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    });
  });
  
  // Calculate average sentiment
  const averageSentiment = sentimentCount > 0 ? sentimentSum / sentimentCount : null;
  
  // Get top emotions
  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emotion, count]) => ({ 
      emotion, 
      count, 
      percentage: Math.round((count / entryCount) * 100)
    }));
  
  // Get top themes
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme, count]) => ({ 
      theme, 
      count, 
      percentage: Math.round((count / entryCount) * 100)
    }));
  
  // Calculate entry frequency (entries per day)
  const firstEntry = new Date(entries[entries.length - 1].created_at);
  const lastEntry = new Date(entries[0].created_at);
  const daySpan = Math.max(1, Math.round((lastEntry.getTime() - firstEntry.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const entryFrequency = entryCount / daySpan;
  
  return {
    entryCount,
    averageSentiment,
    emotionFrequency: topEmotions,
    topThemes,
    entryFrequency
  };
}

function compareJournalPeriods(current: any, previous: any) {
  if (!previous.entryCount) {
    return {
      hasPreviousData: false,
      entryCountChange: 100, // 100% increase from 0
      sentimentChange: 0,
      journalingFrequencyChange: 100, // 100% increase from 0
      emotionShifts: [],
      themeShifts: []
    };
  }
  
  // Calculate basic metric changes
  const entryCountChange = previous.entryCount > 0 
    ? ((current.entryCount - previous.entryCount) / previous.entryCount) * 100 
    : 100;
    
  const sentimentChange = (current.averageSentiment !== null && previous.averageSentiment !== null)
    ? current.averageSentiment - previous.averageSentiment
    : 0;
    
  const journalingFrequencyChange = previous.entryFrequency > 0
    ? ((current.entryFrequency - previous.entryFrequency) / previous.entryFrequency) * 100
    : 100;
  
  // Compare emotions
  const emotionShifts: any[] = [];
  const currentEmotions = current.emotionFrequency.reduce((acc: any, e: any) => {
    acc[e.emotion] = e;
    return acc;
  }, {});
  const previousEmotions = previous.emotionFrequency.reduce((acc: any, e: any) => {
    acc[e.emotion] = e;
    return acc;
  }, {});
  
  // Find emotions with significant changes
  const allEmotions = new Set([
    ...current.emotionFrequency.map((e: any) => e.emotion),
    ...previous.emotionFrequency.map((e: any) => e.emotion)
  ]);
  
  allEmotions.forEach(emotion => {
    const currentEmotion = currentEmotions[emotion];
    const previousEmotion = previousEmotions[emotion];
    
    if (currentEmotion && previousEmotion) {
      // Emotion exists in both periods
      const percentageChange = ((currentEmotion.percentage - previousEmotion.percentage) / previousEmotion.percentage) * 100;
      if (Math.abs(percentageChange) >= 20) { // Only include significant changes (20% or more)
        emotionShifts.push({
          emotion,
          changeType: percentageChange > 0 ? 'increase' : 'decrease',
          percentageChange: Math.round(percentageChange)
        });
      }
    } else if (currentEmotion && !previousEmotion) {
      // New emotion
      emotionShifts.push({
        emotion,
        changeType: 'new',
        percentageChange: 100
      });
    } else if (!currentEmotion && previousEmotion) {
      // Emotion disappeared
      emotionShifts.push({
        emotion,
        changeType: 'disappeared',
        percentageChange: -100
      });
    }
  });
  
  // Sort emotion shifts by absolute percentage change
  emotionShifts.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange));
  
  // Compare themes - similar approach as emotions
  const themeShifts: any[] = [];
  const currentThemes = current.topThemes.reduce((acc: any, t: any) => {
    acc[t.theme] = t;
    return acc;
  }, {});
  const previousThemes = previous.topThemes.reduce((acc: any, t: any) => {
    acc[t.theme] = t;
    return acc;
  }, {});
  
  const allThemes = new Set([
    ...current.topThemes.map((t: any) => t.theme),
    ...previous.topThemes.map((t: any) => t.theme)
  ]);
  
  allThemes.forEach(theme => {
    const currentTheme = currentThemes[theme];
    const previousTheme = previousThemes[theme];
    
    if (currentTheme && previousTheme) {
      // Theme exists in both periods
      const percentageChange = ((currentTheme.percentage - previousTheme.percentage) / previousTheme.percentage) * 100;
      if (Math.abs(percentageChange) >= 20) { // Only include significant changes (20% or more)
        themeShifts.push({
          theme,
          changeType: percentageChange > 0 ? 'increase' : 'decrease',
          percentageChange: Math.round(percentageChange)
        });
      }
    } else if (currentTheme && !previousTheme) {
      // New theme
      themeShifts.push({
        theme,
        changeType: 'new',
        percentageChange: 100
      });
    } else if (!currentTheme && previousTheme) {
      // Theme disappeared
      themeShifts.push({
        theme,
        changeType: 'disappeared',
        percentageChange: -100
      });
    }
  });
  
  // Sort theme shifts by absolute percentage change
  themeShifts.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange));
  
  return {
    hasPreviousData: true,
    entryCountChange: Math.round(entryCountChange),
    sentimentChange,
    journalingFrequencyChange: Math.round(journalingFrequencyChange),
    emotionShifts: emotionShifts.slice(0, 5), // Top 5 emotion shifts
    themeShifts: themeShifts.slice(0, 5) // Top 5 theme shifts
  };
}

function generateComparisonSummary(comparison: any, current: any, previous: any) {
  if (!comparison.hasPreviousData) {
    return "No previous data available for comparison.";
  }
  
  const parts = [];
  
  // Journal frequency
  if (comparison.entryCountChange > 20) {
    parts.push(`You've journaled ${comparison.entryCountChange}% more in this period compared to the previous one.`);
  } else if (comparison.entryCountChange < -20) {
    parts.push(`Your journaling has decreased by ${Math.abs(comparison.entryCountChange)}% compared to the previous period.`);
  } else {
    parts.push(`Your journaling frequency has remained relatively stable.`);
  }
  
  // Sentiment
  if (comparison.sentimentChange > 0.2) {
    parts.push(`Your overall emotional tone has become more positive.`);
  } else if (comparison.sentimentChange < -0.2) {
    parts.push(`Your overall emotional tone has become more negative.`);
  } else {
    parts.push(`Your overall emotional sentiment has stayed fairly consistent.`);
  }
  
  // Top emotions and themes
  if (comparison.emotionShifts.length > 0) {
    const topShift = comparison.emotionShifts[0];
    if (topShift.changeType === 'increase') {
      parts.push(`You've experienced a ${topShift.percentageChange}% increase in feelings of ${topShift.emotion}.`);
    } else if (topShift.changeType === 'decrease') {
      parts.push(`You've experienced a ${Math.abs(topShift.percentageChange)}% decrease in feelings of ${topShift.emotion}.`);
    } else if (topShift.changeType === 'new') {
      parts.push(`${topShift.emotion} has emerged as a new significant emotion in your journal entries.`);
    }
  }
  
  if (comparison.themeShifts.length > 0) {
    const topThemeShift = comparison.themeShifts[0];
    if (topThemeShift.changeType === 'increase') {
      parts.push(`You're writing ${topThemeShift.percentageChange}% more about ${topThemeShift.theme}.`);
    } else if (topThemeShift.changeType === 'decrease') {
      parts.push(`You're writing ${Math.abs(topThemeShift.percentageChange)}% less about ${topThemeShift.theme}.`);
    } else if (topThemeShift.changeType === 'new') {
      parts.push(`${topThemeShift.theme} has emerged as a new significant theme in your entries.`);
    }
  }
  
  // Join parts
  return parts.join(' ');
}

/**
 * 6. Recommend Microhabits
 * Based on emotion patterns, suggest small actions or habits
 */
async function recommendMicrohabits(userId: string, params: any = {}) {
  const { timeframe = '30days', count = 5 } = params;
  
  // Parse timeframe to determine date range
  const now = new Date();
  let startDate = new Date();
  
  if (timeframe === '7days') {
    startDate.setDate(now.getDate() - 7);
  } else if (timeframe === '30days') {
    startDate.setDate(now.getDate() - 30);
  } else if (timeframe === '90days') {
    startDate.setDate(now.getDate() - 90);
  } else {
    startDate.setDate(now.getDate() - 30); // Default to 30 days
  }
  
  // Get journal entries for the specified time period
  const { data: entries, error } = await supabase
    .from('Journal Entries')
    .select('id, created_at, master_themes, emotions, sentiment, refined text, transcription text')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching entries:', error);
    throw new Error('Failed to fetch journal entries');
  }

  if (!entries || entries.length === 0) {
    return {
      habits: getGeneralHabits(count),
      message: "No journal entries found. Here are some general microhabit suggestions."
    };
  }
  
  // Analyze emotions and themes
  const emotionCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};
  let overallSentiment = 0;
  let sentimentCount = 0;
  let negativeBiasCount = 0;
  
  // Common categories for habits
  const habitCategories = [
    'emotional-regulation',
    'stress-management',
    'focus-productivity',
    'mindfulness',
    'physical-health',
    'social-connection',
    'gratitude-positivity',
    'creativity',
    'learning-growth'
  ];
  
  // Category need scores
  const categoryNeeds: Record<string, number> = {};
  habitCategories.forEach(category => {
    categoryNeeds[category] = 0;
  });
  
  // Process entries
  entries.forEach(entry => {
    // Process sentiment
    if (entry.sentiment) {
      const sentimentValue = parseFloat(entry.sentiment);
      if (!isNaN(sentimentValue)) {
        overallSentiment += sentimentValue;
        sentimentCount++;
        
        // Track negative bias
        if (sentimentValue < -0.2) {
          negativeBiasCount++;
        }
        
        // Update category needs based on sentiment
        if (sentimentValue < -0.3) {
          categoryNeeds['emotional-regulation'] += 1;
          categoryNeeds['gratitude-positivity'] += 1;
        }
        if (sentimentValue < -0.5) {
          categoryNeeds['stress-management'] += 1;
          categoryNeeds['mindfulness'] += 1;
        }
      }
    }
    
    // Process emotions
    if (entry.emotions) {
      try {
        let emotions;
        if (typeof entry.emotions === 'string') {
          emotions = JSON.parse(entry.emotions);
        } else {
          emotions = entry.emotions;
        }
        
        const processedEmotions: Record<string, number> = {};
        
        if (Array.isArray(emotions.emotions)) {
          // Format: { emotions: [{name: "happy", intensity: 0.8}, ...] }
          emotions.emotions.forEach((emotion: any) => {
            if (emotion.name) {
              const emotionName = emotion.name.toLowerCase();
              emotionCounts[emotionName] = (emotionCounts[emotionName] || 0) + 1;
              processedEmotions[emotionName] = emotion.intensity || 0.5;
            }
          });
        } else {
          // Format: {happy: 0.8, sad: 0.2, ...}
          Object.entries(emotions).forEach(([emotion, intensity]) => {
            if (emotion.length > 1 && !emotion.match(/^\d+$/)) {
              const emotionName = emotion.toLowerCase();
              emotionCounts[emotionName] = (emotionCounts[emotionName] || 0) + 1;
              processedEmotions[emotionName] = typeof intensity === 'number' ? intensity : 0.5;
            }
          });
        }
        
        // Update category needs based on emotions
        // Stress indicators
        ['stress', 'anxious', 'overwhelmed', 'worried', 'tense'].forEach(e => {
          if (processedEmotions[e] > 0.4) {
            categoryNeeds['stress-management'] += processedEmotions[e];
            categoryNeeds['mindfulness'] += processedEmotions[e] * 0.7;
          }
        });
        
        // Emotional regulation needs
        ['angry', 'frustrated', 'irritated', 'sad', 'depressed'].forEach(e => {
          if (processedEmotions[e] > 0.4) {
            categoryNeeds['emotional-regulation'] += processedEmotions[e];
            categoryNeeds['mindfulness'] += processedEmotions[e] * 0.5;
          }
        });
        
        // Focus/productivity needs
        ['distracted', 'scattered', 'unfocused', 'confused'].forEach(e => {
          if (processedEmotions[e] > 0.3) {
            categoryNeeds['focus-productivity'] += processedEmotions[e];
          }
        });
        
        // Social needs
        ['lonely', 'isolated', 'disconnected'].forEach(e => {
          if (processedEmotions[e] > 0.3) {
            categoryNeeds['social-connection'] += processedEmotions[e] * 1.5;
          }
        });
        
        // Gratitude/positivity needs
        ['grateful', 'happy', 'content', 'satisfied'].forEach(e => {
          if (processedEmotions[e] < 0.3 && emotionCounts[e]) {
            categoryNeeds['gratitude-positivity'] += 0.5;
          }
        });
      } catch (e) {
        console.error('Error processing emotions:', e);
      }
    }
    
    // Process themes and content
    const themes = entry.master_themes || [];
    themes.forEach((theme: string) => {
      themeCounts[theme.toLowerCase()] = (themeCounts[theme.toLowerCase()] || 0) + 1;
    });
    
    // Check content for specific keywords
    const content = (entry.refined text || entry.transcription text || '').toLowerCase();
    
    // Physical health indicators
    if (/(tired|exhausted|fatigue|no energy|drained|sleep|insomnia)/i.test(content)) {
      categoryNeeds['physical-health'] += 1;
    }
    
    // Creativity indicators
    if (/(bored|routine|same thing|monotonous|inspiration|creative)/i.test(content)) {
      categoryNeeds['creativity'] += 0.8;
    }
    
    // Learning indicators
    if (/(learn|study|grow|progress|improve|develop|skill|knowledge)/i.test(content)) {
      categoryNeeds['learning-growth'] += 0.7;
    }
  });
  
  // Calculate average sentiment
  const avgSentiment = sentimentCount > 0 ? overallSentiment / sentimentCount : 0;
  
  // Get top emotions
  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emotion]) => emotion);
  
  // Get top themes
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);
  
  // Negative bias percentage
  const negativeBiasPercentage = sentimentCount > 0 
    ? (negativeBiasCount / sentimentCount) * 100 
    : 0;
  
  // Sort categories by need score
  const priorityCategories = Object.entries(categoryNeeds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);
  
  // Get habit suggestions for priority categories
  const habitSuggestions = [];
  
  // Determine habits based on priority categories
  for (const category of priorityCategories) {
    const categoryHabits = getHabitsByCategory(category);
    habitSuggestions.push(...categoryHabits);
  }
  
  // If we still need more habits, add from other good general categories
  if (habitSuggestions.length < count) {
    const generalCategories = ['mindfulness', 'gratitude-positivity', 'physical-health']
      .filter(cat => !priorityCategories.includes(cat));
      
    for (const category of generalCategories) {
      if (habitSuggestions.length < count) {
        const categoryHabits = getHabitsByCategory(category);
        habitSuggestions.push(...categoryHabits);
      }
    }
  }
  
  // Shuffle and limit to requested count
  const shuffled = habitSuggestions
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
  
  // Add AI generated habits if we have enough data
  if (topEmotions.length > 0 || topThemes.length > 0) {
    try {
      const aiHabits = await generateAIHabits(
        topEmotions, 
        topThemes, 
        avgSentiment,
        priorityCategories
      );
      
      if (aiHabits.length > 0) {
        // Replace some of the shuffled habits with AI-generated ones
        const replaceCount = Math.min(aiHabits.length, Math.floor(count / 2));
        for (let i = 0; i < replaceCount; i++) {
          shuffled[i] = aiHabits[i];
        }
      }
    } catch (e) {
      console.error('Error generating AI habits:', e);
    }
  }
  
  return {
    habits: shuffled,
    topEmotions,
    topThemes,
    priorityCategories,
    sentimentSummary: getSentimentSummary(avgSentiment, negativeBiasPercentage)
  };
}

function getHabitsByCategory(category: string) {
  const habitsByCategory: Record<string, string[]> = {
    'emotional-regulation': [
      "Three deep breaths before responding when upset",
      "Name your emotions as they arise throughout the day",
      "Keep a small notebook to jot down intense feelings when they occur",
      "Set a 'worry time' - 10 minutes daily to process anxious thoughts",
      "Create a go-to playlist for different moods",
      "Practice the 5-4-3-2-1 sensory grounding technique when emotions feel overwhelming"
    ],
    'stress-management': [
      "Two-minute shoulder and neck stretch every hour",
      "Schedule brief 'worry breaks' instead of letting anxiety spread throughout your day",
      "60-second hand massage with lotion or oil",
      "Keep a small plant on your desk and take moments to tend to it",
      "Alternate nostril breathing for 2 minutes when switching tasks",
      "End your workday with a clear 'shutdown ritual'"
    ],
    'focus-productivity': [
      "Clear your workspace before starting your day",
      "Set a timer for 25 minutes of focused work followed by a 5-minute break",
      "Tackle your most important task first thing in the morning",
      "Drink a full glass of water before making decisions",
      "Write down three priorities each morning on a sticky note",
      "Put your phone in another room during focus sessions"
    ],
    'mindfulness': [
      "One minute of mindful observation of your surroundings",
      "Eat one meal a day without screens or reading material",
      "Notice the sensation of water during your shower or when washing hands",
      "Take three mindful breaths before checking your phone in the morning",
      "Choose one routine activity (like brushing teeth) to do with full attention daily",
      "Pause for a breath when you walk through doorways"
    ],
    'physical-health': [
      "Stretch for two minutes when you wake up",
      "Keep a water bottle visible and drink when you notice it",
      "Take a five-minute walking break for every hour of sitting",
      "Do 10 squats or wall push-ups while waiting for coffee/tea to brew",
      "Place healthy snacks at eye level in your refrigerator",
      "Go to bed 15 minutes earlier than usual"
    ],
    'social-connection': [
      "Send a voice message instead of a text to one person daily",
      "Share something you appreciate about someone when you think of it",
      "Eat lunch with a colleague instead of at your desk once a week",
      "Call a family member during a regular commute or chore",
      "Join an online community related to one of your interests",
      "Smile and make eye contact with service workers"
    ],
    'gratitude-positivity': [
      "Note three things you're grateful for before bed",
      "Take a photo of something beautiful or meaningful each day",
      "Leave a positive comment on someone's work",
      "Place post-it notes with encouraging messages where you'll see them",
      "Begin team meetings by sharing a recent win or success",
      "End your day by noting one thing that went well"
    ],
    'creativity': [
      "Doodle or sketch for five minutes during your lunch break",
      "Try a new route to a familiar destination",
      "Listen to a genre of music you don't normally choose",
      "Keep a small notebook to capture interesting ideas throughout the day",
      "Rearrange one small area of your living or working space",
      "Try cooking a familiar meal with one new ingredient or spice"
    ],
    'learning-growth': [
      "Learn one new word each morning",
      "Listen to a podcast on an unfamiliar topic during your commute",
      "Read one article outside your usual interests each week",
      "Teach someone something you recently learned",
      "Take five minutes to research a question that arose during your day",
      "Follow experts from different fields on social media"
    ]
  };
  
  return habitsByCategory[category] || [];
}

function getGeneralHabits(count: number) {
  const allCategories = [
    'emotional-regulation',
    'stress-management',
    'focus-productivity',
    'mindfulness',
    'physical-health',
    'social-connection',
    'gratitude-positivity',
    'creativity',
    'learning-growth'
  ];
  
  // Get habits from all categories
  const allHabits: string[] = [];
  allCategories.forEach(category => {
    allHabits.push(...getHabitsByCategory(category));
  });
  
  // Shuffle and limit
  return allHabits
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
}

function getSentimentSummary(avgSentiment: number, negativeBiasPercentage: number) {
  if (avgSentiment > 0.3) {
    return "Your journal entries reflect a generally positive emotional tone.";
  } else if (avgSentiment < -0.3) {
    return "Your recent entries show a pattern of negative emotions that could benefit from some small positive habits.";
  } else if (negativeBiasPercentage > 60) {
    return "While your overall sentiment is balanced, there's a tendency toward negative emotions in many entries.";
  } else {
    return "Your emotional patterns show a balanced mix of positive and challenging experiences.";
  }
}

async function generateAIHabits(
  topEmotions: string[], 
  topThemes: string[], 
  avgSentiment: number,
  priorityCategories: string[]
) {
  try {
    const emotionsStr = topEmotions.join(', ');
    const themesStr = topThemes.join(', ');
    const categoriesStr = priorityCategories.join(', ');
    
    let sentimentContext = "";
    if (avgSentiment > 0.3) {
      sentimentContext = "The person's journal entries are generally positive.";
    } else if (avgSentiment < -0.3) {
      sentimentContext = "The person's journal entries show patterns of negative emotions.";
    } else {
      sentimentContext = "The person's journal entries show a balanced emotional state.";
    }
    
    const prompt = `Create 3 specific, tiny habits (micro-habits) based on these dominant emotions: ${emotionsStr}; themes: ${themesStr}; and priority needs: ${categoriesStr}. ${sentimentContext}

The micro-habits should:
1. Be extremely small, easy actions that take less than 2 minutes
2. Be specific and actionable
3. Connect to a routine (after I wake up, before meals, etc.)
4. Address the emotional patterns and themes mentioned
5. Be written in a simple, direct format

Format each as a single sentence without bullets, numbers or paragraph breaks.`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a behavioral scientist specializing in tiny habits and emotional well-being.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });
    
    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      return [];
    }
    
    // Process the response to extract individual habits
    const content = data.choices[0].message.content;
    
    // Split by lines or sentences and clean each habit
    let habits = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 10 && !line.startsWith('Here') && !line.includes(':'))
      .map(line => {
        // Remove numbers, bullets, or other prefixes
        return line.replace(/^\d+\.|\*|-|\–|\—/g, '').trim();
      });
    
    // If we didn't get proper line breaks, try splitting by periods
    if (habits.length <= 1) {
      habits = content.split('.')
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 10)
        .map(sentence => sentence + '.');
    }
    
    return habits;
  } catch (error) {
    console.error('Error generating AI habits:', error);
    return [];
  }
}

/**
 * 8. Detect Silence Periods
 * Identify long gaps between journal entries
 */
async function detectSilencePeriods(userId: string, params: any = {}) {
  const { timeframe = '90days', gapThresholdDays = 3 } = params;
  
  // Parse timeframe to determine date range
  const now = new Date();
  let startDate = new Date();
  
  if (timeframe === '30days') {
    startDate.setDate(now.getDate() - 30);
  } else if (timeframe === '90days') {
    startDate.setDate(now.getDate() - 90);
  } else if (timeframe === '180days') {
    startDate.setDate(now.getDate() - 180);
  } else if (timeframe === '365days') {
    startDate.setDate(now.getDate() - 365);
  } else {
    startDate.setDate(now.getDate() - 90); // Default to 90 days for silence detection
  }
  
  // Get journal entries for the specified time period
  const { data: entries, error } = await supabase
    .from('Journal Entries')
    .select('id, created_at, sentiment, emotions')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error('Error fetching entries:', error);
    throw new Error('Failed to fetch journal entries');
  }

  if (!entries || entries.length < 2) {
    return {
      silencePeriods: [],
      message: "Not enough journal entries to detect silence patterns.",
      silenceInsights: null
    };
  }

  // Find gaps between entries
  const silencePeriods = [];
  let currentStreak = 0;
  let longestStreak = 0;
  
  for (let i = 1; i < entries.length; i++) {
    const currentDate = new Date(entries[i].created_at);
    const prevDate = new Date(entries[i-1].created_at);
    
    const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // If consecutive days, increment streak
    if (diffDays <= 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
      
      // If gap exceeds threshold, record a silence period
      if (diffDays >= gapThresholdDays) {
        // Get sentiment data for entries before and after gap
        const sentimentBefore = getSentimentData(entries[i-1]);
        const sentimentAfter = getSentimentData(entries[i]);
        
        // Calculate sentiment shift
        const emotionShift = compareEmotions(sentimentBefore, sentimentAfter);
        
        silencePeriods.push({
          startDate: prevDate.toISOString(),
          endDate: currentDate.toISOString(),
          lengthInDays: diffDays,
          sentimentBefore,
          sentimentAfter,
          emotionShift
        });
      }
    }
  }
  
  // Check for current silence period (if last entry is not recent)
  const lastEntryDate = new Date(entries[entries.length - 1].created_at);
  const diffFromNow = Math.ceil(Math.abs(now.getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffFromNow >= gapThresholdDays) {
    const sentimentBefore = getSentimentData(entries[entries.length - 1]);
    
    silencePeriods.push({
      startDate: lastEntryDate.toISOString(),
      endDate: now.toISOString(),
      lengthInDays: diffFromNow,
      sentimentBefore,
      sentimentAfter: null,
      emotionShift: null,
      isActive: true
    });
  }

  // Sort by gap length (longest first)
  silencePeriods.sort((a, b) => b.lengthInDays - a.lengthInDays);
  
  // Analyze patterns
  const insights = analyzeSilencePatterns(silencePeriods, longestStreak);
  
  return {
    silencePeriods,
    currentSilence: diffFromNow >= gapThresholdDays ? {
      startDate: lastEntryDate.toISOString(),
      lengthInDays: diffFromNow,
      isActive: true
    } : null,
    longestJournalingStreak: longestStreak,
    silenceInsights: insights
  };
}

function getSentimentData(entry: any) {
  let dominantEmotion = null;
  let dominantEmotionScore = 0;
  let sentiment = null;
  
  // Extract sentiment
  if (entry.sentiment) {
    const sentimentValue = parseFloat(entry.sentiment);
    if (!isNaN(sentimentValue)) {
      sentiment = sentimentValue;
    }
  }
  
  // Extract dominant emotion
  if (entry.emotions) {
    try {
      let emotions;
      if (typeof entry.emotions === 'string') {
        emotions = JSON.parse(entry.emotions);
      } else {
        emotions = entry.emotions;
      }
      
      if (Array.isArray(emotions.emotions)) {
        // Format: { emotions: [{name: "happy", intensity: 0.8}, ...] }
        const topEmotion = emotions.emotions.sort((a: any, b: any) => b.intensity - a.intensity)[0];
        if (topEmotion) {
          dominantEmotion = topEmotion.name;
          dominantEmotionScore = topEmotion.intensity;
        }
      } else {
        // Format: {happy: 0.8, sad: 0.2, ...}
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (typeof score === 'number' && score > dominantEmotionScore) {
            dominantEmotion = emotion;
            dominantEmotionScore = score;
          }
        });
      }
    } catch (e) {
      console.error('Error processing emotions:', e);
    }
  }
  
  return {
    sentiment,
    dominantEmotion,
    dominantEmotionScore
  };
}

function compareEmotions(before: any, after: any) {
  if (!before || !after || !before.sentiment || !after.sentiment) {
    return null;
  }
  
  const sentimentChange = after.sentiment - before.sentiment;
  let direction = 'neutral';
  
  if (sentimentChange > 0.3) {
    direction = 'significant-positive';
  } else if (sentimentChange > 0.1) {
    direction = 'slight-positive';
  } else if (sentimentChange < -0.3) {
    direction = 'significant-negative';
  } else if (sentimentChange < -0.1) {
    direction = 'slight-negative';
  }
  
  const emotionShift = before.dominantEmotion !== after.dominantEmotion;
  
  return {
    sentimentChange,
    direction,
    emotionShift,
    emotionBefore: before.dominantEmotion,
    emotionAfter: after.dominantEmotion
  };
}

function analyzeSilencePatterns(silencePeriods: any[], longestStreak: number) {
  if (silencePeriods.length === 0) {
    return {
      pattern: "consistent",
      message: "You've been consistently journaling without significant gaps."
    };
  }
  
  // Check if there's an active silence period
  const activeSilence = silencePeriods.find(p => p.isActive);
  
  // Calculate average gap length
  const totalGapDays = silencePeriods.reduce((sum, period) => sum + period.lengthInDays, 0);
  const averageGapLength = totalGapDays / silencePeriods.length;
  
  // Check for emotion patterns before silences
  const emotionsBeforeSilence: Record<string, number> = {};
  silencePeriods.forEach(period => {
    if (period.sentimentBefore && period.sentimentBefore.dominantEmotion) {
      const emotion = period.sentimentBefore.dominantEmotion;
      emotionsBeforeSilence[emotion] = (emotionsBeforeSilence[emotion] || 0) + 1;
    }
  });
  
  // Get the most common emotion before silence
  let commonEmotionBeforeSilence = null;
  let maxCount = 0;
  
  Object.entries(emotionsBeforeSilence).forEach(([emotion, count]) => {
    if (count > maxCount) {
      maxCount = count;
      commonEmotionBeforeSilence = emotion;
    }
  });
  
  // Check emotion shifts after silences
  const shiftPatterns: Record<string, number> = {
    'significant-positive': 0,
    'slight-positive': 0,
    'neutral': 0,
    'slight-negative': 0,
    'significant-negative': 0
  };
  
  let shiftCount = 0;
  silencePeriods.forEach(period => {
    if (period.emotionShift && period.emotionShift.direction) {
      shiftPatterns[period.emotionShift.direction]++;
      shiftCount++;
    }
  });
  
  // Get the most common shift pattern
  let dominantShiftPattern = 'neutral';
  let maxShiftCount = 0;
  
  Object.entries(shiftPatterns).forEach(([pattern, count]) => {
    if (count > maxShiftCount) {
      maxShiftCount = count;
      dominantShiftPattern = pattern;
    }
  });
  
  // Generate insights
  const insights = {
    gapFrequency: silencePeriods.length,
    averageGapLength: Math.round(averageGapLength),
    longestGap: silencePeriods.length > 0 ? silencePeriods[0].lengthInDays : 0,
    commonEmotionBeforeSilence,
    emotionPatternConfidence: maxCount > 0 ? (maxCount / silencePeriods.length) * 100 : 0,
    dominantShiftPattern,
    hasActiveSilence: !!activeSilence,
    activeSilenceLength: activeSilence ? activeSilence.lengthInDays : 0
  };
  
  // Determine overall pattern
  let pattern = "varied";
  if (silencePeriods.length <= 2 && longestStreak > 14) {
    pattern = "mostly-consistent";
  } else if (silencePeriods.length >= 5 && averageGapLength > 7) {
    pattern = "intermittent";
  } else if (activeSilence && activeSilence.lengthInDays > 14) {
    pattern = "currently-inactive";
  }
  
  // Generate message
  let message = "";
  
  if (pattern === "mostly-consistent") {
    message = `You've maintained a generally consistent journaling practice with only ${silencePeriods.length} significant gaps.`;
  } else if (pattern === "intermittent") {
    message = `Your journaling tends to be intermittent with an average gap of ${Math.round(averageGapLength)} days between entries.`;
  } else if (pattern === "currently-inactive") {
    message = `You're currently in an inactive period. Your last journal entry was ${activeSilence.lengthInDays} days ago.`;
  } else {
    message = `Your journaling pattern shows varied consistency with ${silencePeriods.length} gaps averaging ${Math.round(averageGapLength)} days each.`;
  }
  
  // Add emotion insight if confidence is high enough
  if (commonEmotionBeforeSilence && insights.emotionPatternConfidence > 40) {
    message += ` You often stop journaling after entries where you express ${commonEmotionBeforeSilence}.`;
  }
  
  // Add shift pattern insight if we have enough data
  if (shiftCount >= 3 && dominantShiftPattern !== 'neutral') {
    if (dominantShiftPattern.includes('positive')) {
      message += ` After breaks, you tend to return with a more positive emotional state.`;
    } else if (dominantShiftPattern.includes('negative')) {
      message += ` After breaks, you often return with a more negative emotional state.`;
    }
  }
  
  return {
    pattern,
    message,
    ...insights
  };
}

/**
 * 10. Recommend Shared Entries
 * Suggest entries the user might want to save or share
 */
async function recommendSharedEntries(userId: string, params: any = {}) {
  const { timeframe = '90days', count = 3 } = params;
  
  // Parse timeframe to determine date range
  const now = new Date();
  let startDate = new Date();
  
  if (timeframe === '30days') {
    startDate.setDate(now.getDate() - 30);
  } else if (timeframe === '90days') {
    startDate.setDate(now.getDate() - 90);
  } else if (timeframe === '180days') {
    startDate.setDate(now.getDate() - 180);
  } else if (timeframe === '365days') {
    startDate.setDate(now.getDate() - 365);
  } else {
    startDate.setDate(now.getDate() - 90); // Default to 90 days
  }
  
  // Get journal entries for the specified time period
  const { data: entries, error } = await supabase
    .from('Journal Entries')
    .select('id, created_at, master_themes, emotions, sentiment, refined text, transcription text, duration')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching entries:', error);
    throw new Error('Failed to fetch journal entries');
  }

  if (!entries || entries.length === 0) {
    return {
      recommendedEntries: [],
      message: "No journal entries found for the specified time period."
    };
  }

  // Process entries to score them for shareability
  const scoredEntries = entries.map(entry => {
    const content = entry.refined text || entry.transcription text || '';
    let shareScore = 0;
    
    // Content length score (longer entries often have more substance)
    if (content.length > 500) {
      shareScore += 10;
    } else if (content.length > 300) {
      shareScore += 5;
    } else if (content.length < 100) {
      shareScore -= 5; // Very short entries are less likely to be meaningful for sharing
    }
    
    // Audio duration score (if available)
    if (entry.duration) {
      const durationSeconds = parseFloat(entry.duration);
      if (durationSeconds > 120) {
        shareScore += 5; // Longer audio entries might have more depth
      }
    }
    
    // Sentiment score (highly positive or highly emotional entries often resonate)
    if (entry.sentiment) {
      const sentimentValue = parseFloat(entry.sentiment);
      if (!isNaN(sentimentValue)) {
        if (Math.abs(sentimentValue) > 0.7) {
          shareScore += 10; // Strong emotions (positive or negative)
        } else if (Math.abs(sentimentValue) > 0.5) {
          shareScore += 5;
        }
      }
    }
    
    // Themes score (entries with multiple themes often have broader insights)
    const themes = entry.master_themes || [];
    if (themes.length > 3) {
      shareScore += 8;
    } else if (themes.length > 1) {
      shareScore += 4;
    }
    
    // Emotion variety score
    if (entry.emotions) {
      try {
        let emotions;
        if (typeof entry.emotions === 'string') {
          emotions = JSON.parse(entry.emotions);
        } else {
          emotions = entry.emotions;
        }
        
        let emotionCount = 0;
        
        if (Array.isArray(emotions.emotions)) {
          // Format: { emotions: [{name: "happy", intensity: 0.8}, ...] }
          emotionCount = emotions.emotions.length;
        } else {
          // Format: {happy: 0.8, sad: 0.2, ...}
          emotionCount = Object.keys(emotions).filter(key => {
            return typeof emotions[key] === 'number' && key.length > 1;
          }).length;
        }
        
        if (emotionCount > 3) {
          shareScore += 8; // Entries with emotional complexity
        } else if (emotionCount > 1) {
          shareScore += 4;
        }
      } catch (e) {
        console.error('Error processing emotions:', e);
      }
    }
    
    // Content quality score (look for indicators of insight, reflection)
    const insightMarkers = [
      'realize', 'understand', 'learned', 'reflect', 
      'insight', 'perspective', 'growth', 'change',
      'milestone', 'progress', 'achievement', 'proud',
      'grateful', 'thankful', 'appreciate'
    ];
    
    const lowerContent = content.toLowerCase();
    let insightCount = 0;
    
    insightMarkers.forEach(marker => {
      if (lowerContent.includes(marker)) {
        insightCount++;
      }
    });
    
    shareScore += insightCount * 3;
    
    // Check for personal growth indicators
    if (lowerContent.includes('better than') || 
        lowerContent.includes('improve') || 
        lowerContent.includes('progress') ||
        lowerContent.includes('growth') ||
        lowerContent.includes('proud') ||
        lowerContent.includes('accomplishment')) {
      shareScore += 15;
    }
    
    // Create entry snippet
    const snippet = content.length > 150 
      ? content.substring(0, 150) + '...' 
      : content;
    
    return {
      id: entry.id,
      createdAt: entry.created_at,
      snippet,
      themes: themes,
      shareScore,
      sentiment: entry.sentiment
    };
  });

  // Sort by share score (highest first)
  scoredEntries.sort((a, b) => b.shareScore - a.shareScore);
  
  // Get the top entries based on count
  const recommendedEntries = scoredEntries.slice(0, count);
  
  // Generate recommendations with reasons
  const recommendations = recommendedEntries.map(entry => {
    // Format date
    const entryDate = new Date(entry.createdAt);
    const formattedDate = entryDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Determine share reason based on content
    let shareReason = "This entry contains meaningful reflections";
    
    if (entry.shareScore > 30) {
      shareReason = "This entry shows significant personal insight and growth";
    } else if (entry.sentiment && parseFloat(entry.sentiment) > 0.6) {
      shareReason = "This entry captures a particularly positive moment";
    } else if (entry.sentiment && parseFloat(entry.sentiment) < -0.6) {
      shareReason = "This entry reflects an important emotional challenge";
    } else if (entry.themes && entry.themes.length > 2) {
      shareReason = "This entry connects multiple important themes in your life";
    }
    
    return {
      id: entry.id,
      date: formattedDate,
      snippet: entry.snippet,
      themes: entry.themes,
      shareScore: entry.shareScore,
      shareReason
    };
  });
  
  return {
    recommendedEntries: recommendations,
    totalEntriesAnalyzed: entries.length
  };
}

