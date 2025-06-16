
import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Therapist",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b1-47c2-a86d-71b6.jpg?w=150",
      content: "SOULo has revolutionized how I track my emotional wellbeing. The AI insights help me understand patterns I never noticed before.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      role: "Student",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      content: "As someone who struggles with traditional journaling, SOULo makes it so easy. Just speak and the app does the rest!",
      rating: 5
    },
    {
      name: "Dr. Emily Watson",
      role: "Psychologist",
      image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150",
      content: "I recommend SOULo to my clients. The voice journaling approach removes barriers and the insights are genuinely helpful.",
      rating: 5
    },
    {
      name: "Ahmed Hassan",
      role: "Executive",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
      content: "The convenience is unmatched. I can journal during my commute and the AI gives me insights I can actually use.",
      rating: 5
    },
    {
      name: "Lisa Park",
      role: "Teacher",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
      content: "SOULo helped me process a difficult period in my life. The emotional tracking showed me how much I've grown.",
      rating: 5
    },
    {
      name: "David Kumar",
      role: "Designer",
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
      content: "The chat feature is amazing. I can ask questions about my own thoughts and get meaningful insights back.",
      rating: 5
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
    <section className="py-16 md:py-24 bg-gradient-to-br from-gray-50 to-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-gray-900">
            <TranslatableText text="What Our Users Say" />
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            <TranslatableText text="Join thousands who have transformed their mental wellness with voice journaling" />
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100"
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              
              <Quote className="h-8 w-8 text-primary/30 mb-4" />
              
              <p className="text-gray-700 mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>
              
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
