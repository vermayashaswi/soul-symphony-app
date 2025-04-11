
import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import SouloLogo from '@/components/SouloLogo';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function PrivacyPolicy() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <SouloLogo useColorTheme={true} />
          </Link>
          <h1 className="text-3xl font-bold mb-2 text-theme-color text-center">{t('privacy.title')}</h1>
          <p className="text-muted-foreground text-center">{t('privacy.subtitle')}</p>
        </div>
        
        <div className="bg-background rounded-xl p-6 shadow-sm border">
          <ScrollArea className="pr-4">
            <div className="space-y-6 py-2">
              <p className="text-sm text-muted-foreground">{t('privacy.lastUpdated', { date: 'April 8, 2025' })}</p>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{t('privacy.introTitle')}</h3>
                <p className="text-muted-foreground">
                  {t('privacy.introText')}
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{t('privacy.dataCollectionTitle')}</h3>
                <p className="text-muted-foreground">
                  <strong>{t('privacy.accountInfoTitle')}</strong> {t('privacy.accountInfoText')}
                </p>
                <p className="text-muted-foreground">
                  <strong>{t('privacy.journalEntriesTitle')}</strong> {t('privacy.journalEntriesText')}
                </p>
                <p className="text-muted-foreground">
                  <strong>{t('privacy.usageDataTitle')}</strong> {t('privacy.usageDataText')}
                </p>
                <p className="text-muted-foreground">
                  <strong>{t('privacy.deviceInfoTitle')}</strong> {t('privacy.deviceInfoText')}
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{t('privacy.dataUseTitle')}</h3>
                <p className="text-muted-foreground">
                  <strong>{t('privacy.provideServicesTitle')}</strong> {t('privacy.provideServicesText')}
                </p>
                <p className="text-muted-foreground">
                  <strong>{t('privacy.personalizationTitle')}</strong> {t('privacy.personalizationText')}
                </p>
                <p className="text-muted-foreground">
                  <strong>{t('privacy.communicationTitle')}</strong> {t('privacy.communicationText')}
                </p>
                <p className="text-muted-foreground">
                  <strong>{t('privacy.researchTitle')}</strong> {t('privacy.researchText')}
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{t('privacy.securityTitle')}</h3>
                <p className="text-muted-foreground">
                  {t('privacy.securityText')}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{t('privacy.rightsTitle')}</h3>
                <p className="text-muted-foreground">
                  {t('privacy.rightsText')}
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>{t('privacy.rightsAccess')}</li>
                  <li>{t('privacy.rightsCorrection')}</li>
                  <li>{t('privacy.rightsDeletion')}</li>
                  <li>{t('privacy.rightsRestriction')}</li>
                  <li>{t('privacy.rightsPortability')}</li>
                  <li>{t('privacy.rightsObjection')}</li>
                </ul>
                <p className="text-muted-foreground mt-2">
                  {t('privacy.rightsContact')}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{t('privacy.contactUsTitle')}</h3>
                <p className="text-muted-foreground">
                  {t('privacy.contactUsText')}
                </p>
                <p className="text-muted-foreground">
                  {t('privacy.contactEmail')}: support@soulo.online<br />
                  {t('privacy.contactAddress')}: 123 Journal Street, San Francisco, CA 94105, USA
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
        
        <div className="mt-8 text-center">
          <Link to="/" className="text-theme-color hover:underline">
            {t('privacy.returnHome')}
          </Link>
          <p className="text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} SOuLO. {t('footer.rights')}
          </p>
        </div>
      </div>
    </div>
  );
}
