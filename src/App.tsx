
import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/hooks/use-theme';
import { AuthProvider } from '@/contexts/AuthContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { router } from '@/routes/routeConfig';
import './App.css';
import './styles/mobile.css';
import './styles/emoji.css';
import './styles/tutorial.css'; // Add the tutorial styles

// Import the TutorialProvider
import { TutorialProvider } from '@/contexts/TutorialContext';

function App() {
  return (
    <>
      <AuthProvider>
        <ThemeProvider>
          <TranslationProvider>
            <TutorialProvider>
              <RouterProvider router={router} />
            </TutorialProvider>
          </TranslationProvider>
        </ThemeProvider>
      </AuthProvider>
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}

export default App;
