
import React from 'react';

// This is a non-visible component that adds tutorial target elements
// to pages where we need them but don't have a visible UI element to target

const WelcomeElement: React.FC = () => {
  return (
    <div className="hidden">
      <div id="tutorial-welcome" data-tutorial="tutorial-welcome"></div>
      <div id="tutorial-complete" data-tutorial="tutorial-complete"></div>
    </div>
  );
};

export default WelcomeElement;
