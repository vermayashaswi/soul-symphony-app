
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/website/Footer';
import { useTranslation } from 'react-i18next';

const PrivacyPolicyPage = () => {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-24 md:pt-32 pb-16">
        <div className="container mx-auto max-w-4xl px-4">
          <Button variant="ghost" asChild className="pl-0 mb-6">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('privacy.backToHome')}
            </Link>
          </Button>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-8">{t('privacy.title')}</h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="lead">
              {t('privacy.lastUpdated', { date: 'April 10, 2024' })}
            </p>
            
            <p>
              {t('privacy.intro')}
            </p>
            
            <h2>{t('privacy.dataCollectionTitle')}</h2>
            
            <h3>{t('privacy.personalDataTitle')}</h3>
            <p>
              {t('privacy.personalDataDesc')}
            </p>
            <ul>
              <li>{t('privacy.personalData1')}</li>
              <li>{t('privacy.personalData2')}</li>
              <li>{t('privacy.personalData3')}</li>
            </ul>
            
            <h3>{t('privacy.voiceRecordingsTitle')}</h3>
            <p>
              {t('privacy.voiceRecordingsDesc')}
            </p>
            <ul>
              <li>{t('privacy.voiceRecordings1')}</li>
              <li>{t('privacy.voiceRecordings2')}</li>
              <li>{t('privacy.voiceRecordings3')}</li>
            </ul>
            
            <h3>{t('privacy.usageDataTitle')}</h3>
            <p>
              {t('privacy.usageDataDesc')}
            </p>
            <ul>
              <li>{t('privacy.usageData1')}</li>
              <li>{t('privacy.usageData2')}</li>
              <li>{t('privacy.usageData3')}</li>
              <li>{t('privacy.usageData4')}</li>
            </ul>
            
            <h2>{t('privacy.dataUseTitle')}</h2>
            
            <p>{t('privacy.dataUseDesc')}</p>
            <ul>
              <li>{t('privacy.dataUse1')}</li>
              <li>{t('privacy.dataUse2')}</li>
              <li>{t('privacy.dataUse3')}</li>
              <li>{t('privacy.dataUse4')}</li>
              <li>{t('privacy.dataUse5')}</li>
              <li>{t('privacy.dataUse6')}</li>
            </ul>
            
            <h2>{t('privacy.journalPrivacyTitle')}</h2>
            
            <p>
              <strong>{t('privacy.journalPrivacyHighlight')}</strong> {t('privacy.journalPrivacyDesc')}
            </p>
            <ul>
              <li>{t('privacy.journalPrivacy1')}</li>
              <li>{t('privacy.journalPrivacy2')}</li>
              <li>{t('privacy.journalPrivacy3')}</li>
              <li>{t('privacy.journalPrivacy4')}</li>
            </ul>
            
            <h2>{t('privacy.securityTitle')}</h2>
            
            <p>
              {t('privacy.securityDesc')}
            </p>
            <ul>
              <li>{t('privacy.security1')}</li>
              <li>{t('privacy.security2')}</li>
              <li>{t('privacy.security3')}</li>
              <li>{t('privacy.security4')}</li>
            </ul>
            
            <p>
              {t('privacy.securityDisclaimer')}
            </p>
            
            <h2>{t('privacy.dataRetentionTitle')}</h2>
            
            <p>
              {t('privacy.dataRetentionDesc')}
            </p>
            
            <h2>{t('privacy.rightsTitle')}</h2>
            
            <p>{t('privacy.rightsDesc')}</p>
            <ul>
              <li>{t('privacy.rights1')}</li>
              <li>{t('privacy.rights2')}</li>
              <li>{t('privacy.rights3')}</li>
              <li>{t('privacy.rights4')}</li>
              <li>{t('privacy.rights5')}</li>
              <li>{t('privacy.rights6')}</li>
            </ul>
            
            <p>
              {t('privacy.rightsContact')}
            </p>
            
            <h2>{t('privacy.childrenTitle')}</h2>
            
            <p>
              {t('privacy.childrenDesc')}
            </p>
            
            <h2>{t('privacy.changesTitle')}</h2>
            
            <p>
              {t('privacy.changesDesc')}
            </p>
            
            <h2>{t('privacy.contactTitle')}</h2>
            
            <p>
              {t('privacy.contactDesc')}
            </p>
            <p>
              <a href="mailto:hello@soulo.online">hello@soulo.online</a>
            </p>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
