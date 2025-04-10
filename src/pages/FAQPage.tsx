
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Footer from '@/pages/landing/components/Footer';

const FAQPage = () => {
  const faqs = [
    {
      question: "What is SOULo?",
      answer: "SOULo is a voice journaling app powered by AI that helps you express your thoughts through speaking, reflect on your emotions, and grow through personalized insights. The app transcribes your voice entries, analyzes emotional patterns, and provides tailored recommendations for personal growth."
    },
    {
      question: "Is my journal data private?",
      answer: "Absolutely. Privacy is our top priority. Your journal entries are stored locally on your device and processed with end-to-end encryption. We don't store the content of your journal entries on our servers, and your data is never shared with third parties."
    },
    {
      question: "How does voice journaling work?",
      answer: "Simply open the app, tap the record button, and start speaking. SOULo will record your voice, transcribe your words, and save them as a journal entry. You can review, edit, and add to your entries anytime. The AI will analyze your entries to provide insights about your emotional patterns and trends."
    },
    {
      question: "Do I need an internet connection to use SOULo?",
      answer: "You need an internet connection for voice transcription and AI analysis features. However, you can review your past journal entries and some basic features offline. We're working on expanding offline capabilities in future updates."
    },
    {
      question: "Is SOULo free to use?",
      answer: "SOULo offers both free and premium options. The free version includes basic voice journaling, transcription, and limited AI insights. Premium subscriptions offer advanced features like unlimited AI analysis, deeper insights, and additional customization options."
    },
    {
      question: "Can I export my journal entries?",
      answer: "Yes, you can export your journal entries as text files or PDFs. You can also back up your data to secure cloud storage like Google Drive or iCloud, which maintains the end-to-end encryption of your content."
    },
    {
      question: "How accurate is the voice transcription?",
      answer: "SOULo uses advanced speech recognition technology that works well for most speakers in clear environments. The accuracy typically exceeds 95% for standard speech in quiet settings. You can always review and edit transcriptions if needed."
    },
    {
      question: "What kinds of insights does the AI provide?",
      answer: "SOULo's AI identifies emotional patterns, recurring themes, and potential correlations in your life. For example, it might notice that you tend to feel more positive after spending time in nature, or that work stress peaks at certain times of the month. These insights help you understand yourself better and make positive changes."
    },
    {
      question: "Is SOULo available on both iOS and Android?",
      answer: "Yes, SOULo is available for both iOS and Android devices. You can download it from the App Store or Google Play Store."
    },
    {
      question: "How do I get started with SOULo?",
      answer: "Download the app from your device's app store, create an account, and follow the simple onboarding process. You'll be guided through making your first voice journal entry and exploring the app's features. We recommend starting with just a few minutes of journaling each day to build the habit."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-24 md:pt-32 pb-16">
        <div className="container mx-auto max-w-4xl px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions about SOULo, voice journaling, and how our app can help you grow.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left font-medium text-lg">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
          
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
            <p className="text-muted-foreground mb-6">
              We're here to help! Reach out to our support team for assistance.
            </p>
            <Button asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </section>
      
      {/* Download CTA */}
      <section className="py-16 bg-primary/5">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Start Your Journey?</h2>
            <p className="text-muted-foreground mb-6">
              Download SOULo today and begin your path to self-discovery through voice journaling.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg">Download for iOS</Button>
              <Button size="lg" variant="outline">Download for Android</Button>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default FAQPage;
