
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from '@/contexts/AuthContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import './index.css';

// Initialize native services early
console.log('[Main] Initializing native integration service');
nativeIntegrationService.initialize().catch(error => {
  console.error('[Main] Failed to initialize native services:', error);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

console.log('[Main] Rendering application');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TranslationProvider>
          <App />
        </TranslationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
