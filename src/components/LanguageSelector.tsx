
import React from 'react';
import { LanguageSelector as TranslationLanguageSelector } from './translation/LanguageSelector';

// This component is deprecated - use the one from translation folder instead
const LanguageSelector = () => {
  console.log('Warning: Using deprecated LanguageSelector, use src/components/translation/LanguageSelector.tsx instead');
  return <TranslationLanguageSelector />;
};

export default LanguageSelector;
