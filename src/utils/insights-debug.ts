
import { supabase } from '@/integrations/supabase/client';
import { TimeRange } from '@/hooks/use-insights-data';
import {
  startOfDay, startOfWeek, startOfMonth, startOfYear,
  addDays, addWeeks, addMonths, addYears
} from 'date-fns';

export interface EntityStripsDebugInfo {
  authStatus: {
    isAuthenticated: boolean;
    userId: string | null;
    userIdMatch: boolean;
  };
  dataAccess: {
    totalUserEntries: number;
    filteredEntries: number;
    entriesWithThemes: number;
    entriesWithValidThemes: number;
  };
  dateRange: {
    timeRange: TimeRange;
    currentDate: string;
    calculatedStart: string;
    calculatedEnd: string;
  };
  themeProcessing: {
    uniqueThemes: number;
    processedThemes: Array<{
      name: string;
      count: number;
      sentiment: number;
      entries: number;
    }>;
  };
  errors: string[];
}

/**
 * Comprehensive debug function for EntityStrips data issues
 */
export const debugEntityStripsData = async (
  userId: string | undefined,
  timeRange: TimeRange,
  currentDate: Date
): Promise<EntityStripsDebugInfo> => {
  console.log('[debugEntityStripsData] Starting comprehensive debug analysis...');
  
  const result: EntityStripsDebugInfo = {
    authStatus: {
      isAuthenticated: false,
      userId: null,
      userIdMatch: false
    },
    dataAccess: {
      totalUserEntries: 0,
      filteredEntries: 0,
      entriesWithThemes: 0,
      entriesWithValidThemes: 0
    },
    dateRange: {
      timeRange,
      currentDate: currentDate.toISOString(),
      calculatedStart: '',
      calculatedEnd: ''
    },
    themeProcessing: {
      uniqueThemes: 0,
      processedThemes: []
    },
    errors: []
  };

  try {
    // Step 1: Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      result.errors.push(`Authentication error: ${authError.message}`);
      return result;
    }

    result.authStatus.isAuthenticated = !!user;
    result.authStatus.userId = user?.id || null;
    result.authStatus.userIdMatch = user?.id === userId;

    if (!user || !userId || user.id !== userId) {
      result.errors.push(`Auth/UserId mismatch: auth(${user?.id}) vs provided(${userId})`);
      return result;
    }

    // Step 2: Calculate date range
    const { startDate, endDate } = calculateDateRange(timeRange, currentDate);
    result.dateRange.calculatedStart = startDate;
    result.dateRange.calculatedEnd = endDate;

    // Step 3: Check total user entries
    const { data: totalEntries, error: totalError } = await supabase
      .from('Journal Entries')
      .select('id, created_at, master_themes, sentiment')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (totalError) {
      result.errors.push(`Error fetching total entries: ${totalError.message}`);
      return result;
    }

    result.dataAccess.totalUserEntries = totalEntries?.length || 0;
    result.dataAccess.entriesWithThemes = totalEntries?.filter(e => 
      e.master_themes && e.master_themes.length > 0
    ).length || 0;
    result.dataAccess.entriesWithValidThemes = totalEntries?.filter(e => 
      e.master_themes && 
      Array.isArray(e.master_themes) && 
      e.master_themes.length > 0 &&
      e.master_themes.some(theme => typeof theme === 'string' && theme.trim())
    ).length || 0;

    // Step 4: Check filtered entries
    const { data: filteredEntries, error: filteredError } = await supabase
      .from('Journal Entries')
      .select('id, master_themes, sentiment, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('master_themes', 'is', null);

    if (filteredError) {
      result.errors.push(`Error fetching filtered entries: ${filteredError.message}`);
      return result;
    }

    result.dataAccess.filteredEntries = filteredEntries?.length || 0;

    // Step 5: Process themes
    if (filteredEntries) {
      const themeMap = new Map<string, { count: number, totalSentiment: number, entries: any[] }>();
      
      filteredEntries.forEach(entry => {
        if (!entry.master_themes || !Array.isArray(entry.master_themes)) return;
        
        let sentimentScore = 0;
        if (entry.sentiment) {
          if (typeof entry.sentiment === 'string') {
            switch (entry.sentiment.toLowerCase()) {
              case 'positive': sentimentScore = 0.7; break;
              case 'negative': sentimentScore = -0.7; break;
              case 'neutral': sentimentScore = 0; break;
              default: 
                const parsed = parseFloat(entry.sentiment);
                sentimentScore = isNaN(parsed) ? 0 : Math.max(-1, Math.min(1, parsed));
            }
          } else {
            sentimentScore = Math.max(-1, Math.min(1, Number(entry.sentiment) || 0));
          }
        }
        
        entry.master_themes.forEach(theme => {
          if (typeof theme === 'string' && theme.trim()) {
            const themeName = theme.toLowerCase().trim();
            
            if (!themeMap.has(themeName)) {
              themeMap.set(themeName, { count: 0, totalSentiment: 0, entries: [] });
            }
            
            const themeData = themeMap.get(themeName)!;
            themeData.count += 1;
            themeData.totalSentiment += sentimentScore;
            themeData.entries.push({
              id: entry.id,
              sentiment: sentimentScore,
              created_at: entry.created_at
            });
          }
        });
      });

      result.themeProcessing.uniqueThemes = themeMap.size;
      result.themeProcessing.processedThemes = Array.from(themeMap.entries())
        .map(([name, data]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          count: data.count,
          sentiment: data.totalSentiment / data.count,
          entries: data.entries.length
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 for debug
    }

    console.log('[debugEntityStripsData] Debug analysis complete:', result);
    return result;

  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`);
    console.error('[debugEntityStripsData] Unexpected error:', error);
    return result;
  }
};

/**
 * Helper function to calculate date range consistently
 */
function calculateDateRange(timeRange: TimeRange, currentDate: Date): { startDate: string; endDate: string } {
  const baseDate = currentDate;
  let startDate: Date;
  let endDate: Date;
  
  switch (timeRange) {
    case 'today':
      startDate = startOfDay(baseDate);
      endDate = addDays(startDate, 1);
      break;
    case 'week':
      startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
      endDate = addWeeks(startDate, 1);
      break;
    case 'month':
      startDate = startOfMonth(baseDate);
      endDate = addMonths(startDate, 1);
      break;
    case 'year':
      startDate = startOfYear(baseDate);
      endDate = addYears(startDate, 1);
      break;
    default:
      startDate = startOfDay(baseDate);
      endDate = addDays(startDate, 1);
  }
  
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

/**
 * Quick diagnostic function to check if a user has any valid theme data
 */
export const quickThemeDataCheck = async (userId: string): Promise<{
  hasAnyEntries: boolean;
  hasEntriesWithThemes: boolean;
  themeCount: number;
  recentThemes: string[];
}> => {
  try {
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('id, master_themes, created_at')
      .eq('user_id', userId)
      .not('master_themes', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[quickThemeDataCheck] Error:', error);
      return {
        hasAnyEntries: false,
        hasEntriesWithThemes: false,
        themeCount: 0,
        recentThemes: []
      };
    }

    const recentThemes = new Set<string>();
    entries?.forEach(entry => {
      if (entry.master_themes && Array.isArray(entry.master_themes)) {
        entry.master_themes.forEach(theme => {
          if (typeof theme === 'string' && theme.trim()) {
            recentThemes.add(theme);
          }
        });
      }
    });

    return {
      hasAnyEntries: !!entries && entries.length > 0,
      hasEntriesWithThemes: !!entries && entries.length > 0,
      themeCount: recentThemes.size,
      recentThemes: Array.from(recentThemes).slice(0, 5)
    };

  } catch (error) {
    console.error('[quickThemeDataCheck] Exception:', error);
    return {
      hasAnyEntries: false,
      hasEntriesWithThemes: false,
      themeCount: 0,
      recentThemes: []
    };
  }
};
