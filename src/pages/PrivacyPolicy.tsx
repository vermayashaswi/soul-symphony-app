
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
          <p className="text-muted-foreground text-center">How we protect your data and privacy</p>
        </div>
        
        <div className="bg-background rounded-xl p-6 shadow-sm border">
          <ScrollArea className="pr-4">
            <div className="space-y-6 py-2">
              <p className="text-sm text-muted-foreground">Last Updated: April 8, 2025</p>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Introduction</h3>
                <p className="text-muted-foreground">
                  SOULo ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our SOULo application and related services (collectively, the "Service").
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Information We Collect</h3>
                <p className="text-muted-foreground">
                  <strong>Account Information:</strong> When you register for an account, we collect your email address, name, and authentication information.
                </p>
                <p className="text-muted-foreground">
                  <strong>Journal Entries:</strong> We collect and store the voice recordings, transcriptions, and analyses of your journal entries.
                </p>
                <p className="text-muted-foreground">
                  <strong>Usage Data:</strong> We collect information about how you interact with our Service, including features you use and time spent on the app.
                </p>
                <p className="text-muted-foreground">
                  <strong>Device Information:</strong> We collect information about your device such as IP address, device type, operating system, and browser type.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">How We Use Your Information</h3>
                <p className="text-muted-foreground">
                  <strong>To Provide Our Services:</strong> We use your information to operate, maintain, and provide you with all the features of our Service.
                </p>
                <p className="text-muted-foreground">
                  <strong>For Personalization:</strong> We use your information to personalize your experience, including providing AI-generated insights.
                </p>
                <p className="text-muted-foreground">
                  <strong>To Communicate With You:</strong> We may use your information to communicate with you about your account, updates, or other information.
                </p>
                <p className="text-muted-foreground">
                  <strong>For Research and Development:</strong> We may use aggregated, anonymized data for research purposes to improve our Service.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Security</h3>
                <p className="text-muted-foreground">
                  We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, so we cannot guarantee absolute security.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Your Rights</h3>
                <p className="text-muted-foreground">
                  Depending on your location, you may have certain rights regarding your personal information, including:
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>The right to access your personal information</li>
                  <li>The right to correct inaccurate information</li>
                  <li>The right to delete your personal information</li>
                  <li>The right to restrict processing</li>
                  <li>The right to data portability</li>
                  <li>The right to object to processing</li>
                </ul>
                <p className="text-muted-foreground mt-2">
                  To exercise any of these rights, please contact us using the information provided below.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Contact Us</h3>
                <p className="text-muted-foreground">
                  If you have any questions or concerns about this Privacy Policy, please contact us:
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
            Return to Home
          </Link>
          <p className="text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} SOuLO. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
