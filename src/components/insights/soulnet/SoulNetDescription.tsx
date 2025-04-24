
import React from 'react';

export const SoulNetDescription: React.FC = () => {
  console.log("Rendering SoulNetDescription component");
  
  return (
    <div className="mb-4 p-4 md:mb-6">
      <h2 className="text-lg font-semibold mb-2">SoulNet Visualization</h2>
      <p className="text-muted-foreground text-sm">
        Explore the connections between people, places, and emotions in your journal entries.
        The visualization shows how different entities in your life relate to various emotional states.
      </p>
    </div>
  );
};
