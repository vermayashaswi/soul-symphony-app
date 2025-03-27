
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Create a root element and render the App within it
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

// Add error boundary for React rendering
try {
  const root = createRoot(rootElement);
  root.render(<App />);
  console.log("App successfully rendered to DOM");
} catch (error) {
  console.error("Failed to render the app:", error);
  // Display a fallback UI when the app fails to load
  rootElement.innerHTML = `
    <div style="padding: 20px; text-align: center; font-family: system-ui, sans-serif;">
      <h2>Something went wrong</h2>
      <p>The application failed to load. Please try refreshing the page.</p>
      <p style="color: #666; font-size: 12px;">Error details: ${error instanceof Error ? error.message : String(error)}</p>
    </div>
  `;
}
