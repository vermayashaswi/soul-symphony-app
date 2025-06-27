
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { nativeIntegrationService } from './services/nativeIntegrationService';

// Initialize native integration service
nativeIntegrationService.initialize().catch(error => {
  console.error('Failed to initialize native integration:', error);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
