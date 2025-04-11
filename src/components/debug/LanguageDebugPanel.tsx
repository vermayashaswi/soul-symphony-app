
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, X, ChevronDown, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useDebugLog } from '@/utils/debug/DebugContext';

type LanguageAction = {
  timestamp: number;
  action: string;
  language?: string;
  details?: any;
};

type TranslationCheck = {
  element: string;
  translated: boolean;
  expected: string;
  actual: string;
};

const LanguageDebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [actions, setActions] = useState<LanguageAction[]>([]);
  const [translationChecks, setTranslationChecks] = useState<TranslationCheck[]>([]);
  const { i18n, t } = useTranslation();
  const { addEvent } = useDebugLog();

  // Check if key elements on the page are properly translated
  const checkTranslations = () => {
    // Common keys to check across pages
    const keysToCheck = [
      { key: 'mainTagline', element: 'Main Tagline' },
      { key: 'hero.welcome', element: 'Hero Welcome' },
      { key: 'hero.tagline', element: 'Hero Tagline' },
      { key: 'hero.getStarted', element: 'Get Started Button' },
      { key: 'features.title', element: 'Features Title' }
    ];

    const checks = keysToCheck.map(item => {
      const translated = t(item.key) !== item.key;
      return {
        element: item.element,
        translated,
        expected: item.key,
        actual: t(item.key)
      };
    });

    setTranslationChecks(checks);
    
    // Log the translation checks to the debug log
    addEvent('i18n', 'Translation check performed', 'info', {
      checks,
      currentLanguage: i18n.language,
      pageUrl: window.location.pathname
    });
  };

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const action = {
        timestamp: Date.now(),
        action: 'Language changed',
        language: lng,
        details: {
          localStorage: localStorage.getItem('i18nextLng'),
          navigatorLanguage: navigator.language,
          documentLang: document.documentElement.lang,
          pageElements: document.querySelectorAll('[data-i18n]').length
        }
      };
      
      setActions(prev => [action, ...prev]);
      addEvent('i18n', `Language changed to ${lng}`, 'info', action.details);
      
      // Run translation checks when language changes
      setTimeout(checkTranslations, 100);
    };

    // Add listener for language changes
    i18n.on('languageChanged', handleLanguageChanged);

    // Add initial language state
    setActions([{
      timestamp: Date.now(),
      action: 'Initial language state',
      language: i18n.language,
      details: {
        localStorage: localStorage.getItem('i18nextLng'),
        navigatorLanguage: navigator.language,
        documentLang: document.documentElement.lang,
        availableLanguages: i18n.options.supportedLngs
      }
    }]);
    
    // Run initial translation check
    checkTranslations();

    const observer = new MutationObserver(() => {
      // Only update translation checks if debug panel is open
      if (isOpen) {
        checkTranslations();
      }
    });

    // Observe the document body for changes that might indicate content translation
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      characterData: true 
    });

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
      observer.disconnect();
    };
  }, [i18n, addEvent, isOpen]);

  const copyDebugInfo = () => {
    const debugInfo = JSON.stringify({
      actions,
      translationChecks,
      currentUrl: window.location.href,
      userAgent: navigator.userAgent
    }, null, 2);
    navigator.clipboard.writeText(debugInfo);
    toast.success('Debug info copied to clipboard');
  };

  const clearLogs = () => {
    setActions([]);
  };

  const togglePanel = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Refresh translation checks when panel is opened
      checkTranslations();
    }
  };

  const checkPageTranslation = () => {
    checkTranslations();
    toast.success('Translation check completed');
  };

  return (
    <div 
      className="fixed bottom-20 right-4 z-50 w-full md:w-auto max-w-full md:max-w-md border shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-900"
      style={{
        maxHeight: isOpen ? '400px' : '40px',
        width: isOpen ? 'min(95vw, 500px)' : 'auto',
        transition: 'all 0.3s ease'
      }}
    >
      <div 
        className="flex items-center justify-between p-2 bg-red-100 dark:bg-red-900 cursor-pointer"
        onClick={togglePanel}
      >
        <div className="flex items-center">
          <Bug className="mr-2 h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="font-medium text-red-600 dark:text-red-400">Language Debug</span>
          {isOpen ? 
            <ChevronDown className="ml-2 h-4 w-4 text-red-600 dark:text-red-400" /> : 
            <ChevronRight className="ml-2 h-4 w-4 text-red-600 dark:text-red-400" />
          }
        </div>
        {isOpen && (
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 hover:bg-red-200 dark:hover:bg-red-800" 
              onClick={(e) => {
                e.stopPropagation();
                copyDebugInfo();
              }}
            >
              <span className="sr-only">Copy</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 hover:bg-red-200 dark:hover:bg-red-800" 
              onClick={(e) => {
                e.stopPropagation();
                clearLogs();
              }}
            >
              <span className="sr-only">Clear</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 hover:bg-red-200 dark:hover:bg-red-800" 
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            >
              <span className="sr-only">Close</span>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="overflow-auto p-2" style={{ maxHeight: '360px' }}>
          <div className="mb-2 p-2 border rounded bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-semibold">Current Language: <span className="text-primary">{i18n.language}</span></h3>
            <div className="text-xs mt-1">
              <div>localStorage: <span className="font-mono">{localStorage.getItem('i18nextLng') || 'not set'}</span></div>
              <div className="flex items-center">
                navigator: <span className="font-mono ml-1">{navigator.language}</span>
                <span className="text-amber-500 ml-1 text-xs">(browser setting, can't be changed by website)</span>
              </div>
              <div>document: <span className="font-mono">{document.documentElement.lang}</span></div>
            </div>
            <div className="mt-2">
              <Button variant="outline" size="sm" className="w-full" onClick={checkPageTranslation}>
                Check Page Translation
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Translation Checks</h3>
            <div className="space-y-1">
              {translationChecks.map((check, index) => (
                <div key={index} className="p-1 border rounded flex items-center text-xs">
                  {check.translated ? 
                    <Check className="h-3 w-3 text-green-500 mr-1" /> : 
                    <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
                  }
                  <span className="font-medium">{check.element}:</span>
                  <span className="ml-1 truncate flex-1">
                    {check.translated ? check.actual : `Not translated (${check.expected})`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <h3 className="text-sm font-semibold mb-2">Language Change History</h3>
          <div className="space-y-2">
            {actions.map((action, index) => (
              <div key={index} className="p-2 border rounded text-sm">
                <div className="flex justify-between items-start">
                  <span className="font-medium">{action.action}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(action.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {action.language && (
                  <div className="text-xs mt-1">
                    Language: <span className="font-mono">{action.language}</span>
                  </div>
                )}
                {action.details && (
                  <div className="mt-1 text-xs">
                    <div className="text-gray-600 dark:text-gray-400">Details:</div>
                    <pre className="mt-1 p-1 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                      {JSON.stringify(action.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageDebugPanel;
