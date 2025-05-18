
import React from 'react';
import AppRoutes from './routes/AppRoutes';
import { DebugModeProvider } from './contexts/DebugModeContext';
import './App.css';
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <DebugModeProvider>
      <AppRoutes />
      <Toaster />
    </DebugModeProvider>
  );
}

export default App;
