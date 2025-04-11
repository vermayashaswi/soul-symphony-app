
import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const AppDownloadSection = () => {
  const { t } = useTranslation();
  
  return (
    <section id="download-section" className="py-16 md:py-24 bg-theme text-white">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('download.title')}</h2>
          <p className="text-white/80 max-w-2xl mx-auto">
            {t('download.subtitle')}
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 justify-center">
          <Button variant="outline" className="bg-white text-theme hover:bg-white/90 text-lg px-8 py-6 h-auto">
            <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5640855,0 L6.43591449,0 C5.80509573,0 5.27729599,0.216808729 4.84306736,0.65103736 C4.40800823,1.08495908 4.1912423,1.61275881 4.1912423,2.24357758 L4.1912423,21.7564224 C4.1912423,22.3872412 4.40800823,22.9154979 4.84306736,23.3493626 C5.27725912,23.7832843 5.80505886,24 6.43591449,24 L17.5640855,24 C18.1949043,24 18.7227408,23.7832843 19.1569326,23.3493626 C19.5919549,22.9154979 19.8087209,22.3872412 19.8087209,21.7564224 L19.8087209,2.24357758 C19.8087209,1.61275881 19.5919549,1.08495908 19.1569326,0.65103736 C18.7227777,0.216808729 18.1949411,0 17.5640855,0 Z M17.0186215,2.97015799 L17.0186215,21.0298789 L6.98137851,21.0298789 L6.98137851,2.97015799 L17.0186215,2.97015799 Z M12,22.3237571 C12.5008065,22.3237571 12.9069232,21.9100255 12.9069232,21.4168404 C12.9069232,20.9236553 12.5008065,20.5099237 12,20.5099237 C11.4991935,20.5099237 11.0930768,20.9236553 11.0930768,21.4168404 C11.0930768,21.9100255 11.4991935,22.3237571 12,22.3237571 Z"></path></svg>
            {t('download.appStore')}
          </Button>
          
          <Button variant="outline" className="bg-white text-theme hover:bg-white/90 text-lg px-8 py-6 h-auto">
            <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5725888,12.0469243 C17.5458928,9.20744616 19.8972848,7.8137344 20,7.75339861 C18.9328336,6.22966628 17.2709296,5.94518352 16.6766096,5.92282808 C15.3001712,5.78652396 13.9740416,6.71695384 13.271424,6.71695384 C12.5531216,6.71695384 11.4756544,5.94370056 10.3225344,5.97254473 C8.82286736,6.00138889 7.43250496,6.83553583 6.66406464,8.16224895 C5.06483168,10.8732646 6.27196304,14.8453213 7.80222896,17.1359683 C8.57214944,18.2631458 9.48002544,19.5227447 10.6603568,19.4698083 C11.8108448,19.4131793 12.25712,18.7058917 13.635504,18.7058917 C14.9990544,18.7058917 15.416368,19.4698083 16.6175808,19.4365543 C17.8482672,19.4131793 18.6330464,18.3055946 19.3734144,17.1693034 C20.2560832,15.8389283 20.6099008,14.5348405 20.6257744,14.4670055 C20.5930528,14.4521758 17.6022112,13.3406133 17.5725888,12.0469243 Z M15.2450784,4.01374545 C15.8654128,3.23584729 16.2653888,2.15941815 16.1347696,1.06666667 C15.2212544,1.10403297 14.0936928,1.69887983 13.4467296,2.45441255 C12.8743536,3.11882834 12.3863664,4.23746308 12.5329072,5.29067799 C13.5600864,5.36706913 14.596696,4.77222227 15.2450784,4.01374545 Z"></path></svg>
            {t('download.googlePlay')}
          </Button>
        </div>
        
        <div className="mt-12 flex justify-center">
          <div className="relative max-w-md">
            <motion.img 
              src="/lovable-uploads/app-showcase.png"
              alt="SOULo App"
              className="relative z-10 mx-auto"
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ 
                repeat: Infinity, 
                repeatType: "reverse", 
                duration: 2 
              }}
            />
            <div className="absolute -inset-4 bg-primary/20 filter blur-xl rounded-full z-0 opacity-70" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppDownloadSection;
