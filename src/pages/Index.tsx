
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { useAuth } from '@/contexts/AuthContext';

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
            
            <Button variant="outline" size="lg" asChild>
              <Link to="/insights">
                View Demo Insights
              </Link>
            </Button>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl"
        >
          <div className="bg-card shadow-sm p-6 rounded-lg border border-border">
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 mb-4">
              <span className="text-2xl">1</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Record Your Thoughts</h3>
            <p className="text-muted-foreground">Speak freely about your day, feelings, or reflections. Our app securely captures your voice journal.</p>
          </div>
          
          <div className="bg-card shadow-sm p-6 rounded-lg border border-border">
            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-300 mb-4">
              <span className="text-2xl">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Analysis</h3>
            <p className="text-muted-foreground">Our AI transcribes your recordings and analyzes the emotional content, identifying key themes and patterns.</p>
          </div>
          
          <div className="bg-card shadow-sm p-6 rounded-lg border border-border">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-300 mb-4">
              <span className="text-2xl">3</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Track Your Journey</h3>
            <p className="text-muted-foreground">Visualize your emotional wellbeing over time with personalized insights that help you understand yourself better.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
