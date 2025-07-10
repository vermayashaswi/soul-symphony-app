import React, { createContext, useContext, ReactNode } from 'react';

interface NoTranslationContextType {
  translationsDisabled: boolean;
}

const NoTranslationContext = createContext<NoTranslationContextType>({
  translationsDisabled: false,
});

export const useNoTranslation = () => useContext(NoTranslationContext);

interface NoTranslationWrapperProps {
  children: ReactNode;
}

export const NoTranslationWrapper: React.FC<NoTranslationWrapperProps> = ({ children }) => {
  return (
    <NoTranslationContext.Provider value={{ translationsDisabled: true }}>
      {children}
    </NoTranslationContext.Provider>
  );
};