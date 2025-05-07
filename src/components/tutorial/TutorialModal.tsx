
import React, { useEffect } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialTooltip from './TutorialTooltip';
import { LoadingState } from '@/components/insights/soulnet/LoadingState'; // Reuse the loading component

const TutorialModal: React.FC = () => {
  const { isActive, isTutorialCompleted, currentStep, isNavigating } = useTutorial();

  // Add data attributes to navigation and UI elements for tutorial targeting
  useEffect(() => {
    const addTutorialAttributes = () => {
      // Navigation elements
      const journalNav = document.querySelector('[href="/app/journal"]');
      if (journalNav) journalNav.setAttribute('data-tutorial', 'journal-button');
      
      const insightsNav = document.querySelector('[href="/app/insights"]');
      if (insightsNav) insightsNav.setAttribute('data-tutorial', 'insights-button');
      
      const chatNav = document.querySelector('[href="/app/smart-chat"], [href="/app/chat"]');
      if (chatNav) chatNav.setAttribute('data-tutorial', 'chat-button');
      
      const settingsNav = document.querySelector('[href="/app/settings"]');
      if (settingsNav) settingsNav.setAttribute('data-tutorial', 'settings-button');
      
      // Add microphone button targeting based on current step
      if (currentStep === 'journal') {
        // Target different possible selectors for the microphone button
        const micSelectors = [
          '.voice-recorder-button',
          '.recording-button-container button',
          '.relative button svg[class*="Mic"]',
          '.VoiceRecorder button',
          '[aria-label="Record"]'
        ];
        
        let microphoneButton = null;
        
        for (const selector of micSelectors) {
          const button = document.querySelector(selector);
          if (button) {
            microphoneButton = button;
            break;
          }
        }
        
        if (microphoneButton) {
          console.log('Found microphone button:', microphoneButton);
          microphoneButton.setAttribute('data-tutorial', 'microphone-button');
          
          // Find the parent container and add the attribute as well for better targeting
          let parent = microphoneButton.parentElement;
          for (let i = 0; i < 3 && parent; i++) {
            parent.setAttribute('data-tutorial', 'recording-container');
            parent = parent.parentElement;
          }
        } else {
          console.warn('Could not find microphone button for tutorial targeting');
        }
      }
    };
    
    // Run initial setup
    addTutorialAttributes();
    
    // Periodically check for elements since they might load dynamically
    const interval = setInterval(() => {
      addTutorialAttributes();
    }, 500);
    
    return () => clearInterval(interval);
  }, [currentStep]);
  
  // Display loading state during navigation
  if (isNavigating) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/70 backdrop-blur-sm">
        <div className="w-full max-w-md">
          <LoadingState />
        </div>
      </div>
    );
  }
  
  return <TutorialTooltip open={isActive && !isTutorialCompleted} />;
};

export default TutorialModal;
