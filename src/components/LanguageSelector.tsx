
import React from 'react';
import { LanguageSelector as TranslationLanguageSelector } from './translation/LanguageSelector';

// This component is deprecated - use the one from translation folder instead
const LanguageSelector = (props: any) => {
  console.log('Warning: Using deprecated LanguageSelector, use src/components/translation/LanguageSelector.tsx instead');
  return <TranslationLanguageSelector {...props} />;
};

export default LanguageSelector;
