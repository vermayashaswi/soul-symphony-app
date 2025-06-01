
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize the app without font loading since we're using HTML overlays
const initializeApp = async () => {
  console.log('Initializing app with HTML overlay system');
  
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

initializeApp();
