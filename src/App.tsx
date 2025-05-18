
import React from 'react';
import AppRoutes from './routes/AppRoutes';
import { DebugModeProvider } from './contexts/DebugModeContext';
import { TranslationProvider } from './contexts/TranslationContext';
import './App.css';
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <DebugModeProvider>
      <TranslationProvider>
        <AppRoutes />
        <Toaster />
      </TranslationProvider>
    </DebugModeProvider>
  );
}

export default App;
