
/**
 * Validates if entries exist within a specific date range
 */
export async function validateEntriesInDateRange(
  supabase: any,
  userId: string,
  dateRange: any
): Promise<{
  hasEntries: boolean;
  entryCount: number;
  actualRange: { start: string; end: string } | null;
}> {
  if (!dateRange?.startDate || !dateRange?.endDate) {
    return {
      hasEntries: false,
      entryCount: 0,
      actualRange: null
    };
  }

  try {
    console.log(`[DateRangeValidator] Checking entries for user ${userId} between ${dateRange.startDate} and ${dateRange.endDate}`);

    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', dateRange.startDate)
      .lte('created_at', dateRange.endDate)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DateRangeValidator] Error querying entries:', error);
      return {
        hasEntries: false,
        entryCount: 0,
        actualRange: null
      };
    }

    const entryCount = entries ? entries.length : 0;
    const hasEntries = entryCount > 0;

    let actualRange = null;
    if (hasEntries && entries) {
      actualRange = {
        start: entries[entries.length - 1].created_at,
        end: entries[0].created_at
      };
    }

    console.log(`[DateRangeValidator] Found ${entryCount} entries in date range`);

    return {
      hasEntries,
      entryCount,
      actualRange
    };
  } catch (error) {
    console.error('[DateRangeValidator] Exception during validation:', error);
    return {
      hasEntries: false,
      entryCount: 0,
      actualRange: null
    };
  }
}

/**
 * Checks if a query is specifically asking about a time period
 */
export function isTemporalQuery(query: string): boolean {
  const temporalPatterns = [
    /\blast week\b/i,
    /\bthis week\b/i,
    /\byesterday\b/i,
    /\blast month\b/i,
    /\bthis month\b/i,
    /\blast year\b/i,
    /\brecently\b/i,
    /\blately\b/i,
    /\bin the past \d+ (days?|weeks?|months?)\b/i
  ];

  return temporalPatterns.some(pattern => pattern.test(query));
}

/**
 * Generates appropriate response when no entries exist in requested time range
 */
export function generateNoEntriesResponse(
  query: string,
  dateRange: any,
  timeRangeDescription: string
): string {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const startDate = formatDate(dateRange.startDate);
  const endDate = formatDate(dateRange.endDate);

  return `I don't have any journal entries from ${timeRangeDescription} (${startDate} to ${endDate}) to analyze. 

To help answer your question about "${query}", I would need journal entries from that specific time period. You might want to:

1. **Check if you meant a different time period** - Perhaps you were thinking of a different week or time range?

2. **Create some entries for that period** - If you have thoughts or experiences from ${timeRangeDescription} that you'd like to reflect on, feel free to add them to your journal.

3. **Ask about a time period when you do have entries** - I can help analyze patterns and insights from periods when you were actively journaling.

Would you like me to help you with entries from a different time period, or would you prefer to add some entries from ${timeRangeDescription} first?`;
}
