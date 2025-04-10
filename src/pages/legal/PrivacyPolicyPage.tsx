
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/pages/landing/components/Footer';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-24 md:pt-32 pb-16">
        <div className="container mx-auto max-w-4xl px-4">
          <Button variant="ghost" asChild className="pl-0 mb-6">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="lead">
              Last updated: April 10, 2024
            </p>
            
            <p>
              At SOULo, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services.
            </p>
            
            <h2>Information We Collect</h2>
            
            <h3>Personal Data</h3>
            <p>
              We may collect personal information that you voluntarily provide when creating an account or using our services, including:
            </p>
            <ul>
              <li>Email address</li>
              <li>Name (optional)</li>
              <li>User profile information (optional)</li>
            </ul>
            
            <h3>Voice Recordings and Journal Entries</h3>
            <p>
              SOULo's primary function is voice journaling, which involves:
            </p>
            <ul>
              <li>Voice recordings that you create</li>
              <li>Transcriptions of those recordings</li>
              <li>Emotion and theme analysis derived from your entries</li>
            </ul>
            
            <h3>Usage Data</h3>
            <p>
              We automatically collect certain information about how you use our app, including:
            </p>
            <ul>
              <li>Device type and operating system</li>
              <li>App features you use and how you interact with them</li>
              <li>Time and date of your use</li>
              <li>Error logs and performance data</li>
            </ul>
            
            <h2>How We Use Your Information</h2>
            
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our services</li>
              <li>Process and complete transactions</li>
              <li>Send administrative information, such as updates or security alerts</li>
              <li>Respond to your comments and questions</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Generate anonymized, aggregated data for research purposes</li>
            </ul>
            
            <h2>Privacy of Journal Entries</h2>
            
            <p>
              <strong>Your journal entries remain private.</strong> Your voice recordings and transcribed journal entries are stored securely on your device. When you use AI analysis features:
            </p>
            <ul>
              <li>Data is processed with end-to-end encryption</li>
              <li>We do not permanently store the content of your journal entries on our servers</li>
              <li>AI processing results are returned to your device and stored locally</li>
              <li>Journal entries are never shared with third parties</li>
            </ul>
            
            <h2>Data Storage and Security</h2>
            
            <p>
              We implement appropriate technical and organizational measures to protect your personal data against unauthorized or unlawful processing, accidental loss, destruction, or damage. These measures include:
            </p>
            <ul>
              <li>End-to-end encryption for data in transit</li>
              <li>Secure local storage with encryption on your device</li>
              <li>Regular security assessments of our systems</li>
              <li>Employee training on privacy and security practices</li>
            </ul>
            
            <p>
              While we strive to use commercially acceptable means to protect your personal data, no method of transmission over the Internet or method of electronic storage is 100% secure.
            </p>
            
            <h2>Data Retention</h2>
            
            <p>
              We retain your personal information only for as long as necessary to fulfill the purposes outlined in this privacy policy, unless a longer retention period is required or permitted by law.
            </p>
            
            <h2>Your Rights</h2>
            
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul>
              <li>Access and receive a copy of your data</li>
              <li>Rectify or update your personal information</li>
              <li>Request deletion of your personal data</li>
              <li>Restrict or object to our processing of your data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time (where processing is based on consent)</li>
            </ul>
            
            <p>
              To exercise these rights, please contact us using the information provided at the end of this policy.
            </p>
            
            <h2>Children's Privacy</h2>
            
            <p>
              Our service is not directed to anyone under the age of 16. We do not knowingly collect personal information from children under 16. If you are a parent or guardian and you believe your child has provided us with personal information, please contact us.
            </p>
            
            <h2>Changes to This Privacy Policy</h2>
            
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
            
            <h2>Contact Us</h2>
            
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
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
