
import React from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MicIcon, BrainIcon, LineChartIcon, MessageSquareIcon } from 'lucide-react';

const FeatureShowcase = () => {
  return (
    <section className="py-16 md:py-24 bg-primary/5">
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Discover SOULo's Features</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          SOULo combines voice journaling with AI analysis to help you understand yourself better.
        </p>
        
        <Tabs defaultValue="voice" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full max-w-2xl mx-auto mb-8">
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <MicIcon className="h-4 w-4" /> Voice Journal
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <BrainIcon className="h-4 w-4" /> AI Analysis
            </TabsTrigger>
            <TabsTrigger value="tracking" className="flex items-center gap-2">
              <LineChartIcon className="h-4 w-4" /> Mood Tracking
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquareIcon className="h-4 w-4" /> AI Assistant
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="voice" className="mt-4">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <motion.div 
                className="w-full md:w-1/2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="text-2xl font-bold mb-4">Record Your Thoughts</h3>
                <p className="text-muted-foreground mb-4">
                  SOULo lets you journal by simply speaking your thoughts. No typing needed. Our advanced voice recognition technology transcribes your entries with remarkable accuracy.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Speak naturally in your own voice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Ultra-accurate transcription technology</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Journal anytime, anywhere</span>
                  </li>
                </ul>
              </motion.div>
              
              <motion.div 
                className="w-full md:w-1/2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="relative bg-gradient-to-tr from-primary/10 to-purple-500/10 p-1 rounded-2xl shadow-lg">
                  <img 
                    src="/lovable-uploads/a6374f0f-2e81-45f4-8c42-dfe81f7fbf01.png" 
                    alt="Voice journaling feature" 
                    className="rounded-xl w-full shadow-sm"
                  />
                </div>
              </motion.div>
            </div>
          </TabsContent>
          
          <TabsContent value="analysis" className="mt-4">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <motion.div 
                className="w-full md:w-1/2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="text-2xl font-bold mb-4">AI-Powered Analysis</h3>
                <p className="text-muted-foreground mb-4">
                  SOULo's advanced AI analyzes your journal entries to identify patterns, emotions, and themes, providing valuable insights into your mental wellbeing.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Identify emotional patterns and trends</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Discover recurring themes in your life</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Receive personalized insights about your well-being</span>
                  </li>
                </ul>
              </motion.div>
              
              <motion.div 
                className="w-full md:w-1/2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="relative bg-gradient-to-tr from-primary/10 to-purple-500/10 p-1 rounded-2xl shadow-lg">
                  <img 
                    src="/lovable-uploads/a66f2232-4b39-4d46-ace5-19e4c81b1f05.png" 
                    alt="AI analysis feature" 
                    className="rounded-xl w-full shadow-sm"
                  />
                </div>
              </motion.div>
            </div>
          </TabsContent>
          
          <TabsContent value="tracking" className="mt-4">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <motion.div 
                className="w-full md:w-1/2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="text-2xl font-bold mb-4">Track Your Emotional Journey</h3>
                <p className="text-muted-foreground mb-4">
                  Watch your emotional well-being evolve over time with beautiful, interactive charts and visualizations that help you understand your emotional patterns.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Visualize mood fluctuations over time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Identify triggers that affect your emotions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Track progress toward emotional well-being</span>
                  </li>
                </ul>
              </motion.div>
              
              <motion.div 
                className="w-full md:w-1/2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="relative bg-gradient-to-tr from-primary/10 to-purple-500/10 p-1 rounded-2xl shadow-lg">
                  <img 
                    src="/lovable-uploads/cb710491-93f0-42be-a596-f64d80d9800e.png" 
                    alt="Mood tracking feature" 
                    className="rounded-xl w-full shadow-sm"
                  />
                </div>
              </motion.div>
            </div>
          </TabsContent>
          
          <TabsContent value="chat" className="mt-4">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <motion.div 
                className="w-full md:w-1/2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="text-2xl font-bold mb-4">Chat with Your Journal</h3>
                <p className="text-muted-foreground mb-4">
                  Have meaningful conversations with SOULo's AI assistant that understands your journal entries and provides personalized advice and insights.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Ask questions about your past experiences</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Receive personalized growth suggestions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-1 mt-1">
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Gain deeper insights through natural conversation</span>
                  </li>
                </ul>
              </motion.div>
              
              <motion.div 
                className="w-full md:w-1/2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="relative bg-gradient-to-tr from-primary/10 to-purple-500/10 p-1 rounded-2xl shadow-lg">
                  <img 
                    src="/lovable-uploads/5b18686b-4a3c-4341-a072-479db470ac1d.png" 
                    alt="AI chat assistant feature" 
                    className="rounded-xl w-full shadow-sm"
                  />
                </div>
              </motion.div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};

export default FeatureShowcase;
