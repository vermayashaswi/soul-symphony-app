import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { TranslatableText } from '@/components/translation/TranslatableText';
import SouloLogo from '@/components/SouloLogo';
import { Link } from 'react-router-dom';
import { Mail, Clock, Trash2, HelpCircle } from 'lucide-react';

export default function AccountDeletion() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <SouloLogo useColorTheme={true} />
          </Link>
          <h1 className="text-3xl font-bold mb-2 text-theme-color text-center">
            <TranslatableText text="accountDeletion.title" />
          </h1>
          <p className="text-muted-foreground text-center">
            <TranslatableText text="accountDeletion.subtitle" />
          </p>
        </div>
        
        <div className="bg-background rounded-xl p-6 shadow-sm border">
          <ScrollArea className="pr-4">
            <div className="space-y-8 py-2">
              
              {/* Instructions Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-theme-color" />
                  <h3 className="text-xl font-semibold">
                    <TranslatableText text="accountDeletion.instructions.title" />
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  <TranslatableText text="accountDeletion.instructions.description" />
                </p>
                <div className="space-y-2 pl-4">
                  <p className="text-muted-foreground">
                    <TranslatableText text="accountDeletion.instructions.step1" />
                  </p>
                  <p className="text-muted-foreground">
                    <TranslatableText text="accountDeletion.instructions.step2" />
                  </p>
                  <p className="text-muted-foreground">
                    <TranslatableText text="accountDeletion.instructions.step3" />
                  </p>
                  <p className="text-muted-foreground">
                    <TranslatableText text="accountDeletion.instructions.step4" />
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-blue-800 dark:text-blue-200">
                    <TranslatableText text="accountDeletion.instructions.alternative" />
                  </p>
                </div>
              </div>

              {/* What Will Be Deleted Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  <TranslatableText text="accountDeletion.whatWillBeDeleted.title" />
                </h3>
                <p className="text-muted-foreground">
                  <TranslatableText text="accountDeletion.whatWillBeDeleted.description" />
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-2">
                  <li>
                    <TranslatableText text="accountDeletion.whatWillBeDeleted.profileData" />
                  </li>
                  <li>
                    <TranslatableText text="accountDeletion.whatWillBeDeleted.journalEntries" />
                  </li>
                  <li>
                    <TranslatableText text="accountDeletion.whatWillBeDeleted.chatHistory" />
                  </li>
                  <li>
                    <TranslatableText text="accountDeletion.whatWillBeDeleted.usageAnalytics" />
                  </li>
                  <li>
                    <TranslatableText text="accountDeletion.whatWillBeDeleted.subscriptionData" />
                  </li>
                  <li>
                    <TranslatableText text="accountDeletion.whatWillBeDeleted.technicalData" />
                  </li>
                </ul>
              </div>

              {/* Processing Time Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-theme-color" />
                  <h3 className="text-xl font-semibold">
                    <TranslatableText text="accountDeletion.processing.title" />
                  </h3>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950/30 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-yellow-800 dark:text-yellow-200">
                    <TranslatableText text="accountDeletion.processing.description" />
                  </p>
                </div>
              </div>

              {/* Contact Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-theme-color" />
                  <h3 className="text-xl font-semibold">
                    <TranslatableText text="accountDeletion.contact.title" />
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  <TranslatableText text="accountDeletion.contact.description" />
                </p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <TranslatableText text="accountDeletion.contact.email" />
                </div>
                <p className="text-sm text-muted-foreground">
                  <TranslatableText text="accountDeletion.contact.response" />
                </p>
              </div>

              {/* Important Notice */}
              <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Important Notice</h4>
                <p className="text-red-700 dark:text-red-300 text-sm">
                  Account deletion is permanent and cannot be undone. Please make sure you have saved any important data before proceeding with deletion.
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
            <Link to="/data-deletion" className="text-theme-color hover:underline">
              Data Deletion Policy
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