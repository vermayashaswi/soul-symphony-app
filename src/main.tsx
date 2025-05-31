
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeFonts } from "./utils/fontLoader.ts";

// Initialize fonts before rendering the app
const initializeApp = async () => {
  try {
    await initializeFonts();
    console.log('Fonts initialized successfully');
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
