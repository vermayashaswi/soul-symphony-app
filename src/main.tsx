
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Critical fixes for mobile viewport rendering
const fixViewport = () => {
  // Ensure correct viewport meta tag
  let metaViewport = document.querySelector('meta[name="viewport"]');
  if (!metaViewport) {
    console.log("Creating missing viewport meta tag");
    metaViewport = document.createElement('meta');
    metaViewport.setAttribute('name', 'viewport');
    document.head.appendChild(metaViewport);
  }
  
  // Set the correct viewport settings
  metaViewport.setAttribute('content', 
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
  );
  
  // Force layout to use 100% height
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root {
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow-x: hidden !important;
    }
    
    .smart-chat-interface, .smart-chat-container {
      display: flex !important;
      flex-direction: column !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    .container {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 100% !important;
      max-width: 100% !important;
      overflow-x: hidden !important;
    }
  `;
  document.head.appendChild(style);
};

// Apply fixes immediately
fixViewport();

// Reapply fixes after any layout issues
window.addEventListener('DOMContentLoaded', fixViewport);
window.addEventListener('load', fixViewport);
setTimeout(fixViewport, 1000);

// Create a root element and render the App within it
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = createRoot(rootElement);
root.render(<App />);

// Debug on mobile - expose global emergency render function
window.forceEmergencyRender = function() {
  console.log("Emergency render triggered manually");
  fixViewport();
  
  // Force all containers to be visible
  document.querySelectorAll('.smart-chat-interface, .container, [class*="container"]').forEach(el => {
    if (el instanceof HTMLElement) {
      el.style.cssText = `display: block !important; visibility: visible !important; opacity: 1 !important;`;
    }
  });
};

// Add mobile detection to window for debugging
window.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
console.log("Mobile device detection:", window.isMobile);

// Add to global scope for debugging
declare global {
  interface Window {
    forceEmergencyRender: () => void;
    isMobile: boolean;
  }
}
