
import React from 'react';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useLocationPricing } from '@/hooks/useLocationPricing';

interface PricingSectionProps {
  openAppStore: () => void;
  openPlayStore: () => void;
}

const PricingSection: React.FC<PricingSectionProps> = ({ openAppStore, openPlayStore }) => {
  const { pricing, isLoading } = useLocationPricing();

  const plans = [
    {
      name: "Free Trial",
      price: "Free",
      period: "14 days",
      description: "Perfect for getting started with voice journaling",
      features: [
        "Unlimited voice entries",
        "Basic emotion analysis",
        "2 weeks of history",
        "Mobile app access"
      ],
      popular: false,
      cta: "Start Free Trial"
    },
    {
      name: "Premium",
      price: isLoading ? "..." : pricing.price,
      period: "month",
      description: "Complete voice journaling experience with AI insights",
      features: [
        "Everything in Free Trial",
        "Advanced AI insights",
        "Unlimited history",
        "Emotion trend analysis",
        "Smart chat with entries",
        "Export capabilities",
        "Priority support"
      ],
      popular: true,
      cta: "Get Premium"
    },
    {
      name: "Yearly",
      price: isLoading ? "..." : getYearlyPrice(pricing.price),
      period: "year",
      originalPrice: isLoading ? undefined : getYearlyOriginalPrice(pricing.price),
      description: "Best value for serious journalers",
      features: [
        "Everything in Premium",
        "33% savings vs monthly",
        "Advanced analytics",
        "Custom themes",
        "Data insights reports",
        "Early access to features"
      ],
      popular: false,
      cta: "Save 33%"
    }
  ];

  // Helper function to calculate yearly price (33% savings)
  function getYearlyPrice(monthlyPrice: string): string {
    if (!monthlyPrice || monthlyPrice === "Free") return monthlyPrice;
    
    // Extract currency symbol and numeric value
    const match = monthlyPrice.match(/^([^\d]+)?(\d+(?:\.\d+)?)/);
    if (!match) return monthlyPrice;
    
    const currencySymbol = match[1] || '';
    const numericValue = parseFloat(match[2]);
    
    // Calculate yearly price with 33% discount
    const yearlyPrice = Math.round((numericValue * 12 * 0.67) * 100) / 100;
    
    return `${currencySymbol}${yearlyPrice}`;
  }

  // Helper function to calculate original yearly price (without discount)
  function getYearlyOriginalPrice(monthlyPrice: string): string {
    if (!monthlyPrice || monthlyPrice === "Free") return monthlyPrice;
    
    // Extract currency symbol and numeric value
    const match = monthlyPrice.match(/^([^\d]+)?(\d+(?:\.\d+)?)/);
    if (!match) return monthlyPrice;
    
    const currencySymbol = match[1] || '';
    const numericValue = parseFloat(match[2]);
    
    // Calculate original yearly price (12 months)
    const originalYearlyPrice = Math.round((numericValue * 12) * 100) / 100;
    
    return `${currencySymbol}${originalYearlyPrice}`;
  }

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
            <TranslatableText text="Choose Your Plan" />
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            <TranslatableText text="Start your voice journaling journey with our 14-day free trial" />
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className={`relative rounded-2xl border-2 p-8 ${
                plan.popular
                  ? 'border-primary bg-gradient-to-br from-primary/5 to-purple/5 shadow-xl scale-105'
                  : 'border-gray-200 bg-white hover:border-primary/50'
              } transition-all duration-300`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    <TranslatableText text="Most Popular" />
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  <TranslatableText text={plan.name} />
                </h3>
                <div className="mb-2">
                  {plan.originalPrice && (
                    <span className="text-lg text-gray-400 line-through mr-2">
                      {plan.originalPrice}
                    </span>
                  )}
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  {plan.price !== "Free" && plan.price !== "..." && (
                    <span className="text-gray-600">/{plan.period}</span>
                  )}
                </div>
                <p className="text-gray-600">
                  <TranslatableText text={plan.description} />
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-gray-700">
                      <TranslatableText text={feature} />
                    </span>
                  </li>
                ))}
              </ul>

              <Button 
                className={`w-full ${
                  plan.popular 
                    ? 'bg-primary hover:bg-primary/90' 
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
                size="lg"
                onClick={openAppStore}
                disabled={isLoading}
              >
                <TranslatableText text={plan.cta} />
              </Button>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12"
        >
          <p className="text-gray-600">
            <TranslatableText text="All plans include a 14-day free trial. Cancel anytime." />
          </p>
          {!isLoading && pricing.country !== 'Global' && (
            <p className="text-sm text-gray-500 mt-2">
              Prices shown for {pricing.country} in {pricing.currency}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
