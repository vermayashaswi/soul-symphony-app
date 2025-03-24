
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { useAuth } from '@/contexts/AuthContext';
import { Mic, BarChart2, MessageCircle, Brain } from 'lucide-react';

export default function Index() {
  const { user, isLoading } = useAuth();

  const handleStartJournaling = () => {
    console.log('Start journaling clicked, user state:', user?.email);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <ParticleBackground />
      
      <div className="container mx-auto px-4 pt-24 pb-16 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            Navigate Your Emotional Journey with AI
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8">
            Transform your voice into emotional insights. Record your thoughts and let our AI discover patterns in your emotional wellbeing over time.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isLoading ? (
              <Button disabled size="lg">
                <span className="animate-pulse">Loading...</span>
              </Button>
            ) : (
              <Button 
                size="lg" 
                onClick={handleStartJournaling}
                asChild
              >
                <Link to={user ? "/journal" : "/auth"} state={{ from: { pathname: "/journal" } }}>
                  Start Journaling
                </Link>
              </Button>
            )}
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-8 w-full max-w-5xl"
        >
          <div className="bg-card shadow-sm p-6 rounded-lg border border-border">
            <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 mb-4">
              <Mic className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Record Your Thoughts</h3>
            <p className="text-muted-foreground">Speak freely about your day, feelings, or reflections. Our app securely captures your voice journal.</p>
            <div className="mt-4 h-32 bg-slate-100 dark:bg-slate-800/50 rounded-lg flex items-center justify-center overflow-hidden">
              <motion.div 
                className="relative w-16 h-16"
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <div className="absolute inset-0 bg-blue-400/20 rounded-full animate-ping" />
                <div className="absolute inset-3 bg-blue-500/30 rounded-full animate-ping" style={{ animationDelay: "0.5s" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Mic className="h-8 w-8 text-blue-600" />
                </div>
              </motion.div>
            </div>
          </div>
          
          <div className="bg-card shadow-sm p-6 rounded-lg border border-border">
            <div className="h-14 w-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-300 mb-4">
              <Brain className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Analysis</h3>
            <p className="text-muted-foreground">Our AI transcribes your recordings and analyzes the emotional content, identifying key themes and patterns.</p>
            <div className="mt-4 h-32 bg-slate-100 dark:bg-slate-800/50 rounded-lg flex items-center justify-center overflow-hidden">
              <div className="flex gap-2">
                {['Happiness', 'Growth', 'Challenge', 'Reflection', 'Anxiety'].map((theme, i) => (
                  <motion.div
                    key={theme}
                    className={`rounded-full px-3 py-1 text-xs text-white ${
                      ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500'][i % 5]
                    }`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.2, duration: 0.5 }}
                  >
                    {theme}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-card shadow-sm p-6 rounded-lg border border-border">
            <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-300 mb-4">
              <BarChart2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Track Your Journey</h3>
            <p className="text-muted-foreground">Visualize your emotional wellbeing over time with personalized insights that help you understand yourself better.</p>
            <div className="mt-4 h-32 bg-slate-100 dark:bg-slate-800/50 rounded-lg flex items-center justify-center overflow-hidden">
              <svg className="w-full h-full p-2" viewBox="0 0 100 50">
                {/* Simple emotion graph visualization */}
                <motion.path
                  d="M0,25 Q10,35 20,15 T40,20 T60,10 T80,30 T100,25"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />
                <motion.path
                  d="M0,30 Q10,40 20,25 T40,30 T60,20 T80,35 T100,30"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
                />
              </svg>
            </div>
          </div>
          
          <div className="bg-card shadow-sm p-6 rounded-lg border border-border">
            <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-300 mb-4">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Assistant Chat</h3>
            <p className="text-muted-foreground">Have conversations with an AI that knows your journaling history and can provide personalized insights.</p>
            <div className="mt-4 h-32 bg-slate-100 dark:bg-slate-800/50 rounded-lg flex items-center justify-center overflow-hidden p-2">
              <div className="w-full space-y-2">
                <motion.div 
                  className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-xs ml-auto max-w-[70%]"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  How have I been feeling lately?
                </motion.div>
                <motion.div 
                  className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-xs max-w-[70%]"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  Based on your journal entries, you've been feeling more positive this week compared to last week.
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
