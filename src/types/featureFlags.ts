
export type AppFeatureFlag =
  | "smartChatV2"
  | "premiumMessaging"
  | "emotionCalendar"
  | "insightsV2"
  | "journalVoicePlayback"
  | "smartChatSwitch"
  | "otherReservedFlags";

/**
 * Extend this type by listing new flags above.
 * All flags should be documented for maintainability.
 */
export type FeatureFlags = {
  [key in AppFeatureFlag]: boolean;
};
