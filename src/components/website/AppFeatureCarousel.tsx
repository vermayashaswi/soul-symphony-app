
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Mic, Brain, LineChart, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OptimizedImage } from '@/utils/imageUtils';

const features = [
  {
    title: "Voice Journaling",
    description: "Record your thoughts with voice and let SOuLO transcribe and analyze them automatically.",
    icon: Mic,
    image: "features.voiceJournaling",
  },
  {
    title: "AI Analysis",
    description: "Gain insights into your patterns and emotions through advanced AI analysis.",
    icon: Brain,
    image: "features.aiAnalysis",
  },
  {
    title: "Emotional Tracking",
    description: "Visualize your emotional journey over time with interactive charts.",
    icon: LineChart,
    image: "features.emotionalTracking",
  },
  {
    title: "AI Assistant",
    description: "Chat with your journal and get personalized insights from your past entries.",
    icon: MessageSquare,
    image: "features.aiAssistant",
  }
];

const AppFeatureCarousel = () => {
  const [activeFeature, setActiveFeature] = useState(0);

  const nextFeature = () => {
    setActiveFeature((prev) => (prev + 1) % features.length);
  };

  const prevFeature = () => {
    setActiveFeature((prev) => (prev - 1 + features.length) % features.length);
  };

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">
            App Features
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Discover SOuLO's Features</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our innovative approach combines voice journaling with AI technology to provide you with meaningful insights about yourself.
          </p>
        </div>
        
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="icon" 
              className="absolute left-0 z-10 rounded-full"
              onClick={prevFeature}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            
            <div className="w-full overflow-hidden py-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <motion.div 
                  key={activeFeature}
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.5 }}
                  className="w-full md:w-1/2 p-4"
                >
                  <Card className="overflow-hidden border-primary/10 shadow-lg bg-white">
                    <CardContent className="p-0">
                      <OptimizedImage 
                        src={features[activeFeature].image} 
                        alt={features[activeFeature].title} 
                        className="w-full h-auto"
                      />
                    </CardContent>
                  </Card>
                </motion.div>
                
                <motion.div 
                  key={`text-${activeFeature}`}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="w-full md:w-1/2 p-4 text-center md:text-left"
                >
                  <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mb-6 mx-auto md:mx-0">
                    {React.createElement(features[activeFeature].icon, { className: "h-8 w-8 text-primary" })}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4">{features[activeFeature].title}</h3>
                  <p className="text-muted-foreground text-lg">{features[activeFeature].description}</p>
                </motion.div>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="icon" 
              className="absolute right-0 z-10 rounded-full"
              onClick={nextFeature}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
          
          <div className="flex justify-center gap-2 mt-8">
            {features.map((_, index) => (
              <button
                key={index}
                className={`w-3 h-3 rounded-full ${index === activeFeature ? 'bg-primary' : 'bg-gray-300'}`}
                onClick={() => setActiveFeature(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppFeatureCarousel;
