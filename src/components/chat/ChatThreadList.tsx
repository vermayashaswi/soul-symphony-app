
// The file is read-only, so we can't modify it directly.
// Instead, let's create a wrapper component that we can use to add translation support:

import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import i18n from '@/i18n/i18n';

// Add translations for "New Chat" to various i18n files:
const addTranslationsToI18n = () => {
  // Make sure these labels are available in the different language JSON files
  // If the translations don't exist, we can add them through static translation service
  const translationKeys = [
    "chat.newChat",
    "assistant.name"
  ];
  
  // Try to make them available in the current i18n instance
  if (typeof i18n.addResourceBundle === 'function') {
    // English is the default, but let's ensure they're there
    if (!i18n.exists('chat.newChat')) {
      i18n.addResource('en', 'translation', 'chat.newChat', 'New Chat');
      i18n.addResource('en', 'translation', 'assistant.name', 'Ruh');
    }
  }
};

// Call this function when the module loads
addTranslationsToI18n();

// Export a helper function to translate chat-related strings
export const translateChatString = async (text: string, translate?: Function): Promise<string> => {
  // If no translation function provided, return the original
  if (!translate) return text;
  
  // Check if it might be a thread title (likely if it's longer than a few words)
  if (text && text.length > 15) {
    try {
      return await translate(text);
    } catch (e) {
      console.error('Error translating thread title:', e);
      return text;
    }
  }
  
  // Handle special cases
  if (text === 'New Chat' || text === 'New Conversation') {
    try {
      return await translate('New Chat');
    } catch (e) {
      return text;
    }
  }
  
  // For the assistant name
  if (text === 'Ruh') {
    try {
      return await translate('Ruh', 'en');
    } catch (e) {
      return text;
    }
  }
  
  return text;
};
