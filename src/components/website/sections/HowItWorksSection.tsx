
import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Brain, LineChart, ArrowRight } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

const HowItWorksSection = () => {
  const steps = [
    {
      step: 1,
      icon: Mic,
      title: "Speak Your Mind",
      description: "Just tap record and start talking. Share your thoughts, feelings, and daily experiences naturally."
    },
    {
      step: 2,
      icon: Brain,
      title: "AI Processing",
      description: "Our advanced AI transcribes your voice, analyzes emotions, and extracts meaningful insights."
    },
    {
      step: 3,
      icon: LineChart,
      title: "Track & Grow",
      description: "View your emotional patterns, chat with your entries, and discover personal growth opportunities."
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-gray-900">
            <TranslatableText text="How SOULo Works" />
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            <TranslatableText text="Three simple steps to transform your voice into meaningful insights" />
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                variants={itemVariants}
                className="relative text-center"
              >
                {/* Connection Line (hidden on mobile) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/60 to-primary/30 transform translate-x-6 z-0">
                    <ArrowRight className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-2 h-4 w-4 text-primary" />
                  </div>
                )}
                
                <div className="relative z-10">
                  {/* Step Number */}
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-6 shadow-lg">
                    {step.step}
                  </div>
                  
                  {/* Icon */}
                  <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md border border-gray-100">
                    <step.icon className="h-8 w-8 text-primary" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-xl md:text-2xl font-semibold mb-4 text-gray-900">
                    <TranslatableText text={step.title} />
                  </h3>
                  <p className="text-gray-600 leading-relaxed max-w-sm mx-auto">
                    <TranslatableText text={step.description} />
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
