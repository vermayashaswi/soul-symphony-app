
// Color palette for emotions
export const EMOTION_COLORS = [
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

export const getEmotionColor = (emotion: string, index: number): string => {
  // Use a hash of the emotion name for consistent colors
  const emotionHash = emotion.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const colorIndex = Math.abs(emotionHash) % EMOTION_COLORS.length;
  return EMOTION_COLORS[colorIndex];
};
