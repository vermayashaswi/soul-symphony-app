
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeFonts, reloadFonts } from "./utils/fontLoader.ts";

// Initialize fonts before rendering the app
const initializeApp = async () => {
  try {
    console.log('Starting font initialization...');
    await initializeFonts();
    console.log('Fonts initialized successfully');
    
    // Add language change listener to reload fonts when needed
    document.addEventListener('languageChanged', async (event: any) => {
      console.log('Language changed, reloading fonts for:', event.detail.language);
      try {
        await reloadFonts();
        console.log('Fonts reloaded successfully for language change');
      } catch (error) {
        console.warn('Font reload failed after language change:', error);
      }
    });
    
  } catch (error) {
    console.warn('Font initialization failed, continuing with fallback fonts:', error);
  }
  
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

initializeApp();
