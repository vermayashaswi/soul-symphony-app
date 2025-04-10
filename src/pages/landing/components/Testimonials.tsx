
import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const futureUsers = [
  {
    id: 1,
    name: "Emily Chen",
    role: "Mental Health Advocate",
    quote: "I'm excited about SOULo's potential to make journaling accessible to everyone. Voice journaling removes the friction that keeps many from maintaining this beneficial habit.",
    avatar: "EC"
  },
  {
    id: 2,
    name: "Marcus Johnson",
    role: "Wellness Coach",
    quote: "I believe SOULo will revolutionize how we approach self-reflection. Speaking your thoughts aloud adds another dimension to the journaling experience.",
    avatar: "MJ"
  },
  {
    id: 3,
    name: "Sophia Williams",
    role: "Psychology Researcher",
    quote: "The combination of voice journaling with AI analysis is particularly promising. It could provide insights that would take years of traditional journaling to discover.",
    avatar: "SW"
  }
];

const Testimonials = () => {
  return (
    <section className="py-16 md:py-24 bg-primary/5">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center mb-12">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            What Experts Are Saying
          </motion.h2>
          <motion.p 
            className="text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Mental health professionals and wellness experts are excited about SOULo's innovative approach to journaling and self-discovery.
          </motion.p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {futureUsers.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
            >
              <Card className="h-full bg-card shadow-sm border border-primary/10 relative">
                <div className="absolute top-0 right-0 transform -translate-y-1/4 translate-x-1/4">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 25H7.5C6.83696 25 6.20107 24.7366 5.73223 24.2678C5.26339 23.7989 5 23.163 5 22.5V20C5 17.8783 5.84285 15.8434 7.34315 14.3431C8.84344 12.8429 10.8783 12 13 12H14C14.2652 12 14.5196 12.1054 14.7071 12.2929C14.8946 12.4804 15 12.7348 15 13V15C15 15.2652 14.8946 15.5196 14.7071 15.7071C14.5196 15.8946 14.2652 16 14 16H13C11.6739 16 10.4021 16.5268 9.46447 17.4645C8.52678 18.4021 8 19.6739 8 21H12.5C13.163 21 13.7989 21.2634 14.2678 21.7322C14.7366 22.2011 15 22.837 15 23.5V27.5C15 28.163 14.7366 28.7989 14.2678 29.2678C13.7989 29.7366 13.163 30 12.5 30H7.5C7.23478 30 6.98043 29.8946 6.79289 29.7071C6.60536 29.5196 6.5 29.2652 6.5 29V27.5C6.5 27.2348 6.60536 26.9804 6.79289 26.7929C6.98043 26.6054 7.23478 26.5 7.5 26.5H12.5V25ZM27.5 25H22.5C21.837 25 21.2011 24.7366 20.7322 24.2678C20.2634 23.7989 20 23.163 20 22.5V20C20 17.8783 20.8429 15.8434 22.3431 14.3431C23.8434 12.8429 25.8783 12 28 12H29C29.2652 12 29.5196 12.1054 29.7071 12.2929C29.8946 12.4804 30 12.7348 30 13V15C30 15.2652 29.8946 15.5196 29.7071 15.7071C29.5196 15.8946 29.2652 16 29 16H28C26.6739 16 25.4021 16.5268 24.4645 17.4645C23.5268 18.4021 23 19.6739 23 21H27.5C28.163 21 28.7989 21.2634 29.2678 21.7322C29.7366 22.2011 30 22.837 30 23.5V27.5C30 28.163 29.7366 28.7989 29.2678 29.2678C28.7989 29.7366 28.163 30 27.5 30H22.5C22.2348 30 21.9804 29.8946 21.7929 29.7071C21.6054 29.5196 21.5 29.2652 21.5 29V27.5C21.5 27.2348 21.6054 26.9804 21.7929 26.7929C21.9804 26.6054 22.2348 26.5 22.5 26.5H27.5V25Z" fill="currentColor" className="text-primary/20" />
                  </svg>
                </div>
                
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarFallback>{testimonial.avatar}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{testimonial.name}</h3>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground italic">"{testimonial.quote}"</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
