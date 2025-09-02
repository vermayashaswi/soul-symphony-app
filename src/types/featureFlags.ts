
export type AppFeatureFlag =
  | "premiumMessaging"
  | "emotionCalendar"
  | "insightsV2"
  | "journalVoicePlayback"
  | "otherReservedFlags";

/**
 * Extend this type by listing new flags above.
 * All flags should be documented for maintainability.
 */
export type FeatureFlags = {
  [key in AppFeatureFlag]: boolean;
};
