
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';

const DebugPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const { isActive, currentStep, steps } = useTutorial();
  
  // Only render in development environment
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const elementInfo = () => {
    if (!isActive || !steps[currentStep]) return null;
    
    const targetSelector = steps[currentStep].targetElement;
    if (!targetSelector) return <p>No target element for this step</p>;
    
    const element = document.querySelector(targetSelector);
    if (!element) return <p>Target element not found: {targetSelector}</p>;
    
    const rect = element.getBoundingClientRect();
    return (
      <div>
        <p>Target: {targetSelector}</p>
        <p>Position: T:{rect.top.toFixed(0)} L:{rect.left.toFixed(0)} W:{rect.width.toFixed(0)} H:{rect.height.toFixed(0)}</p>
        <p>Computed z-index: {window.getComputedStyle(element).zIndex}</p>
        <p>Visibility: {window.getComputedStyle(element).visibility}</p>
      </div>
    );
  };
  
  return (
    <div 
      className="fixed bottom-0 right-0 bg-black/80 text-white p-2 text-xs z-[10000] max-w-96"
      style={{ 
        maxHeight: isExpanded ? '50vh' : '30px',
        overflow: 'auto',
        transition: 'max-height 0.3s ease'
      }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Debug Panel</h3>
        <button 
          onClick={() => setIsExpanded(!isExpanded)} 
          className="text-xs px-1 bg-gray-700 rounded"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      
      {isExpanded && (
        <>
          <div className="mb-2">
            <p>Current Route: {location.pathname}</p>
            <p>Tutorial Active: {isActive ? 'Yes' : 'No'}</p>
            <p>Current Step: {currentStep} (ID: {steps[currentStep]?.id})</p>
          </div>
          
          <div className="mb-2 border-t border-gray-600 pt-1">
            <h4 className="font-semibold">Target Element:</h4>
            {elementInfo()}
          </div>
          
          <div className="mb-2 border-t border-gray-600 pt-1">
            <h4 className="font-semibold">Arrow Button Position:</h4>
            {(() => {
              const arrowButton = document.querySelector('.journal-arrow-button');
              if (!arrowButton) return <p>Arrow button not found</p>;
              const rect = arrowButton.getBoundingClientRect();
              const center = {
                x: Math.round(rect.left + rect.width / 2),
                y: Math.round(rect.top + rect.height / 2)
              };
              const viewportCenter = {
                x: Math.round(window.innerWidth / 2),
                y: Math.round(window.innerHeight / 2)
              };
              const offset = {
                x: center.x - viewportCenter.x,
                y: center.y - viewportCenter.y
              };
              
              return (
                <div>
                  <p>Button center: x:{center.x} y:{center.y}</p>
                  <p>Viewport center: x:{viewportCenter.x} y:{viewportCenter.y}</p>
                  <p>Offset from center: x:{offset.x} y:{offset.y}</p>
                  <p>Button rect: T:{rect.top.toFixed(0)} L:{rect.left.toFixed(0)} W:{rect.width.toFixed(0)} H:{rect.height.toFixed(0)}</p>
                </div>
              );
            })()}
          </div>
          
          <div className="mb-2 border-t border-gray-600 pt-1">
            <h4 className="font-semibold">Record Entry Target:</h4>
            {(() => {
              const selectors = [
                '[data-value="record"]',
                '.record-entry-tab',
                '.tutorial-record-entry-button',
                'button[data-tutorial-target="record-entry"]',
                '#new-entry-button'
              ];
              
              return (
                <div>
                  {selectors.map(selector => {
                    const elements = document.querySelectorAll(selector);
                    return (
                      <div key={selector} className="mb-1">
                        <p>{selector}: {elements.length} found</p>
                        {Array.from(elements).map((el, i) => {
                          const rect = el.getBoundingClientRect();
                          return (
                            <p key={i} className="pl-2 text-gray-300">
                              #{i}: {rect.width.toFixed(0)}x{rect.height.toFixed(0)} 
                              @({rect.left.toFixed(0)},{rect.top.toFixed(0)})
                              z-index: {window.getComputedStyle(el).zIndex}
                            </p>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
};

export default DebugPanel;
