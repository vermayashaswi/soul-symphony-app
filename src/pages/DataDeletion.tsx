import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { TranslatableText } from '@/components/translation/TranslatableText';
import SouloLogo from '@/components/SouloLogo';
import { Link } from 'react-router-dom';
import { Database, Shield, Mail, FileText, Users, BarChart3, CreditCard, HardDrive } from 'lucide-react';

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <SouloLogo useColorTheme={true} />
          </Link>
          <h1 className="text-3xl font-bold mb-2 text-theme-color text-center">
            <TranslatableText text="dataDeletion.title" />
          </h1>
          <p className="text-muted-foreground text-center">
            <TranslatableText text="dataDeletion.subtitle" />
          </p>
        </div>
        
        <div className="bg-background rounded-xl p-6 shadow-sm border">
          <ScrollArea className="pr-4">
            <div className="space-y-8 py-2">
              
              {/* Types of Data Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-theme-color" />
                  <h3 className="text-xl font-semibold">
                    <TranslatableText text="dataDeletion.dataTypes.title" />
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  <TranslatableText text="dataDeletion.dataTypes.description" />
                </p>

                {/* Personal Data */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <h4 className="font-semibold">
                      <TranslatableText text="dataDeletion.dataTypes.personalData.title" />
                    </h4>
                  </div>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                    <li><TranslatableText text="dataDeletion.dataTypes.personalData.items.0" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.personalData.items.1" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.personalData.items.2" /></li>
                  </ul>
                </div>

                {/* Journal Data */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-500" />
                    <h4 className="font-semibold">
                      <TranslatableText text="dataDeletion.dataTypes.journalData.title" />
                    </h4>
                  </div>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                    <li><TranslatableText text="dataDeletion.dataTypes.journalData.items.0" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.journalData.items.1" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.journalData.items.2" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.journalData.items.3" /></li>
                  </ul>
                </div>

                {/* Interaction Data */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    <h4 className="font-semibold">
                      <TranslatableText text="dataDeletion.dataTypes.interactionData.title" />
                    </h4>
                  </div>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                    <li><TranslatableText text="dataDeletion.dataTypes.interactionData.items.0" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.interactionData.items.1" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.interactionData.items.2" /></li>
                  </ul>
                </div>

                {/* Analytics Data */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-500" />
                    <h4 className="font-semibold">
                      <TranslatableText text="dataDeletion.dataTypes.analyticsData.title" />
                    </h4>
                  </div>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                    <li><TranslatableText text="dataDeletion.dataTypes.analyticsData.items.0" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.analyticsData.items.1" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.analyticsData.items.2" /></li>
                  </ul>
                </div>

                {/* Subscription Data */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-red-500" />
                    <h4 className="font-semibold">
                      <TranslatableText text="dataDeletion.dataTypes.subscriptionData.title" />
                    </h4>
                  </div>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                    <li><TranslatableText text="dataDeletion.dataTypes.subscriptionData.items.0" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.subscriptionData.items.1" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.subscriptionData.items.2" /></li>
                  </ul>
                </div>

                {/* Technical Data */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-gray-500" />
                    <h4 className="font-semibold">
                      <TranslatableText text="dataDeletion.dataTypes.technicalData.title" />
                    </h4>
                  </div>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                    <li><TranslatableText text="dataDeletion.dataTypes.technicalData.items.0" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.technicalData.items.1" /></li>
                    <li><TranslatableText text="dataDeletion.dataTypes.technicalData.items.2" /></li>
                  </ul>
                </div>
              </div>

              {/* Deletion Process Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  <TranslatableText text="dataDeletion.deletionProcess.title" />
                </h3>
                <p className="text-muted-foreground">
                  <TranslatableText text="dataDeletion.deletionProcess.description" />
                </p>
                <div className="space-y-2 pl-4">
                  <p className="text-muted-foreground">
                    <TranslatableText text="dataDeletion.deletionProcess.step1" />
                  </p>
                  <p className="text-muted-foreground">
                    <TranslatableText text="dataDeletion.deletionProcess.step2" />
                  </p>
                  <p className="text-muted-foreground">
                    <TranslatableText text="dataDeletion.deletionProcess.step3" />
                  </p>
                  <p className="text-muted-foreground">
                    <TranslatableText text="dataDeletion.deletionProcess.step4" />
                  </p>
                </div>
              </div>

              {/* Data Retention Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-theme-color" />
                  <h3 className="text-xl font-semibold">
                    <TranslatableText text="dataDeletion.retention.title" />
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  <TranslatableText text="dataDeletion.retention.description" />
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-2">
                  <li>
                    <TranslatableText text="dataDeletion.retention.legal" />
                  </li>
                  <li>
                    <TranslatableText text="dataDeletion.retention.security" />
                  </li>
                  <li>
                    <TranslatableText text="dataDeletion.retention.anonymized" />
                  </li>
                  <li>
                    <TranslatableText text="dataDeletion.retention.duration" />
                  </li>
                </ul>
              </div>

              {/* Your Data Rights Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  <TranslatableText text="dataDeletion.rights.title" />
                </h3>
                <p className="text-muted-foreground">
                  <TranslatableText text="dataDeletion.rights.description" />
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li><TranslatableText text="dataDeletion.rights.access" /></li>
                  <li><TranslatableText text="dataDeletion.rights.correct" /></li>
                  <li><TranslatableText text="dataDeletion.rights.delete" /></li>
                  <li><TranslatableText text="dataDeletion.rights.portability" /></li>
                  <li><TranslatableText text="dataDeletion.rights.restrict" /></li>
                  <li><TranslatableText text="dataDeletion.rights.object" /></li>
                </ul>
              </div>

              {/* Contact Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-theme-color" />
                  <h3 className="text-xl font-semibold">
                    <TranslatableText text="dataDeletion.contact.title" />
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  <TranslatableText text="dataDeletion.contact.description" />
                </p>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                  <p className="text-blue-800 dark:text-blue-200">
                    <TranslatableText text="dataDeletion.contact.email" />
                  </p>
                  <p className="text-blue-800 dark:text-blue-200">
                    <TranslatableText text="dataDeletion.contact.subject" />
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    <TranslatableText text="dataDeletion.contact.include" />
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <TranslatableText text="dataDeletion.contact.response" />
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
        
        <div className="mt-8 text-center space-y-4">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/privacy-policy" className="text-theme-color hover:underline">
              Privacy Policy
            </Link>
            <Link to="/account-deletion" className="text-theme-color hover:underline">
              Account Deletion
            </Link>
            <Link to="/" className="text-theme-color hover:underline">
              Return to Home
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SOULo. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}