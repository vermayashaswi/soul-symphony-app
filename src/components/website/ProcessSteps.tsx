
import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Brain, BarChart } from 'lucide-react';

interface ProcessStep {
  step: string;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

const ProcessSteps: React.FC = () => {
  const steps: ProcessStep[] = [
    {
      step: "1",
      title: "Record Your Thoughts",
      description: "Speak freely about your day, feelings, or any thoughts you want to capture. No writing required!",
      icon: Mic
    },
    {
      step: "2",
      title: "AI Analyzes Your Entry",
      description: "Our AI transcribes your voice and analyzes the emotional patterns and key themes in your entry.",
      icon: Brain
    },
    {
      step: "3",
      title: "Gain Personalized Insights",
      description: "Discover patterns, track emotional trends over time, and get personalized insights to support your growth.",
      icon: BarChart
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">Process</span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start your self-discovery journey in three simple steps
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((item, i) => (
            <motion.div 
              key={i}
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
            >
              <div className="relative mb-6">
                <div className="absolute -inset-1 bg-primary/20 rounded-full blur-lg"></div>
                <div className="bg-white w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center text-2xl font-bold text-primary relative">
                  {item.step}
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">{item.title}</h3>
              <p className="text-muted-foreground mb-6">{item.description}</p>
              
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 bg-primary/10 rounded-full flex items-center justify-center">
                  <item.icon className="h-12 w-12 text-primary" />
                </div>
                <div className="absolute -inset-2 bg-primary/5 rounded-full -z-10 animate-pulse"></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProcessSteps;
