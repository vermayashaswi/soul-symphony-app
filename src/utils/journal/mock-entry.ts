
import { JournalEntry } from '@/types/journal';

export const MOCK_ENTRY_ID = -1; // Negative ID to avoid conflicts with real entries

export const createMockEntry = (): JournalEntry => ({
  id: MOCK_ENTRY_ID,
  created_at: new Date().toISOString(),
  content: "Welcome to SOuLO. This is a sample of how your entry will look like. Get started on your voice-journaling journey now!!",
  "transcription text": "Welcome to SOuLO. This is a sample of how your entry will look like. Get started on your voice-journaling journey now!!",
  "refined text": "Welcome to SOuLO. This is a sample of how your entry will look like. Get started on your voice-journaling journey now!!",
  themes: ["SOuLO", "Start", "VoiceJournaling", "WishingYouLove", "SelfAwareness"],
  sentiment: "positive",
  emotions: {
    joy: 0.8,
    excitement: 0.7,
    hope: 0.9
  },
  entities: [
    { type: "PRODUCT", name: "SOuLO", text: "SOuLO" },
    { type: "ACTIVITY", name: "VoiceJournaling", text: "voice-journaling" }
  ],
  duration: 15,
  user_id: undefined, // No user associated with mock entry
  audio_url: undefined,
  "foreign key": undefined,
  master_themes: ["SOuLO", "Start", "VoiceJournaling", "WishingYouLove", "SelfAwareness"],
  user_feedback: null,
  Edit_Status: null,
  original_language: "en",
  translation_text: undefined
});

export const isMockEntry = (entry: JournalEntry): boolean => {
  return entry.id === MOCK_ENTRY_ID;
};

export const shouldShowMockEntry = (entries: JournalEntry[]): boolean => {
  // Show mock entry only if there are no real entries
  const realEntries = entries.filter(entry => !isMockEntry(entry));
  return realEntries.length === 0;
};

export const filterOutMockEntries = (entries: JournalEntry[]): JournalEntry[] => {
  return entries.filter(entry => !isMockEntry(entry));
};
