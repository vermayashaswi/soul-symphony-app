
import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Brain, LineChart, Shield, MessageSquare, Clock } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

const FeaturesSection = () => {
  const features = [
    {
      icon: Mic,
      title: "Voice Journaling",
      description: "Simply speak your thoughts. Our AI transcribes and organizes your voice entries automatically."
    },
    {
      icon: Brain,
      title: "AI-Powered Insights",
      description: "Get personalized insights about your emotional patterns, mood trends, and personal growth."
    },
    {
      icon: LineChart,
      title: "Emotion Tracking",
      description: "Visualize your emotional journey with interactive charts and trend analysis over time."
    },
    {
      icon: MessageSquare,
      title: "Smart Chat Assistant",
      description: "Chat with your journal entries and get meaningful insights from your past reflections."
    },
    {
      icon: Shield,
      title: "Privacy First",
      description: "Your personal thoughts stay private with end-to-end encryption and secure storage."
    },
    {
      icon: Clock,
      title: "Quick & Easy",
      description: "Journal in seconds, not minutes. Perfect for busy lifestyles and daily reflection."
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-gray-900">
            <TranslatableText text="Why Choose SOULo?" />
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            <TranslatableText text="Discover the powerful features that make voice journaling effortless and insightful" />
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">
                <TranslatableText text={feature.title} />
              </h3>
              <p className="text-gray-600 leading-relaxed">
                <TranslatableText text={feature.description} />
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
