
import React, { useEffect, useState } from 'react';

const LanguageDebugPanel = () => {
  const [debugInfo, setDebugInfo] = useState({
    googleDefined: false,
    translateDefined: false,
    elementExists: false,
    comboExists: false,
    selectedLanguage: '',
    errorState: ''
  });

  useEffect(() => {
    const updateDebugInfo = () => {
      try {
        const googleDefined = typeof window.google !== 'undefined';
        const translateDefined = googleDefined && typeof window.google.translate !== 'undefined';
        const elementExists = !!document.getElementById('google_translate_element');
        const comboExists = !!document.querySelector('.goog-te-combo');
        const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
        const selectedLanguage = select ? select.value : 'none';

        setDebugInfo({
          googleDefined,
          translateDefined,
          elementExists,
          comboExists,
          selectedLanguage,
          errorState: ''
        });
      } catch (err) {
        setDebugInfo(prev => ({
          ...prev,
          errorState: err instanceof Error ? err.message : 'Unknown error'
        }));
      }
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 p-3 bg-black/80 text-white text-xs z-[9999] rounded-md">
      <h4 className="font-bold mb-1">Google Translate Debug</h4>
      <ul>
        <li>Google API: {debugInfo.googleDefined ? '✅' : '❌'}</li>
        <li>Translate API: {debugInfo.translateDefined ? '✅' : '❌'}</li>
        <li>Element: {debugInfo.elementExists ? '✅' : '❌'}</li>
        <li>Dropdown: {debugInfo.comboExists ? '✅' : '❌'}</li>
        <li>Current: {debugInfo.selectedLanguage}</li>
        {debugInfo.errorState && <li className="text-red-400">Error: {debugInfo.errorState}</li>}
      </ul>
    </div>
  );
};

export default LanguageDebugPanel;
