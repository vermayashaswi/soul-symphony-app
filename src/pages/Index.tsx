
import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mic, BarChart2, Bot, HeartPulse, Volume1 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { useAuth } from '@/contexts/AuthContext';

const fadeInUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.165, 0.84, 0.44, 1],
    },
  }),
};

const FeatureCard = ({ 
  title, 
  description, 
  index, 
  icon: Icon
}: { 
  title: string; 
  description: string; 
  index: number;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <motion.div
    className="glass-card rounded-2xl p-6 flex flex-col items-start"
    variants={fadeInUpVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-100px" }}
    custom={index}
  >
    <div className="bg-primary/10 p-3 rounded-xl text-primary mb-4">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </motion.div>
);

export default function Index() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    {
      title: "Voice Journaling",
      description: "Effortlessly record your thoughts and feelings with AI-powered transcription.",
      icon: Mic,
    },
    {
      title: "Emotion Tracking",
      description: "Visualize your emotional journey with smart tracking and pattern recognition.",
      icon: HeartPulse,
    },
    {
      title: "AI Mental Health Assistant",
      description: "Get personalized insights and guidance from your AI companion.",
      icon: Bot,
    },
    {
      title: "Data Visualization",
      description: "See your emotional trends and patterns with beautiful interactive charts.",
      icon: BarChart2,
    },
    {
      title: "Voice-Based Experience",
      description: "Interact naturally through voice for a more human-like experience.",
      icon: Volume1,
    },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleStartJournaling = () => {
    if (user) {
      navigate('/journal');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div ref={ref} className="min-h-screen">
      <Navbar />
      <ParticleBackground />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center py-20 px-4 overflow-hidden">
        <motion.div
          style={{ y, opacity }}
          className="absolute inset-0 -z-10"
        />
        
        <div className="max-w-5xl mx-auto text-center relative z-10 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-block mb-4 px-4 py-1.5 bg-primary/10 text-primary rounded-full font-medium text-sm"
          >
            Your Personal Mental Wellness Companion
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-gradient"
          >
            Journal Your Feelings,<br />Discover Your Patterns
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto text-balance"
          >
            Feelosophy combines voice journaling with AI to help you understand your emotions, 
            track patterns, and gain insights for better mental wellness.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="rounded-full px-6"
              onClick={handleStartJournaling}
            >
              Start Journaling
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-6"
              onClick={() => navigate('/chat')}
            >
              Try AI Assistant
            </Button>
          </motion.div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-24 px-4 bg-gradient-to-b from-background to-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Designed for Your Mental Wellness</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our features work together to help you understand yourself better and improve your mental well-being.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                index={index}
                icon={feature.icon}
              />
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-24 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center bg-gradient-to-r from-primary/10 to-blue-400/10 rounded-3xl p-12"
        >
          <h2 className="text-3xl font-bold mb-4">Start Your Journey Today</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Begin tracking your emotions, understanding your patterns, and improving your mental wellness with Feelosophy.
          </p>
          <Button 
            size="lg" 
            className="rounded-full px-8"
            onClick={handleStartJournaling}
          >
            Get Started
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </motion.div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 px-4 bg-secondary">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-6 md:mb-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="font-semibold text-xl">Feelosophy</span>
            </div>
            
            <div className="flex gap-8">
              <Link to="/journal" className="text-muted-foreground hover:text-foreground transition-colors">
                Journal
              </Link>
              <Link to="/insights" className="text-muted-foreground hover:text-foreground transition-colors">
                Insights
              </Link>
              <Link to="/chat" className="text-muted-foreground hover:text-foreground transition-colors">
                AI Assistant
              </Link>
              <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                Settings
              </Link>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Feelosophy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
