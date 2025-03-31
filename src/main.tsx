
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Ensure proper viewport meta tag before any rendering occurs
const ensureViewportMeta = () => {
  const metaViewport = document.querySelector('meta[name="viewport"]');
  const correctContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
  
  if (metaViewport) {
    if (metaViewport.getAttribute('content') !== correctContent) {
      console.log("Updating existing viewport meta tag in main.tsx");
      metaViewport.setAttribute('content', correctContent);
    }
  } else {
    console.log("Creating new viewport meta tag in main.tsx");
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = correctContent;
    document.head.appendChild(meta);
  }
};

// Apply viewport meta before rendering
ensureViewportMeta();

// Create a root element and render the App within it
const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found, creating one");
  const newRoot = document.createElement("div");
  newRoot.id = "root";
  document.body.appendChild(newRoot);
  const root = createRoot(newRoot);
  root.render(<App />);
} else {
  console.log("Root element found, rendering app");
  const root = createRoot(rootElement);
  root.render(<App />);
}
