
import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is SOULo?",
    answer: "SOULo is a voice journaling app that helps you record your thoughts, reflect on your emotions, and gain insights through AI analysis. Simply speak your thoughts, and SOULo will transcribe, analyze, and help you track your emotional patterns over time."
  },
  {
    question: "How does voice journaling work?",
    answer: "With SOULo, you simply tap the record button and start speaking your thoughts. The app will transcribe your voice into text, analyze the emotions and themes in your entry, and save it to your journal. You can review your entries anytime and get insights about your emotional patterns."
  },
  {
    question: "Is my data private and secure?",
    answer: "Yes, we take privacy extremely seriously. Your journal entries are stored locally on your device with end-to-end encryption. We never share your data with third parties, and our AI processing is designed with privacy at its core. You have complete control over your data at all times."
  },
  {
    question: "Can I use SOULo without an internet connection?",
    answer: "You can record entries offline, but transcription and AI analysis require an internet connection. Once processed, your entries are accessible offline for viewing and reflection."
  },
  {
    question: "What platforms is SOULo available on?",
    answer: "SOULo is available for both iOS (iPhone and iPad) and Android devices. You can download it from the App Store or Google Play Store."
  },
  {
    question: "Is there a cost to use SOULo?",
    answer: "SOULo offers both free and premium plans. The free plan includes basic voice journaling features, while the premium subscription provides additional features like advanced AI insights, unlimited entries, and deeper emotional analytics."
  },
  {
    question: "How accurate is the voice transcription?",
    answer: "SOULo uses advanced speech recognition technology that works well across different accents and speaking styles. While no transcription system is perfect, SOULo's technology is highly accurate and continuously improving."
  },
  {
    question: "Can I edit my journal entries after recording?",
    answer: "Yes, you can edit the transcribed text of your journal entries to correct any transcription errors or add additional thoughts."
  }
];

const FAQPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Find answers to the most common questions about SOULo and voice journaling.
            </p>
          </motion.div>
          
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <AccordionItem value={`item-${index}`} className="border-b border-gray-200">
                    <AccordionTrigger className="text-lg font-medium py-4 hover:text-primary transition-colors">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </div>
          
          <div className="mt-16 text-center">
            <p className="text-muted-foreground mb-4">
              Still have questions? We're here to help!
            </p>
            <p className="text-lg">
              Contact us at <a href="mailto:support@soulo.online" className="text-primary hover:underline">support@soulo.online</a>
            </p>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default FAQPage;
