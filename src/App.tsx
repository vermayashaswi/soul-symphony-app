
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "./hooks/use-theme";
import AppRoutes from "./routes/AppRoutes";
import "./styles/mobile.css";

const App = () => {
  return (
    <TooltipProvider>
      <ThemeProvider>
        <div className="relative min-h-screen">
          <div className="relative z-10">
            <Toaster />
            <Sonner position="top-center" closeButton={false} />
            <AnimatePresence mode="wait">
              <AppRoutes />
            </AnimatePresence>
          </div>
        </div>
      </ThemeProvider>
    </TooltipProvider>
  );
};

export default App;
