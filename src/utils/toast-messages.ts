/**
 * Professional toast messages for production app
 * All messages are user-friendly, encouraging, and professional
 */

import { toast } from '@/hooks/use-toast';

// Toast message templates
export const TOAST_MESSAGES = {
  // Authentication & Profile
  AUTH: {
    SIGN_IN_SUCCESS: {
      title: "Welcome back! 🌟",
      description: "You're all set to continue your mindfulness journey."
    },
    SIGN_OUT_SUCCESS: {
      title: "See you soon! 👋",
      description: "Your progress has been saved securely."
    },
    PROFILE_UPDATED: {
      title: "Profile updated! ✨",
      description: "Your changes have been saved successfully."
    },
    SESSION_EXPIRED: {
      title: "Session expired",
      description: "Please sign in again to continue your journey."
    }
  },

  // Journal Entries
  JOURNAL: {
    ENTRY_SAVED: {
      title: "Entry saved! 📝",
      description: "Your thoughts have been captured and stored safely."
    },
    ENTRY_UPDATED: {
      title: "Changes saved! ✨",
      description: "Your entry has been updated successfully."
    },
    ENTRY_DELETED: {
      title: "Entry removed 🗑️",
      description: "Your entry has been permanently deleted."
    },
    PROCESSING_STARTED: {
      title: "Analyzing your entry... ⏳",
      description: "Our AI is analyzing your thoughts and emotions."
    },
    PROCESSING_COMPLETE: {
      title: "Analysis complete! 🎯",
      description: "Your insights are ready to explore."
    },
    BACKUP_RESTORED: {
      title: "Entry restored! 🔄",
      description: "Your previous version has been recovered."
    }
  },

  // Voice & Recording
  VOICE: {
    RECORDING_STARTED: {
      title: "Recording started 🎙️",
      description: "Share your thoughts freely - I'm listening."
    },
    RECORDING_STOPPED: {
      title: "Recording complete ✅",
      description: "Converting your voice to text..."
    },
    TRANSCRIPTION_READY: {
      title: "Transcription ready! 📄",
      description: "Your spoken words have been captured perfectly."
    },
    PERMISSION_NEEDED: {
      title: "Microphone access needed",
      description: "Please allow microphone access to record your voice."
    }
  },

  // Network & Sync
  NETWORK: {
    BACK_ONLINE: {
      title: "Back online! 🌐",
      description: "Syncing your latest changes now."
    },
    OFFLINE_MODE: {
      title: "Working offline 📱",
      description: "Your entries will sync when connection returns."
    },
    SYNC_COMPLETE: {
      title: "All synced! ☁️",
      description: "Your data is up to date across all devices."
    }
  },

  // Errors (user-friendly)
  ERROR: {
    GENERAL: {
      title: "Something went wrong",
      description: "Please try again in a moment. We're here to help if issues persist."
    },
    NETWORK: {
      title: "Connection issue",
      description: "Please check your internet connection and try again."
    },
    SAVE_FAILED: {
      title: "Save unsuccessful",
      description: "Your entry couldn't be saved. Please try again."
    },
    LOAD_FAILED: {
      title: "Loading issue",
      description: "We couldn't load your content. Please refresh and try again."
    },
    EDGE_FUNCTION_RETRY: {
      title: "Oops! Something is wrong. Wait, let me re-try to get back online",
      description: "Automatically retrying your request..."
    }
  },

  // Success confirmations
  SUCCESS: {
    CHANGES_SAVED: {
      title: "All set! ✅",
      description: "Your changes have been saved successfully."
    },
    SETTINGS_UPDATED: {
      title: "Preferences updated! ⚙️",
      description: "Your new settings are now active."
    },
    BACKUP_CREATED: {
      title: "Backup created! 💾",
      description: "Your data has been safely backed up."
    }
  }
} as const;

// Utility functions for consistent toast usage
export function showSuccessToast(title: string, description: string, duration?: number) {
  return toast({
    title,
    description,
    duration: duration || 3000,
    variant: 'default'
  });
}

export function showErrorToast(title: string, description: string, duration?: number) {
  return toast({
    title,
    description,
    duration: duration || 5000,
    variant: 'destructive'
  });
}

export function showInfoToast(title: string, description: string, duration?: number) {
  return toast({
    title,
    description,
    duration: duration || 3000,
    variant: 'default'
  });
}

export function showQuickToast(title: string, description: string) {
  return toast({
    title,
    description,
    duration: 1500,
    variant: 'default'
  });
}

// Pre-built toast functions for common actions
export const showJournalSaved = () => showSuccessToast(
  TOAST_MESSAGES.JOURNAL.ENTRY_SAVED.title,
  TOAST_MESSAGES.JOURNAL.ENTRY_SAVED.description
);

export const showJournalUpdated = () => showSuccessToast(
  TOAST_MESSAGES.JOURNAL.ENTRY_UPDATED.title,
  TOAST_MESSAGES.JOURNAL.ENTRY_UPDATED.description
);

export const showProcessingStarted = () => showInfoToast(
  TOAST_MESSAGES.JOURNAL.PROCESSING_STARTED.title,
  TOAST_MESSAGES.JOURNAL.PROCESSING_STARTED.description
);

export const showProcessingComplete = () => showSuccessToast(
  TOAST_MESSAGES.JOURNAL.PROCESSING_COMPLETE.title,
  TOAST_MESSAGES.JOURNAL.PROCESSING_COMPLETE.description
);

export const showGeneralError = () => showErrorToast(
  TOAST_MESSAGES.ERROR.GENERAL.title,
  TOAST_MESSAGES.ERROR.GENERAL.description
);

export const showNetworkError = () => showErrorToast(
  TOAST_MESSAGES.ERROR.NETWORK.title,
  TOAST_MESSAGES.ERROR.NETWORK.description
);

export const showSaveError = () => showErrorToast(
  TOAST_MESSAGES.ERROR.SAVE_FAILED.title,
  TOAST_MESSAGES.ERROR.SAVE_FAILED.description
);

export const showEdgeFunctionRetryToast = () => showInfoToast(
  TOAST_MESSAGES.ERROR.EDGE_FUNCTION_RETRY.title,
  TOAST_MESSAGES.ERROR.EDGE_FUNCTION_RETRY.description,
  4000
);