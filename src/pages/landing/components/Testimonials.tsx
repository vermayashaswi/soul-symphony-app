
import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const Testimonials = () => {
  const { t } = useTranslation();
  
  // We'll use dummy testimonials for now
  const testimonials = [
    {
      name: "Sarah J.",
      role: "Student",
      content: "SOULo has completely changed how I journal. Being able to speak my thoughts rather than type them has made me much more consistent!",
      avatar: "/lovable-uploads/avatar-1.png"
    },
    {
      name: "Michael T.",
      role: "Professional",
      content: "I've tried many journaling apps, but SOULo's voice feature and AI insights make it stand out. It's helped me understand my emotional patterns.",
      avatar: "/lovable-uploads/avatar-2.png"
    },
    {
      name: "Elena R.",
      role: "Therapist",
      content: "I recommend SOULo to my clients. The voice journaling removes barriers to entry and the insights are genuinely helpful for self-reflection.",
      avatar: "/lovable-uploads/avatar-3.png"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {testimonials.map((testimonial, index) => (
        <motion.div 
          key={index}
          className="bg-card border border-primary/10 rounded-xl p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1 }}
        >
          <p className="text-muted-foreground mb-4 italic">"{testimonial.content}"</p>
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-primary/20 mr-3 flex items-center justify-center overflow-hidden">
              {testimonial.avatar ? (
                <img src={testimonial.avatar} alt={testimonial.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-medium">{testimonial.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h4 className="font-medium">{testimonial.name}</h4>
              <p className="text-sm text-muted-foreground">{testimonial.role}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default Testimonials;
