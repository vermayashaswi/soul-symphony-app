
import { useEffect } from "react";
import SmartChatInterface from "@/components/chat/SmartChatInterface";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SmartChat() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Smart Chat | SOULo";
  }, []);

  useEffect(() => {
    // Check if the user is authenticated, if not redirect to login
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, navigate]);

  // If still loading auth state, show a loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only render the chat interface if the user is authenticated
  return user ? (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container py-8 max-w-7xl mx-auto"
    >
      <h1 className="text-3xl font-bold text-center mb-8">Smart Journal Chat</h1>
      <p className="text-center text-muted-foreground mb-8">
        Ask questions about your journal entries using natural language.
        Our AI will analyze your journals and provide insights by understanding emotions, themes, and entities.
      </p>
      
      <SmartChatInterface />
    </motion.div>
  ) : null;
}
