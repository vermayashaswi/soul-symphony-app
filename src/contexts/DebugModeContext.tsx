
import React, { createContext, useContext, useState } from 'react';

interface DebugModeContextType {
  debugMode: boolean;
  toggleDebugMode: () => void;
}

const DebugModeContext = createContext<DebugModeContextType>({
  debugMode: false,
  toggleDebugMode: () => {}
});

export const DebugModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [debugMode, setDebugMode] = useState<boolean>(false);

  const toggleDebugMode = () => {
    setDebugMode(prev => !prev);
  };

  return (
    <DebugModeContext.Provider value={{ debugMode, toggleDebugMode }}>
      {children}
    </DebugModeContext.Provider>
  );
};

export const useDebugMode = () => useContext(DebugModeContext);
