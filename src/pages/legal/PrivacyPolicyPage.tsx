
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/website/Footer';
import { TranslatableText } from '@/components/translation/TranslatableText';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-24 md:pt-32 pb-16">
        <div className="container mx-auto max-w-4xl px-4">
          <Button variant="ghost" asChild className="pl-0 mb-6">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <TranslatableText text="Back to Home" forceTranslate={true} />
            </Link>
          </Button>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-8">
            <TranslatableText text="Privacy Policy" forceTranslate={true} />
          </h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="lead">
              <TranslatableText text="Last Updated: April 10, 2024" forceTranslate={true} />
            </p>
            
            <p>
              <TranslatableText 
                text="SOULo ('we', 'our', or 'us') is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our SOULo application and related services (collectively, the 'Service')."
                forceTranslate={true}
              />
            </p>
            
            <h2><TranslatableText text="Data Collection" forceTranslate={true} /></h2>
            
            <h3><TranslatableText text="Personal Data" forceTranslate={true} /></h3>
            <p>
              <TranslatableText 
                text="When you register for an account, we collect your email address, name, and authentication information."
                forceTranslate={true}
              />
            </p>
            <ul>
              <li><TranslatableText text="Account information including email and name" forceTranslate={true} /></li>
              <li><TranslatableText text="Profile information you provide" forceTranslate={true} /></li>
              <li><TranslatableText text="Authentication data" forceTranslate={true} /></li>
            </ul>
            
            <h3><TranslatableText text="Voice Recordings" forceTranslate={true} /></h3>
            <p>
              <TranslatableText 
                text="We collect and store voice recordings that you create when using our service."
                forceTranslate={true}
              />
            </p>
            <ul>
              <li><TranslatableText text="Audio files you record" forceTranslate={true} /></li>
              <li><TranslatableText text="Transcriptions of your recordings" forceTranslate={true} /></li>
              <li><TranslatableText text="Analysis derived from your recordings" forceTranslate={true} /></li>
            </ul>
            
            <h3><TranslatableText text="Usage Data" forceTranslate={true} /></h3>
            <p>
              <TranslatableText 
                text="We collect information about how you interact with our Service."
                forceTranslate={true}
              />
            </p>
            <ul>
              <li><TranslatableText text="Features you use and time spent" forceTranslate={true} /></li>
              <li><TranslatableText text="Interaction patterns" forceTranslate={true} /></li>
              <li><TranslatableText text="Device information" forceTranslate={true} /></li>
              <li><TranslatableText text="IP address and browser type" forceTranslate={true} /></li>
            </ul>
            
            <h2><TranslatableText text="How We Use Your Information" forceTranslate={true} /></h2>
            
            <p><TranslatableText text="We use your information for the following purposes:" forceTranslate={true} /></p>
            <ul>
              <li><TranslatableText text="To provide and maintain our Service" forceTranslate={true} /></li>
              <li><TranslatableText text="To personalize your experience" forceTranslate={true} /></li>
              <li><TranslatableText text="To communicate with you about your account" forceTranslate={true} /></li>
              <li><TranslatableText text="To improve our Service" forceTranslate={true} /></li>
              <li><TranslatableText text="To analyze usage patterns" forceTranslate={true} /></li>
              <li><TranslatableText text="To process transactions" forceTranslate={true} /></li>
            </ul>
            
            <h2><TranslatableText text="Journal Privacy" forceTranslate={true} /></h2>
            
            <p>
              <strong><TranslatableText text="Your journal entries are private" forceTranslate={true} /></strong> 
              <TranslatableText 
                text=" and we take extensive measures to protect them."
                forceTranslate={true}
              />
            </p>
            <ul>
              <li><TranslatableText text="Entries are encrypted in transit and at rest" forceTranslate={true} /></li>
              <li><TranslatableText text="Only you can access your journal content" forceTranslate={true} /></li>
              <li><TranslatableText text="We do not share your journal entries with third parties" forceTranslate={true} /></li>
              <li><TranslatableText text="AI processing is done securely" forceTranslate={true} /></li>
            </ul>
            
            <h2><TranslatableText text="Security" forceTranslate={true} /></h2>
            
            <p>
              <TranslatableText 
                text="We implement appropriate security measures to protect your personal information."
                forceTranslate={true}
              />
            </p>
            <ul>
              <li><TranslatableText text="Encryption of sensitive data" forceTranslate={true} /></li>
              <li><TranslatableText text="Regular security assessments" forceTranslate={true} /></li>
              <li><TranslatableText text="Access controls and authentication" forceTranslate={true} /></li>
              <li><TranslatableText text="Secure infrastructure" forceTranslate={true} /></li>
            </ul>
            
            <p>
              <TranslatableText 
                text="No method of transmission over the Internet or electronic storage is 100% secure."
                forceTranslate={true}
              />
            </p>
            
            <h2><TranslatableText text="Data Retention" forceTranslate={true} /></h2>
            
            <p>
              <TranslatableText 
                text="We retain your personal information for as long as necessary to provide you with our services and as required by law."
                forceTranslate={true}
              />
            </p>
            
            <h2><TranslatableText text="Your Rights" forceTranslate={true} /></h2>
            
            <p><TranslatableText text="Depending on your location, you may have certain rights regarding your personal information:" forceTranslate={true} /></p>
            <ul>
              <li><TranslatableText text="Right to access your data" forceTranslate={true} /></li>
              <li><TranslatableText text="Right to correct inaccurate data" forceTranslate={true} /></li>
              <li><TranslatableText text="Right to delete your data" forceTranslate={true} /></li>
              <li><TranslatableText text="Right to restrict processing" forceTranslate={true} /></li>
              <li><TranslatableText text="Right to data portability" forceTranslate={true} /></li>
              <li><TranslatableText text="Right to object to processing" forceTranslate={true} /></li>
            </ul>
            
            <p>
              <TranslatableText 
                text="To exercise these rights, please contact us using the information below."
                forceTranslate={true}
              />
            </p>
            
            <h2><TranslatableText text="Children's Privacy" forceTranslate={true} /></h2>
            
            <p>
              <TranslatableText 
                text="Our Service is not intended for children under 13 years of age."
                forceTranslate={true}
              />
            </p>
            
            <h2><TranslatableText text="Changes to Privacy Policy" forceTranslate={true} /></h2>
            
            <p>
              <TranslatableText 
                text="We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page."
                forceTranslate={true}
              />
            </p>
            
            <h2><TranslatableText text="Contact Us" forceTranslate={true} /></h2>
            
            <p>
              <TranslatableText 
                text="If you have any questions about this Privacy Policy, please contact us:"
                forceTranslate={true}
              />
            </p>
            <p>
              <a href="mailto:support@soulo.online">support@soulo.online</a>
            </p>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
