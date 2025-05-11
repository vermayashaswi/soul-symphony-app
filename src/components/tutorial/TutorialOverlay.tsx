
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';

const TutorialOverlay: React.FC = () => {
  const { 
    isActive, 
    currentStep, 
    totalSteps,
    steps, 
    nextStep, 
    prevStep, 
    skipTutorial
  } = useTutorial();

  // Enhanced handling for the arrow button in step 2 and other elements in steps 3 & 4
  useEffect(() => {
    if (!isActive) return;

    // Get the current step
    const currentTutorialStep = steps[currentStep];
    if (!currentTutorialStep) return;

    console.log(`Applying tutorial highlight for step ${currentStep + 1}:`, currentTutorialStep.title);

    // Make mobile navigation always clickable during tutorial
    const mobileNav = document.querySelector('[class*="fixed bottom-0 left-0 right-0"]');
    if (mobileNav) {
      mobileNav.classList.add('mobile-nav-clickable');
      console.log("Made mobile navigation clickable during tutorial");
    }

    // Make all mobile navigation links clickable
    const navLinks = document.querySelectorAll('.flex.justify-around.items-center a');
    navLinks.forEach(link => {
      link.classList.add('mobile-nav-clickable');
    });

    // Step-specific handlers
    if (currentTutorialStep.id === 2) {
      // Step 2: Highlight the arrow button
      const arrowButton = document.querySelector('.journal-arrow-button');
      
      if (arrowButton) {
        console.log("Enhancing arrow button visibility for tutorial step 2");
        
        // Add special highlighting class and ensure visibility
        arrowButton.classList.add('tutorial-target');
        
        // Make the button element more prominent with enhanced glow effect
        const buttonElement = arrowButton.querySelector('button');
        if (buttonElement) {
          buttonElement.classList.add('tutorial-button-highlight');
          console.log("Added enhanced highlighting effect to button element");
        }
      }
    } else if (currentTutorialStep.id === 3) {
      // Step 3: Highlight the journal button in mobile nav and the "Record Entry" button
      const journalNavButton = document.querySelector('a[href="/app/journal"]');
      const recordButton = document.querySelector('.journal-record-button');
      
      if (journalNavButton) {
        journalNavButton.classList.add('mobile-nav-journal', 'tutorial-target', 'tutorial-nav-highlight', 'mobile-nav-clickable');
        console.log("Highlighted journal navigation button for tutorial step 3");
      } else {
        console.warn("Could not find journal navigation button for step 3");
      }
      
      if (recordButton) {
        recordButton.classList.add('tutorial-target', 'tutorial-button-highlight');
        console.log("Highlighted record entry button for tutorial step 3");
      }
      
      // Ensure the record tab is automatically selected
      const recordTab = document.querySelector('[value="record"]');
      if (recordTab && recordTab instanceof HTMLElement) {
        setTimeout(() => {
          recordTab.click();
          console.log("Auto-clicked the record tab for tutorial step 3");
        }, 300);
      }
    } else if (currentTutorialStep.id === 4) {
      // Step 4: Highlight the journal entries header
      const entriesHeader = document.querySelector('.journal-entries-header');
      const entriesList = document.querySelector('.journal-entries-list');
      
      if (entriesHeader) {
        entriesHeader.classList.add('tutorial-target', 'tutorial-header-highlight');
        console.log("Highlighted journal entries header for tutorial step 4");
      }
      
      if (entriesList) {
        entriesList.classList.add('tutorial-target', 'tutorial-list-highlight');
        console.log("Highlighted journal entries list for tutorial step 4");
      }
      
      // Ensure the entries tab is automatically selected
      const entriesTab = document.querySelector('[value="entries"]');
      if (entriesTab && entriesTab instanceof HTMLElement) {
        setTimeout(() => {
          entriesTab.click();
          console.log("Auto-clicked the entries tab for tutorial step 4");
        }, 300);
      }
    }

    // Clean up when step changes or tutorial ends
    return () => {
      // Clean up arrow button (step 2)
      const arrowButton = document.querySelector('.journal-arrow-button');
      if (arrowButton) {
        arrowButton.classList.remove('tutorial-target');
        
        const buttonElement = arrowButton.querySelector('button');
        if (buttonElement) {
          buttonElement.classList.remove('tutorial-button-highlight');
        }
      }
      
      // Clean up journal nav button and record button (step 3)
      const journalNavButton = document.querySelector('a[href="/app/journal"]');
      const recordButton = document.querySelector('.journal-record-button');
      
      if (journalNavButton) {
        journalNavButton.classList.remove('mobile-nav-journal', 'tutorial-target', 'tutorial-nav-highlight');
        // Still keep it clickable
        journalNavButton.classList.add('mobile-nav-clickable');
      }
      
      if (recordButton) {
        recordButton.classList.remove('tutorial-target', 'tutorial-button-highlight');
      }
      
      // Clean up entries header and list (step 4)
      const entriesHeader = document.querySelector('.journal-entries-header');
      const entriesList = document.querySelector('.journal-entries-list');
      
      if (entriesHeader) {
        entriesHeader.classList.remove('tutorial-target', 'tutorial-header-highlight');
      }
      
      if (entriesList) {
        entriesList.classList.remove('tutorial-target', 'tutorial-list-highlight');
      }
    };
  }, [isActive, currentStep, steps]);

  if (!isActive) return null;

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none">
      {/* Semi-transparent overlay */}
      <motion.div
        className="tutorial-overlay absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Tutorial step */}
      <AnimatePresence mode="wait">
        <TutorialStep
          key={currentStep}
          step={currentTutorialStep}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTutorial}
          isFirst={isFirstStep}
          isLast={isLastStep}
          stepNumber={currentStep + 1}
          totalSteps={totalSteps}
        />
      </AnimatePresence>
    </div>
  );
};

export default TutorialOverlay;
