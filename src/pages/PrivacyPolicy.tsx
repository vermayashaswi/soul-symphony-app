
import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import SouloLogo from '@/components/SouloLogo';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <SouloLogo useColorTheme={true} />
          </Link>
          <h1 className="text-3xl font-bold mb-2 text-theme-color text-center">Privacy Policy</h1>
          <p className="text-muted-foreground text-center">How we protect your data and respect your privacy</p>
        </div>
        
        <div className="bg-background rounded-xl p-6 shadow-sm border">
          <ScrollArea className="pr-4">
            <div className="space-y-6 py-2">
              <p className="text-sm text-muted-foreground">Last Updated: April 8, 2025</p>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Introduction</h3>
                <p className="text-muted-foreground">
                  Welcome to SOuLO ("we," "our," or "us"). We are committed to protecting your privacy and handling your data with transparency and care. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our journaling application.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Information We Collect</h3>
                <p className="text-muted-foreground">
                  <strong>Account Information:</strong> When you create an account, we collect your email address, name, and password.
                </p>
                <p className="text-muted-foreground">
                  <strong>Journal Entries:</strong> We store the content of your journal entries, including text and voice recordings.
                </p>
                <p className="text-muted-foreground">
                  <strong>Usage Data:</strong> We collect information about how you interact with our application, such as features used, time spent, and actions taken.
                </p>
                <p className="text-muted-foreground">
                  <strong>Device Information:</strong> We collect information about your device, including IP address, browser type, and operating system.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">How We Use Your Information</h3>
                <p className="text-muted-foreground">
                  <strong>Provide and Improve Services:</strong> We use your information to deliver our journaling features, analyze your entries, and generate insights.
                </p>
                <p className="text-muted-foreground">
                  <strong>Personalization:</strong> We personalize your experience based on your preferences and usage patterns.
                </p>
                <p className="text-muted-foreground">
                  <strong>Communication:</strong> We may send you notifications, updates, and support messages.
                </p>
                <p className="text-muted-foreground">
                  <strong>Research and Development:</strong> We use anonymized data to improve our AI algorithms and develop new features.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Data Security</h3>
                <p className="text-muted-foreground">
                  We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Your Rights</h3>
                <p className="text-muted-foreground">
                  Depending on your location, you may have rights regarding your personal information, including:
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Access to your personal data</li>
                  <li>Correction of inaccurate data</li>
                  <li>Deletion of your data</li>
                  <li>Restriction of processing</li>
                  <li>Data portability</li>
                  <li>Objection to processing</li>
                </ul>
                <p className="text-muted-foreground mt-2">
                  To exercise these rights, please contact us at support@soulo.online.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Contact Us</h3>
                <p className="text-muted-foreground">
                  If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
                </p>
                <p className="text-muted-foreground">
                  Email: support@soulo.online<br />
                  Address: 123 Journal Street, San Francisco, CA 94105, USA
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
        
        <div className="mt-8 text-center">
          <Link to="/" className="text-theme-color hover:underline">
            Return to Homepage
          </Link>
          <p className="text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} SOuLO. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
