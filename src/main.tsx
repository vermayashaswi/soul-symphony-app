
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Create a root element and render the App within it
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = createRoot(rootElement);
root.render(<App />);
