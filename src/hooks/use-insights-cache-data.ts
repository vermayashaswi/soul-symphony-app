
// Provides a 6-month cache of entries with UI API compatible with useInsightsData

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { TimeRange } from "./use-insights-data";

export type EmotionDataPoint = {
  date: string;
  value: number;
  emotion: string;
};
export type AggregatedEmotionData = {
  [emotion: string]: EmotionDataPoint[];
};
export type DominantMood = {
  emotion: string;
  emoji: string;
  score: number;
};
export type BiggestImprovement = {
  emotion: string;
  percentage: number;
};
export type JournalActivity = {
  entryCount: number;
  streak: number;
  maxStreak: number;
};
interface InsightsData {
  entries: any[];
  allEntries: any[];
  dominantMood: DominantMood | null;
  biggestImprovement: BiggestImprovement | null;
  journalActivity: JournalActivity;
  aggregatedEmotionData: AggregatedEmotionData;
}
export interface UseInsightsCacheDataResult {
  insightsData: InsightsData;
  loading: boolean;
  invalidateCache: () => void;
}

type CacheRecord = {
  fetchedFrom: Date;
  entries: any[];
  lastUserId?: string;
};

const CACHE_KEY = "soulo-insights-cache-v1";

function getCache(): CacheRecord | null {
  if (typeof window === "undefined") return null;
  const item = window.localStorage.getItem(CACHE_KEY);
  if (!item) return null;
  try {
    const parsed = JSON.parse(item);
    if (parsed && parsed.fetchedFrom) {
      parsed.fetchedFrom = new Date(parsed.fetchedFrom);
    }
    return parsed;
  } catch {
    return null;
  }
}
function setCache(data: CacheRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}
function clearCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CACHE_KEY);
}

function getDateRange(timeRange: TimeRange, baseDate: Date = new Date()) {
  let startDate, endDate;
  switch (timeRange) {
    case "today":
      startDate = startOfDay(baseDate);
      endDate = endOfDay(baseDate);
      break;
    case "week":
      startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
      endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
      break;
    case "month":
      startDate = startOfMonth(baseDate);
      endDate = endOfMonth(baseDate);
      break;
    case "year":
      startDate = startOfYear(baseDate);
      endDate = endOfYear(baseDate);
      break;
    default:
      startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
      endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
  }
  return { startDate, endDate };
}

function clampToLatestSixMonths(date: Date): Date {
  const sixMonthsAgo = subMonths(new Date(), 6);
  if (date < sixMonthsAgo) return sixMonthsAgo;
  return date;
}

export function useInsightsCacheData(
  userId: string | undefined,
  timeRange: TimeRange,
  currentDate?: Date
): UseInsightsCacheDataResult {
  const [insightsData, setInsightsData] = useState<InsightsData>({
    entries: [],
    allEntries: [],
    dominantMood: null,
    biggestImprovement: null,
    journalActivity: { entryCount: 0, streak: 0, maxStreak: 0 },
    aggregatedEmotionData: {},
  });
  const [loading, setLoading] = useState(true);
  const [cacheInvalidationFlag, setCacheInvalidationFlag] = useState(0);

  const fetchAndCacheEntries = useCallback(
    async (userIdToFetch: string) => {
      setLoading(true);
      const sixMonthsBack = clampToLatestSixMonths(new Date());
      // Fetch all entries for the last 6 months
      const { data: entries, error } = await supabase
        .from("Journal Entries")
        .select("*")
        .eq("user_id", userIdToFetch)
        .gte("created_at", sixMonthsBack.toISOString())
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Insights cache fetch error:", error);
        setInsightsData((d) => ({ ...d, entries: [], allEntries: [] }));
        setLoading(false);
        return;
      }
      const cacheData: CacheRecord = {
        fetchedFrom: new Date(),
        entries,
        lastUserId: userIdToFetch,
      };
      setCache(cacheData);
      setLoading(false);
      return entries;
    },
    []
  );

  // Invalidate manually
  const invalidateCache = () => {
    clearCache();
    setCacheInvalidationFlag((c) => c + 1);
  };

  // On mount or userId change, load cache or fetch fresh if missing/invalid
  useEffect(() => {
    if (!userId) {
      setInsightsData((d) => ({ ...d, entries: [], allEntries: [] }));
      setLoading(false);
      return;
    }
    setLoading(true);

    // 1. Check cache
    let cache = getCache();

    let shouldFetchFresh = false;
    if (
      !cache ||
      !cache.entries ||
      !cache.fetchedFrom ||
      !cache.lastUserId ||
      cache.lastUserId !== userId
    ) {
      shouldFetchFresh = true;
    } else {
      // If cache is older than 3 hours, refresh in bg
      const now = new Date();
      if (now.getTime() - cache.fetchedFrom.getTime() > 3 * 60 * 60 * 1000) {
        shouldFetchFresh = true;
      }
    }

    // Return cache immediately for fast UI, then refresh async if needed
    if (cache && cache.entries && cache.lastUserId === userId) {
      processAndSetInsightsData(cache.entries, timeRange, currentDate);
      setLoading(false);
      // If should fetch, do it in bg
      if (shouldFetchFresh) {
        fetchAndCacheEntries(userId).then((freshEntries) => {
          if (freshEntries && freshEntries.length) {
            processAndSetInsightsData(freshEntries, timeRange, currentDate);
          }
        });
      }
    } else {
      // No cache: fetch fresh and set
      fetchAndCacheEntries(userId).then((freshEntries) => {
        if (freshEntries && freshEntries.length) {
          processAndSetInsightsData(freshEntries, timeRange, currentDate);
        } else {
          setInsightsData((d) => ({ ...d, entries: [], allEntries: [] }));
        }
        setLoading(false);
      });
    }
    // eslint-disable-next-line
  }, [userId, cacheInvalidationFlag]);

  // When timeRange or currentDate changes, re-filter and re-process
  useEffect(() => {
    if (!userId) return;
    const cache = getCache();
    if (cache && cache.entries && cache.lastUserId === userId) {
      processAndSetInsightsData(cache.entries, timeRange, currentDate);
    }
  }, [userId, timeRange, currentDate, cacheInvalidationFlag]);

  // Provide almost the same InsightsData UI API as useInsightsData
  function processAndSetInsightsData(
    allEntries: any[],
    timeRange: TimeRange,
    currentDate?: Date
  ) {
    const effectiveBaseDate = currentDate || new Date();
    const { startDate, endDate } = getDateRange(timeRange, effectiveBaseDate);

    const entriesInPeriod =
      allEntries?.filter((entry) => {
        if (!entry.created_at) return false;
        const entryDate = new Date(entry.created_at);
        return entryDate >= startDate && entryDate <= endDate;
      }) || [];

    // Patch: Parse emotions if stored as string
    const processedEntries = entriesInPeriod.map((entry) => {
      if (entry.emotions && typeof entry.emotions === "string") {
        try {
          entry.emotions = JSON.parse(entry.emotions);
        } catch (e) {
          // Ignore failed parses
        }
      }
      return entry;
    });
    const processedAllEntries = allEntries.map((entry) => {
      if (entry.emotions && typeof entry.emotions === "string") {
        try {
          entry.emotions = JSON.parse(entry.emotions);
        } catch (e) {}
      }
      return entry;
    });

    const dominantMood = calculateDominantMood(processedEntries);
    const biggestImprovement = calculateBiggestImprovement(allEntries, processedEntries, timeRange);
    const journalActivity = calculateJournalActivity(processedEntries, timeRange);
    const aggregatedEmotionData = processEmotionData(processedEntries, timeRange);

    setInsightsData({
      entries: processedEntries,
      allEntries: processedAllEntries,
      dominantMood,
      biggestImprovement,
      journalActivity,
      aggregatedEmotionData,
    });
  }

  // --- Analysis helpers (copy-pasted from use-insights-data for compatibility) ---
  // You may want to refactor these out in the future

  function calculateDominantMood(entries: any[]): DominantMood | null {
    if (!entries || entries.length === 0) return null;
    const emotionCounts: Record<string, { count: number; score: number }> = {};
    entries.forEach((entry) => {
      if (entry.emotions) {
        try {
          let processedEmotions: Record<string, number> = {};
          if (typeof entry.emotions === "string") {
            const parsed = JSON.parse(entry.emotions);
            if (Array.isArray(parsed.emotions)) {
              parsed.emotions
                .sort((a: any, b: any) => b.intensity - a.intensity)
                .slice(0, 5)
                .forEach((emotion: any) => {
                  if (emotion && emotion.name && emotion.intensity) {
                    processedEmotions[emotion.name.toLowerCase()] = emotion.intensity;
                  }
                });
            } else {
              processedEmotions = parsed;
            }
          } else if (entry.emotions && typeof entry.emotions === "object") {
            if (Array.isArray(entry.emotions.emotions)) {
              entry.emotions.emotions
                .sort((a: any, b: any) => b.intensity - a.intensity)
                .slice(0, 5)
                .forEach((emotion: any) => {
                  if (emotion && emotion.name && emotion.intensity) {
                    processedEmotions[emotion.name.toLowerCase()] = emotion.intensity;
                  }
                });
            } else {
              processedEmotions = entry.emotions;
            }
          }
          Object.entries(processedEmotions).forEach(([emotion, score]) => {
            const emotionKey = emotion.toLowerCase();
            if (!emotionCounts[emotionKey]) {
              emotionCounts[emotionKey] = { count: 0, score: 0 };
            }
            emotionCounts[emotionKey].count += 1;
            emotionCounts[emotionKey].score += Number(score);
          });
        } catch (e) {}
      }
    });
    let dominantEmotion = "";
    let highestScore = 0;
    Object.entries(emotionCounts).forEach(([emotion, data]) => {
      if (data.score > highestScore) {
        dominantEmotion = emotion;
        highestScore = data.score;
      }
    });
    if (!dominantEmotion) return null;
    dominantEmotion = dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1);
    const emotionEmojis: Record<string, string> = {
      happy: "😊",
      sad: "😢",
      angry: "😠",
      fearful: "😨",
      disgusted: "🤢",
      surprised: "😲",
      joy: "😄",
      love: "❤️",
      content: "😌",
      peaceful: "😇",
      anxious: "😰",
      stressed: "😖",
      tired: "😴",
      excited: "🤩",
      hopeful: "🙏",
      grateful: "🙌",
      satisfaction: "😌",
    };
    return {
      emotion: dominantEmotion,
      emoji: emotionEmojis[dominantEmotion.toLowerCase()] || "🤔",
      score: highestScore,
    };
  }

  function calculateBiggestImprovement(
    allEntries: any[],
    timeRangeEntries: any[],
    timeRange: TimeRange
  ): BiggestImprovement | null {
    if (!allEntries || allEntries.length === 0 || !timeRangeEntries || timeRangeEntries.length === 0) {
      return null;
    }
    const currentEntries = [...timeRangeEntries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const earliestTimeRangeDate = new Date(
      Math.min(...timeRangeEntries.map((entry) => new Date(entry.created_at).getTime()))
    );
    const previousEntries = allEntries.filter(
      (entry) => new Date(entry.created_at) < earliestTimeRangeDate
    );
    if (previousEntries.length === 0) {
      if (currentEntries.length < 4) {
        return {
          emotion: currentEntries.length > 0 ? "Peaceful" : "Content",
          percentage: 24,
        };
      }
      const midpoint = Math.floor(currentEntries.length / 2);
      const firstHalf = currentEntries.slice(0, midpoint);
      const secondHalf = currentEntries.slice(midpoint);
      return calculateEmotionChanges(firstHalf, secondHalf);
    }
    return calculateEmotionChanges(previousEntries, currentEntries);
  }

  function calculateEmotionChanges(previousEntries: any[], currentEntries: any[]): BiggestImprovement {
    const previousEmotions: Record<string, { total: number; count: number }> = {};
    const currentEmotions: Record<string, { total: number; count: number }> = {};
    for (const entry of previousEntries) {
      if (entry.emotions) {
        try {
          const emotions = typeof entry.emotions === "string" ? JSON.parse(entry.emotions) : entry.emotions;
          processEmotionsForEntry(emotions, previousEmotions);
        } catch (e) {}
      }
    }
    for (const entry of currentEntries) {
      if (entry.emotions) {
        try {
          const emotions = typeof entry.emotions === "string" ? JSON.parse(entry.emotions) : entry.emotions;
          processEmotionsForEntry(emotions, currentEmotions);
        } catch (e) {}
      }
    }
    const emotionChanges: Array<{ emotion: string; percentage: number }> = [];
    Object.keys({ ...previousEmotions, ...currentEmotions }).forEach((emotion) => {
      const prevAvg = previousEmotions[emotion]
        ? previousEmotions[emotion].total / previousEmotions[emotion].count
        : 0;
      const currAvg = currentEmotions[emotion]
        ? currentEmotions[emotion].total / currentEmotions[emotion].count
        : 0;
      if (prevAvg === 0 && currAvg === 0) return;
      let percentageChange = 0;
      if (prevAvg === 0 && currAvg > 0) {
        percentageChange = 100;
      } else if (prevAvg > 0) {
        percentageChange = ((currAvg - prevAvg) / prevAvg) * 100;
      }
      const displayEmotion = emotion.charAt(0).toUpperCase() + emotion.slice(1);
      emotionChanges.push({
        emotion: displayEmotion,
        percentage: Math.round(percentageChange),
      });
    });
    emotionChanges.sort((a, b) => Math.abs(b.percentage) - Math.abs(a.percentage));
    if (emotionChanges.length > 0) {
      return emotionChanges[0];
    }
    return {
      emotion: currentEntries.length > 0 ? "Peaceful" : "Content",
      percentage: 24,
    };
  }

  function processEmotionsForEntry(emotions: any, emotionMap: Record<string, { total: number; count: number }>) {
    if (!emotions || typeof emotions !== "object") return;
    if (Array.isArray(emotions.emotions)) {
      emotions.emotions.forEach((emotion: any) => {
        if (emotion && emotion.name && emotion.intensity) {
          const emotionKey = emotion.name.toLowerCase();
          if (!emotionMap[emotionKey]) {
            emotionMap[emotionKey] = { total: 0, count: 0 };
          }
          emotionMap[emotionKey].total += emotion.intensity;
          emotionMap[emotionKey].count += 1;
        }
      });
      return;
    }
    Object.entries(emotions).forEach(([emotion, score]) => {
      if (
        emotion.toLowerCase() === "id" ||
        emotion.toLowerCase() === "intensity" ||
        emotion.toLowerCase() === "name" ||
        /^\d+$/.test(emotion) ||
        emotion.length < 2
      ) {
        return;
      }
      const emotionValue = Number(score);
      if (!isNaN(emotionValue)) {
        const emotionKey = emotion.toLowerCase();
        if (!emotionMap[emotionKey]) {
          emotionMap[emotionKey] = { total: 0, count: 0 };
        }
        emotionMap[emotionKey].total += emotionValue;
        emotionMap[emotionKey].count += 1;
      }
    });
  }

  function calculateJournalActivity(entries: any[], timeRange: TimeRange): JournalActivity {
    const entryCount = entries.length;
    if (timeRange === "today") {
      return { entryCount, streak: entryCount, maxStreak: entryCount };
    }
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const dateMap = new Map<string, number>();
    sortedEntries.forEach((entry) => {
      const dateKey = entry.created_at?.split("T")[0] || "";
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    });
    const sortedDates = Array.from(dateMap.keys()).sort();
    if (sortedDates.length === 0) return { entryCount: 0, streak: 0, maxStreak: 0 };
    let currentStreak = 1;
    let maxStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i]);
      const prevDate = new Date(sortedDates[i - 1]);
      const timeDiff = currentDate.getTime() - prevDate.getTime();
      const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
      if (daysDiff === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (daysDiff > 1) {
        currentStreak = 1;
      }
    }
    return {
      entryCount,
      streak: Math.min(currentStreak, 7),
      maxStreak,
    };
  }

  function processEmotionData(entries: any[], timeRange: TimeRange): AggregatedEmotionData {
    const emotionData: AggregatedEmotionData = {};
    const emotionCounts = new Map<string, Map<string, number>>();
    entries.forEach((entry) => {
      const dateStr = entry.created_at?.split("T")[0] || "";
      if (entry.emotions) {
        try {
          let processedEmotions: Record<string, number> = {};
          if (typeof entry.emotions === "string") {
            const parsed = JSON.parse(entry.emotions);
            if (Array.isArray(parsed.emotions)) {
              parsed.emotions
                .sort((a: any, b: any) => b.intensity - a.intensity)
                .slice(0, 5)
                .forEach((emotion: any) => {
                  if (emotion && emotion.name && emotion.intensity) {
                    processedEmotions[emotion.name.toLowerCase()] = emotion.intensity;
                  }
                });
            } else {
              processedEmotions = parsed;
            }
          } else if (entry.emotions && typeof entry.emotions === "object") {
            if (Array.isArray(entry.emotions.emotions)) {
              entry.emotions.emotions
                .sort((a: any, b: any) => b.intensity - a.intensity)
                .slice(0, 5)
                .forEach((emotion: any) => {
                  if (emotion && emotion.name && emotion.intensity) {
                    processedEmotions[emotion.name.toLowerCase()] = emotion.intensity;
                  }
                });
            } else {
              processedEmotions = entry.emotions;
            }
          }
          Object.entries(processedEmotions).forEach(([emotion, score]) => {
            const emotionKey = emotion.charAt(0).toUpperCase() + emotion.slice(1);
            if (!emotionData[emotionKey]) {
              emotionData[emotionKey] = [];
            }
            if (!emotionCounts.has(dateStr)) {
              emotionCounts.set(dateStr, new Map());
            }
            const dateEmotionCounts = emotionCounts.get(dateStr)!;
            if (!dateEmotionCounts.has(emotionKey)) {
              dateEmotionCounts.set(emotionKey, 0);
            }
            dateEmotionCounts.set(emotionKey, dateEmotionCounts.get(emotionKey)! + 1);
            const existingPoint = emotionData[emotionKey].find((point) => point.date === dateStr);
            if (existingPoint) {
              existingPoint.value += Number(score);
            } else {
              emotionData[emotionKey].push({
                date: dateStr,
                value: Number(score),
                emotion: emotionKey,
              });
            }
          });
        } catch (e) {}
      }
    });
    Object.entries(emotionData).forEach(([emotion, dataPoints]) => {
      dataPoints.forEach((point) => {
        const dateEmotionCounts = emotionCounts.get(point.date);
        if (dateEmotionCounts && dateEmotionCounts.has(emotion)) {
          const count = dateEmotionCounts.get(emotion)!;
          if (count > 1) {
            point.value = point.value / count;
            if (point.value > 1.0) point.value = 1.0;
          }
        }
      });
    });
    return emotionData;
  }

  return {
    insightsData,
    loading,
    invalidateCache,
  };
}

export default useInsightsCacheData;
