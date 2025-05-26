
// Simple website translations utility
export const getWebsiteTranslation = (key: string, language: string = 'en'): string => {
  // For now, just return the key as we're using Google Translate API
  // This can be expanded later if needed for specific website translations
  return key;
};

export const websiteTranslations = {
  get: getWebsiteTranslation
};
