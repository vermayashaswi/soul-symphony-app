
import React from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialTooltip from './TutorialTooltip';
import { useEffect } from 'react';

const TutorialModal: React.FC = () => {
  const { isActive, isTutorialCompleted } = useTutorial();

  // Add data attributes to navigation elements for tutorial targeting
  useEffect(() => {
    // Add data-tutorial attributes to navigation elements
    const addTutorialAttributes = () => {
      // Journal navigation
      const journalNav = document.querySelector('[href="/app/journal"]');
      if (journalNav) journalNav.setAttribute('data-tutorial', 'journal-button');
      
      // Insights navigation
      const insightsNav = document.querySelector('[href="/app/insights"]');
      if (insightsNav) insightsNav.setAttribute('data-tutorial', 'insights-button');
      
      // Chat navigation
      const chatNav = document.querySelector('[href="/app/chat"]');
      if (chatNav) chatNav.setAttribute('data-tutorial', 'chat-button');
      
      // Settings navigation
      const settingsNav = document.querySelector('[href="/app/settings"]');
      if (settingsNav) settingsNav.setAttribute('data-tutorial', 'settings-button');
      
      // Journal microphone button
      const micButton = document.querySelector('.voice-recorder-button');
      if (micButton) micButton.setAttribute('data-tutorial', 'microphone-button');
    };
    
    // Run initial setup and then periodically check for elements
    addTutorialAttributes();
    
    const interval = setInterval(() => {
      addTutorialAttributes();
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return <TutorialTooltip open={isActive && !isTutorialCompleted} />;
};

export default TutorialModal;
