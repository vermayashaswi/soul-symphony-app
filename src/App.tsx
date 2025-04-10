
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/use-theme';
import { LanguageProvider } from '@/contexts/LanguageContext';
import AppRoutes from '@/routes/AppRoutes';
import { Toaster } from '@/components/ui/toaster';
import '@/App.css';

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <Router>
          <AppRoutes />
          <Toaster />
        </Router>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
